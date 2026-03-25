import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, title, body, url } = await req.json()

    if (!user_id || !title || !body) {
      throw new Error('Missing required fields: user_id, title, body')
    }

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user authorization passing from frontend
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Fetch the target user's push subscription from the database
    const { data: record, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)
      .single()

    if (subError || !record || !record.subscription) {
      return new Response(
        JSON.stringify({ error: 'User is not subscribed to push notifications', details: subError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const subscription = record.subscription

    // Set up web-push VAPID details
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@meetdestiny.online'

    if (!vapidPublic || !vapidPrivate) {
      throw new Error('VAPID keys (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) are not set in the environment')
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    // Construct push payload mapped for sw.js
    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: '/meetdestiny-favicon.svg'
    })

    try {
      // Send the notification via the native browser push service
      await webpush.sendNotification(subscription, payload)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (pushError: any) {
      // If the subscription is no longer valid (e.g. user revoked permission), remove it
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('user_id', user_id)
      }
      throw pushError
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ 
        error: err.message || err.toString(), 
        details: err.body || null, 
        statusCode: err.statusCode || 500 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})