
-- Table to store shared game state as JSON (single row, shared across all devices)
CREATE TABLE public.game_state (
  id text PRIMARY KEY DEFAULT 'current',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required — passcode-gated in UI)
CREATE POLICY "Game state is publicly readable"
  ON public.game_state FOR SELECT
  USING (true);

-- Public write access (upsert)
CREATE POLICY "Game state is publicly writable"
  ON public.game_state FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Game state is publicly updatable"
  ON public.game_state FOR UPDATE
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;

-- Seed with empty state
INSERT INTO public.game_state (id, state) VALUES ('current', '{"sessionConfig":{"startTime":"18:00","durationMinutes":120},"roster":[],"pairs":[],"matches":[],"gameHistory":[],"sessionStarted":false}');
