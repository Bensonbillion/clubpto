-- Update default max_spots and spots_remaining to 20 for new sessions
ALTER TABLE public.sessions ALTER COLUMN max_spots SET DEFAULT 20;
ALTER TABLE public.sessions ALTER COLUMN spots_remaining SET DEFAULT 20;

-- Update existing sessions to have 20 max spots (adjust spots_remaining proportionally)
UPDATE public.sessions 
SET max_spots = 20, 
    spots_remaining = GREATEST(0, 20 - (max_spots - spots_remaining))
WHERE max_spots = 16;