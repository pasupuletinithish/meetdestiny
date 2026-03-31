-- Run this in your Supabase SQL Editor to upgrade your vehicles table!
ALTER TABLE public.vehicles
ADD COLUMN cooldown_hours INTEGER DEFAULT 9 NOT NULL;
