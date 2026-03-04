
-- Create players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  tier TEXT NOT NULL DEFAULT 'C' CHECK (tier IN ('A', 'B', 'C')),
  is_vip BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique index on email only when not null
CREATE UNIQUE INDEX players_email_unique ON public.players (email) WHERE email IS NOT NULL;

-- Unique index on name to prevent duplicates
CREATE UNIQUE INDEX players_name_unique ON public.players (name);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Players are publicly readable"
ON public.players FOR SELECT
USING (true);

-- Public insert
CREATE POLICY "Players are publicly writable"
ON public.players FOR INSERT
WITH CHECK (true);

-- Public update
CREATE POLICY "Players are publicly updatable"
ON public.players FOR UPDATE
USING (true);

-- Public delete
CREATE POLICY "Players are publicly deletable"
ON public.players FOR DELETE
USING (true);

-- Timestamp trigger
CREATE TRIGGER update_players_updated_at
BEFORE UPDATE ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
