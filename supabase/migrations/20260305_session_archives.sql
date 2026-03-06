-- Session Archives: stores completed game sessions with full results
CREATE TABLE public.session_archives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_date DATE NOT NULL,
  session_label TEXT, -- e.g. "Week 1", "March 5 Session"

  -- Full game state snapshot
  roster JSONB NOT NULL DEFAULT '[]',        -- all players who participated
  pairs JSONB NOT NULL DEFAULT '[]',         -- pair compositions
  matches JSONB NOT NULL DEFAULT '[]',       -- all matches with results
  standings JSONB NOT NULL DEFAULT '[]',     -- final pair standings by tier
  playoff_bracket JSONB NOT NULL DEFAULT '[]', -- playoff matches if any
  game_history JSONB NOT NULL DEFAULT '[]',  -- court-by-court history

  -- Session config
  court_count INTEGER NOT NULL DEFAULT 2,
  duration_minutes INTEGER NOT NULL DEFAULT 85,
  dynamic_mode BOOLEAN NOT NULL DEFAULT false,

  -- Points snapshot at time of archive
  points_awarded JSONB NOT NULL DEFAULT '[]', -- [{playerId, playerName, points, reason}]

  -- Metadata
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_by TEXT -- admin who triggered the archive
);

-- Enable RLS
ALTER TABLE public.session_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session archives are publicly readable"
  ON public.session_archives FOR SELECT USING (true);

CREATE POLICY "Anyone can insert session archives"
  ON public.session_archives FOR INSERT WITH CHECK (true);

CREATE INDEX idx_session_archives_date ON public.session_archives (session_date DESC);
