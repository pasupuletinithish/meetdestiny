-- =========================================================================
-- MEETDESTINY AUTO-CLEANUP & AUTOMATED CONTEST WEBHOOKS (V2)
-- Make sure to replace <YOUR_PROJECT_REF> and <YOUR_ANON_KEY> below!
-- =========================================================================

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. FIX REPORTS RLS (Admin Panel bug fix)
-- This allows authenticated admins to update report status
DROP POLICY IF EXISTS "allow_updates" ON public.reports;
CREATE POLICY "allow_updates" ON public.reports 
FOR UPDATE TO authenticated USING (true);

-- 3. Create the database function
CREATE OR REPLACE FUNCTION public.clean_expired_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expiring_vehicle RECORD;
  -- IMPORTANT: Replace these with your actual Supabase URL and Anon Key!
  v_project_url TEXT := 'https://<YOUR_PROJECT_REF>.supabase.co';
  v_anon_key TEXT := '<YOUR_ANON_KEY>';
BEGIN
  -- A. Trigger Contest Winners automatically!
  -- Find vehicles where checkins have just expired, and HTTP POST to the edge function
  FOR expiring_vehicle IN (
    SELECT DISTINCT vehicle_id 
    FROM public.checkins 
    WHERE expires_at < NOW() 
      AND vehicle_id IS NOT NULL 
      AND is_active = true
  )
  LOOP
    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/pick-winner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object('vehicle_id', expiring_vehicle.vehicle_id)
    );
  END LOOP;

  -- B. Delete user messages in live vehicle chats for expired users
  DELETE FROM public.lounge_messages
  WHERE user_id IN (
    SELECT user_id FROM public.checkins WHERE expires_at < NOW() OR is_active = false
  )
  AND vehicle_id IN (
    SELECT vehicle_id FROM public.checkins WHERE expires_at < NOW() OR is_active = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.user_id = lounge_messages.user_id AND c.vehicle_id = lounge_messages.vehicle_id AND c.is_active = true AND c.expires_at >= NOW()
  );

  -- C. Delete user messages in destination chats for expired users
  DELETE FROM public.destination_messages
  WHERE user_id IN (
    SELECT user_id FROM public.checkins WHERE expires_at < NOW() OR is_active = false
  )
  AND destination IN (
    SELECT to_location FROM public.checkins WHERE expires_at < NOW() OR is_active = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.user_id = destination_messages.user_id AND c.to_location = destination_messages.destination AND c.is_active = true AND c.expires_at >= NOW()
  );

  -- D. Delete AI welcome messages when the vehicle is empty
  DELETE FROM public.lounge_messages
  WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND NOT EXISTS (
    SELECT 1 FROM public.checkins c WHERE c.vehicle_id = lounge_messages.vehicle_id AND c.is_active = true AND c.expires_at >= NOW()
  );

  DELETE FROM public.destination_messages
  WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND NOT EXISTS (
    SELECT 1 FROM public.checkins c WHERE c.to_location = destination_messages.destination AND c.is_active = true AND c.expires_at >= NOW()
  );

  -- E. Auto-Delete Accounts Completely (unless they have friends)
  DELETE FROM auth.users u
  WHERE EXISTS (
    SELECT 1 FROM public.checkins c WHERE c.user_id = u.id AND c.expires_at < NOW()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.checkins c WHERE c.user_id = u.id AND c.is_active = true AND c.expires_at >= NOW()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.friends f WHERE (f.requester_id = u.id OR f.receiver_id = u.id) AND f.status = 'accepted'
  );
END;
$$;

-- 4. Schedule the cron job
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-messages-job');
EXCEPTION WHEN OTHERS THEN
END $$;

SELECT cron.schedule(
  'cleanup-expired-messages-job',
  '*/5 * * * *',
  'SELECT public.clean_expired_messages();'
);
