
-- Store pair history to avoid repeat pairings across weeks
CREATE TABLE public.pair_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_name TEXT NOT NULL,
  player2_name TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS with public access (matches game_state pattern)
ALTER TABLE public.pair_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair history is publicly readable"
  ON public.pair_history FOR SELECT USING (true);

CREATE POLICY "Pair history is publicly writable"
  ON public.pair_history FOR INSERT WITH CHECK (true);

-- Index for efficient lookups of recent pairings
CREATE INDEX idx_pair_history_date ON public.pair_history (session_date DESC);
CREATE INDEX idx_pair_history_players ON public.pair_history (player1_name, player2_name);
