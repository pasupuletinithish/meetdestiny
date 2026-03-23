import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Allow both service role and user JWT
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { vehicle_id } = await req.json()
    if (!vehicle_id) throw new Error('vehicle_id is required')

    // ── Get today's contest type ──────────────────────────
    const dayOfWeek = new Date().getDay() // 0=Sunday, 6=Saturday
    const { data: contestType } = await supabase
      .from('contest_types')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .maybeSingle()

    if (!contestType) throw new Error('No contest type for today')

    // ── Check if winner already picked for this journey ──
    const { data: existingWinner } = await supabase
      .from('contest_winners')
      .select('id')
      .eq('vehicle_id', vehicle_id)
      .maybeSingle()

    if (existingWinner) {
      return new Response(JSON.stringify({ message: 'Winner already picked for this journey' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Get all travelers on this vehicle ────────────────
    const { data: checkins } = await supabase
      .from('checkins')
      .select('user_id, name, created_at')
      .eq('vehicle_id', vehicle_id)

    if (!checkins || checkins.length === 0) {
      return new Response(JSON.stringify({ message: 'No travelers on this vehicle' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userIds = checkins.map(c => c.user_id)

    // ── Calculate scores based on contest criteria ───────
    let winnerId: string | null = null
    let winnerScore = 0

    if (contestType.criteria === 'random') {
      // Lucky draw — random winner
      const randomIndex = Math.floor(Math.random() * checkins.length)
      winnerId = checkins[randomIndex].user_id
      winnerScore = 1

    } else if (contestType.criteria === 'pings_sent') {
      // Most pings sent
      const { data: pings } = await supabase
        .from('pings')
        .select('from_user_id')
        .in('from_user_id', userIds)

      const scores: Record<string, number> = {}
      pings?.forEach(p => { scores[p.from_user_id] = (scores[p.from_user_id] || 0) + 1 })
      const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
      if (top) { winnerId = top[0]; winnerScore = top[1] }

    } else if (contestType.criteria === 'mutual_matches') {
      // Most mutual pings (both pinged each other)
      const { data: pings } = await supabase
        .from('pings')
        .select('from_user_id, to_user_id')
        .or(`from_user_id.in.(${userIds.join(',')}),to_user_id.in.(${userIds.join(',')})`)

      const scores: Record<string, number> = {}
      userIds.forEach(uid => {
        const sent = pings?.filter(p => p.from_user_id === uid).map(p => p.to_user_id) || []
        const received = pings?.filter(p => p.to_user_id === uid).map(p => p.from_user_id) || []
        const mutual = sent.filter(id => received.includes(id))
        scores[uid] = mutual.length
      })
      const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
      if (top) { winnerId = top[0]; winnerScore = top[1] }

    } else if (contestType.criteria === 'messages_sent') {
      // Most lounge messages
      const { data: messages } = await supabase
        .from('lounge_messages')
        .select('user_id')
        .eq('vehicle_id', vehicle_id)
        .in('user_id', userIds)

      const scores: Record<string, number> = {}
      messages?.forEach(m => { scores[m.user_id] = (scores[m.user_id] || 0) + 1 })
      const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
      if (top) { winnerId = top[0]; winnerScore = top[1] }

    } else if (contestType.criteria === 'first_checkin') {
      // First to check in
      const first = checkins.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0]
      winnerId = first.user_id
      winnerScore = 1

    } else if (contestType.criteria === 'friends_added') {
      // Most friends added
      const { data: friends } = await supabase
        .from('friends')
        .select('requester_id, receiver_id')
        .eq('status', 'accepted')
        .or(`requester_id.in.(${userIds.join(',')}),receiver_id.in.(${userIds.join(',')})`)

      const scores: Record<string, number> = {}
      friends?.forEach(f => {
        if (userIds.includes(f.requester_id)) scores[f.requester_id] = (scores[f.requester_id] || 0) + 1
        if (userIds.includes(f.receiver_id)) scores[f.receiver_id] = (scores[f.receiver_id] || 0) + 1
      })
      const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
      if (top) { winnerId = top[0]; winnerScore = top[1] }

    } else if (contestType.criteria === 'combined') {
      // All rounder — combined score
      const scores: Record<string, number> = {}
      userIds.forEach(uid => { scores[uid] = 0 })

      // Pings sent (+5 each)
      const { data: pings } = await supabase.from('pings').select('from_user_id').in('from_user_id', userIds)
      pings?.forEach(p => { scores[p.from_user_id] = (scores[p.from_user_id] || 0) + 5 })

      // Messages (+3 each)
      const { data: messages } = await supabase.from('lounge_messages').select('user_id').eq('vehicle_id', vehicle_id).in('user_id', userIds)
      messages?.forEach(m => { scores[m.user_id] = (scores[m.user_id] || 0) + 3 })

      // Friends (+15 each)
      const { data: friends } = await supabase.from('friends').select('requester_id, receiver_id').eq('status', 'accepted').or(`requester_id.in.(${userIds.join(',')}),receiver_id.in.(${userIds.join(',')})`)
      friends?.forEach(f => {
        if (userIds.includes(f.requester_id)) scores[f.requester_id] = (scores[f.requester_id] || 0) + 15
        if (userIds.includes(f.receiver_id)) scores[f.receiver_id] = (scores[f.receiver_id] || 0) + 15
      })

      const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
      if (top) { winnerId = top[0]; winnerScore = top[1] }
    }

    // ── Fallback: random if no activity ──────────────────
    if (!winnerId) {
      const randomIndex = Math.floor(Math.random() * checkins.length)
      winnerId = checkins[randomIndex].user_id
      winnerScore = 0
    }

    // ── Get winner details ────────────────────────────────
    const { data: winnerProfile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('user_id', winnerId)
      .maybeSingle()

    const { data: winnerAuth } = await supabase.auth.admin.getUserById(winnerId)
    const winnerEmail = winnerAuth?.user?.email || ''
    const winnerName = winnerProfile?.name || winnerAuth?.user?.user_metadata?.full_name || 'Traveler'

    // ── Pick an unused coupon ─────────────────────────────
    const { data: coupon } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_used', false)
      .limit(1)
      .maybeSingle()

    if (!coupon) {
      // No coupons available — still record winner
      await supabase.from('contest_winners').insert({
        user_id: winnerId,
        vehicle_id,
        contest_type: contestType.name,
        score: winnerScore,
        coupon_id: null,
        journey_date: new Date().toISOString().split('T')[0],
        winner_email: winnerEmail,
        winner_name: winnerName,
        email_sent: false,
      })

      return new Response(JSON.stringify({
        success: true,
        winner: { id: winnerId, name: winnerName, email: winnerEmail, score: winnerScore },
        contest: contestType.name,
        message: 'Winner picked but no coupons available!',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── Mark coupon as used ───────────────────────────────
    await supabase.from('coupons').update({
      is_used: true,
      used_by: winnerId,
      used_at: new Date().toISOString(),
    }).eq('id', coupon.id)

    // ── Save winner record ────────────────────────────────
    await supabase.from('contest_winners').insert({
      user_id: winnerId,
      vehicle_id,
      contest_type: contestType.name,
      score: winnerScore,
      coupon_id: coupon.id,
      journey_date: new Date().toISOString().split('T')[0],
      winner_email: winnerEmail,
      winner_name: winnerName,
      email_sent: false,
    })

    // ── Trigger email sending ─────────────────────────────
    await supabase.functions.invoke('send-winner-email', {
      body: {
        winner_name: winnerName,
        winner_email: winnerEmail,
        coupon_code: coupon.code,
        contest_type: contestType.name,
        contest_description: contestType.description,
        vehicle_id,
      }
    })

    return new Response(JSON.stringify({
      success: true,
      winner: { id: winnerId, name: winnerName, email: winnerEmail, score: winnerScore },
      contest: contestType.name,
      coupon: coupon.code,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})