
-- Add missing columns to players table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS preferred_name TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS total_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS total_wins INTEGER NOT NULL DEFAULT 0;

-- Backfill: set first_name from name for existing rows
UPDATE public.players SET first_name = name, last_name = '' WHERE first_name IS NULL;
