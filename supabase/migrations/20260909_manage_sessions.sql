-- The Court Manager's shared row, one per manager instance.
--
-- Read and written ONLY by the manage-session Edge Function with the service
-- role, after it has checked the door's passcode. There are deliberately no
-- policies on this table: RLS is on and nothing is granted, so the public
-- key reaches nothing here, which is the same posture game_state has held
-- since 20260814_lock_game_state.sql. This table exists so that lock never
-- has to loosen.

create table if not exists public.manage_sessions (
  instance   text primary key,
  envelope   jsonb not null,
  saved_at   bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.manage_sessions enable row level security;

revoke all on public.manage_sessions from anon, authenticated;
