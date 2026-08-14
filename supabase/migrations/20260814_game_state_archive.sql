-- C7: archive a night before anything clears it.
--
-- Both managers persist to ONE game_state row and overwrite it in place:
-- v3 resetSession() and v4 "End session and reset" both commit fresh
-- DEFAULTS over the same row, with no archive anywhere. Today that loses a
-- night. Once Publish exists it is worse: there is a window between the last
-- game and the tap where a mis-press destroys the session permanently.
--
-- Append-only by construction: there is no UPDATE or DELETE policy, so even
-- an admin cannot rewrite history from the browser.
--
-- Idempotent: safe to re-run.
--
-- ROLLBACK:
--   drop table if exists game_state_archive;

create table if not exists game_state_archive (
  id                uuid primary key default gen_random_uuid(),
  -- Which game_state row this came from: 'cm_v3_session', 'cm_v4_session', …
  row_id            text not null,
  state             jsonb not null,
  -- game_state.updated_at as it stood when we copied it, so an archive row
  -- can be traced back to the exact version it replaced.
  source_updated_at timestamptz,
  archived_at       timestamptz not null default now(),
  archived_by       uuid references auth.users (id),
  reason            text,
  -- "Keyed by session id and timestamp."
  unique (row_id, archived_at)
);

create index if not exists game_state_archive_row_time
  on game_state_archive (row_id, archived_at desc);

alter table game_state_archive enable row level security;

-- Admin-only, same boundary as game_state itself. Not `to authenticated`:
-- the clubhouse issues a login to every roster member, and these rows are
-- whole sessions including tiers.
drop policy if exists "archive admin read"   on game_state_archive;
drop policy if exists "archive admin insert" on game_state_archive;

create policy "archive admin read"
  on game_state_archive for select to authenticated
  using (is_engine_admin());

create policy "archive admin insert"
  on game_state_archive for insert to authenticated
  with check (is_engine_admin());

-- Deliberately NO update/delete policy, and none for anon.
