-- Add updated_by column to track which device made the last change (diagnostics)
ALTER TABLE public.game_state ADD COLUMN IF NOT EXISTS updated_by text;

-- Add version column for optimistic locking (prevents stale writes)
ALTER TABLE public.game_state ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
