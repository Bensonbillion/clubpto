-- Clubhouse migration 003: member preference toggles (Wave 3).
-- LB-3: hide my Win% from other viewers. DASH-7: show my private rank
-- (hidden by default - the Zen-mode lesson). Separate table so
-- clubhouse_totals stays pipeline-owned and read-only for members.
-- Idempotent: safe to re-run.
create table if not exists clubhouse_prefs (
  player_id text primary key,
  show_winpct boolean not null default true,
  show_rank boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table clubhouse_prefs enable row level security;

-- Any signed-in member can read prefs (needed to honor LB-3 on boards).
drop policy if exists "prefs read" on clubhouse_prefs;
create policy "prefs read" on clubhouse_prefs
  for select to authenticated using (true);

-- A member may write ONLY the row for the player they claimed.
drop policy if exists "own prefs insert" on clubhouse_prefs;
create policy "own prefs insert" on clubhouse_prefs
  for insert to authenticated
  with check (
    exists (
      select 1 from clubhouse_links l
      where l.auth_user_id = auth.uid()
        and l.player_id = clubhouse_prefs.player_id
        and not l.revoked
    )
  );
drop policy if exists "own prefs update" on clubhouse_prefs;
create policy "own prefs update" on clubhouse_prefs
  for update to authenticated
  using (
    exists (
      select 1 from clubhouse_links l
      where l.auth_user_id = auth.uid()
        and l.player_id = clubhouse_prefs.player_id
        and not l.revoked
    )
  )
  with check (
    exists (
      select 1 from clubhouse_links l
      where l.auth_user_id = auth.uid()
        and l.player_id = clubhouse_prefs.player_id
        and not l.revoked
    )
  );
