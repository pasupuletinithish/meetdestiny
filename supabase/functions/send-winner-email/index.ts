import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })

  try {
    const {
      winner_name,
      winner_email,
      coupon_code,
      contest_type,
      contest_description,
      vehicle_id,
    } = await req.json()

    if (!winner_email || !coupon_code) throw new Error('Missing required fields')

    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
    const BREVO_SENDER = Deno.env.get('BREVO_SENDER')!

    // ── Beautiful HTML email ──────────────────────────────
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏆 You Won!</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1E88E5,#1565C0);border-radius:24px 24px 0 0;padding:40px 32px;text-align:center;">
      <div style="font-size:56px;margin-bottom:12px;">🏆</div>
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;">You Won!</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:15px;">Congratulations ${winner_name}!</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      
      <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Today's Contest</p>
        <p style="margin:0;font-size:20px;font-weight:800;color:#15803d;">${contest_type} 🎯</p>
        <p style="margin:6px 0 0;font-size:13px;color:#4ade80;">${contest_description}</p>
      </div>

      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        You were the <strong style="color:#1E88E5;">top traveler</strong> on your journey <strong>${vehicle_id}</strong>! 
        As a reward, here's your exclusive food coupon:
      </p>

      <!-- Coupon -->
      <div style="background:linear-gradient(135deg,#FF6B35,#E85A2B);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;position:relative;">
        <div style="border:2px dashed rgba(255,255,255,0.4);border-radius:12px;padding:20px;">
          <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em;">Your Coupon Code</p>
          <p style="color:#fff;font-size:32px;font-weight:900;margin:0;font-family:monospace;letter-spacing:0.15em;">${coupon_code}</p>
          <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:8px 0 0;">Copy this code and use it on Zomato/Swiggy</p>
        </div>
      </div>

      <!-- Steps -->
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;">How to redeem:</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="width:24px;height:24px;background:#1E88E5;border-radius:50%;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">1</span>
            <span style="font-size:13px;color:#475569;">Open Zomato or Swiggy app</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="width:24px;height:24px;background:#1E88E5;border-radius:50%;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">2</span>
            <span style="font-size:13px;color:#475569;">Add items to cart and go to checkout</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="width:24px;height:24px;background:#1E88E5;border-radius:50%;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">3</span>
            <span style="font-size:13px;color:#475569;">Apply coupon code <strong>${coupon_code}</strong></span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="width:24px;height:24px;background:#22c55e;border-radius:50%;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✓</span>
            <span style="font-size:13px;color:#475569;">Enjoy your free food! 🍕</span>
          </div>
        </div>
      </div>

      <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0;">
        Keep traveling and networking to win more contests!<br/>
        <strong style="color:#1E88E5;">Every journey is a new chance to win 🚌</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:linear-gradient(135deg,#1E88E5,#FF6B35);border-radius:0 0 24px 24px;padding:20px 32px;text-align:center;">
      <p style="color:#fff;font-size:14px;font-weight:700;margin:0;">Destiny — Your paths were meant to meet</p>
      <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:4px 0 0;">meetdestiny.online</p>
    </div>

  </div>
</body>
</html>`

    // ── Send via Brevo ────────────────────────────────────
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: BREVO_SENDER, name: 'Destiny App 🏆' },
        to: [{ email: winner_email, name: winner_name }],
        subject: `🏆 ${winner_name}, you won the ${contest_type} contest!`,
        htmlContent,
      }),
    })

    const result = await response.json()

    if (!response.ok) throw new Error(`Brevo error: ${JSON.stringify(result)}`)

    // ── Mark email as sent in DB ──────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase
      .from('contest_winners')
      .update({ email_sent: true })
      .eq('winner_email', winner_email)
      .eq('vehicle_id', vehicle_id)

    return new Response(JSON.stringify({ success: true, message: 'Email sent!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})