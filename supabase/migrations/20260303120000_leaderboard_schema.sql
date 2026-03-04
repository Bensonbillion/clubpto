-- ============================================================
-- Leaderboard & Player Profiles Schema
-- ============================================================

-- 1. Players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  email TEXT NOT NULL UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Points reason enum
CREATE TYPE public.points_reason AS ENUM ('regular_win', 'playoff_win', 'tournament_win');

-- 3. Points ledger (append-only log)
CREATE TABLE public.points_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points IN (3, 5, 10)),
  reason public.points_reason NOT NULL,
  match_id UUID,
  week_start_date DATE NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Weekly leaderboard (materialized view)
CREATE MATERIALIZED VIEW public.weekly_leaderboard AS
SELECT
  pl.week_start_date,
  pl.player_id,
  COALESCE(p.preferred_name, p.first_name) AS player_name,
  SUM(pl.points)::INTEGER AS points,
  COUNT(*)::INTEGER AS wins,
  RANK() OVER (
    PARTITION BY pl.week_start_date
    ORDER BY SUM(pl.points) DESC
  )::INTEGER AS rank
FROM public.points_ledger pl
JOIN public.players p ON p.id = pl.player_id
GROUP BY pl.week_start_date, pl.player_id, p.preferred_name, p.first_name
ORDER BY pl.week_start_date DESC, rank;

-- ============================================================
-- Indexes
-- ============================================================

-- players: email already has unique constraint index
CREATE INDEX idx_players_total_points ON public.players (total_points DESC);

-- points_ledger
CREATE INDEX idx_points_ledger_player_id ON public.points_ledger (player_id);
CREATE INDEX idx_points_ledger_week_start ON public.points_ledger (week_start_date DESC);
CREATE INDEX idx_points_ledger_earned_at ON public.points_ledger (earned_at DESC);
CREATE INDEX idx_points_ledger_player_week ON public.points_ledger (player_id, week_start_date);

-- weekly_leaderboard materialized view
CREATE UNIQUE INDEX idx_weekly_lb_week_player ON public.weekly_leaderboard (week_start_date, player_id);
CREATE INDEX idx_weekly_lb_week_rank ON public.weekly_leaderboard (week_start_date, rank);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Players
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players are publicly readable"
  ON public.players FOR SELECT
  USING (true);

CREATE POLICY "Players are publicly updatable"
  ON public.players FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can insert players"
  ON public.players FOR INSERT
  WITH CHECK (true);

-- Points ledger
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Points ledger is publicly readable"
  ON public.points_ledger FOR SELECT
  USING (true);

-- Insert restricted to service role (no public insert policy)
-- Use supabase.rpc() or service-role key to insert

-- ============================================================
-- Function: refresh weekly leaderboard
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_weekly_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.weekly_leaderboard;
END;
$$;

-- ============================================================
-- Function: award points (atomic insert + update)
-- ============================================================

CREATE OR REPLACE FUNCTION public.award_points(
  p_player_id UUID,
  p_points INTEGER,
  p_reason public.points_reason,
  p_match_id UUID DEFAULT NULL,
  p_week_start_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE;
  v_ledger_id UUID;
BEGIN
  -- Calculate week start (Monday) if not provided
  IF p_week_start_date IS NOT NULL THEN
    v_week_start := p_week_start_date;
  ELSE
    v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
  END IF;

  -- Validate points value
  IF p_points NOT IN (3, 5, 10) THEN
    RAISE EXCEPTION 'Points must be 3, 5, or 10';
  END IF;

  -- Insert ledger entry
  INSERT INTO public.points_ledger (player_id, points, reason, match_id, week_start_date, earned_at)
  VALUES (p_player_id, p_points, p_reason, p_match_id, v_week_start, now())
  RETURNING id INTO v_ledger_id;

  -- Update denormalized totals on player
  UPDATE public.players
  SET total_points = total_points + p_points,
      total_wins = total_wins + 1
  WHERE id = p_player_id;

  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.weekly_leaderboard;

  RETURN v_ledger_id;
END;
$$;
