-- Clubhouse migration 001: content tables + auth linking (Waves 1-2).
-- APPLY: paste into Supabase SQL editor (Dashboard -> SQL) and run once.
-- Idempotent: safe to re-run.
--
-- Laws: no tier data can exist in any table here (PIPE-1). The site reads
-- only clubhouse_* tables. Court Manager tables are never touched.

-- ---------------------------------------------------------------------------
-- Roster copy for the claim picker (AUTH-5): names only, nothing else.
-- Populated/refreshed by the publish pipeline or an admin script.
-- ---------------------------------------------------------------------------
create table if not exists clubhouse_roster (
  player_id text primary key,          -- stable roster id (PIPE-5)
  display_name text not null,
  claimable boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auth linking (AUTH-4/5/6): one auth user <-> one player, conflicts surface.
-- ---------------------------------------------------------------------------
create table if not exists clubhouse_links (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  player_id text not null unique,      -- unique => second claim errors (AUTH-6)
  claimed_at timestamptz not null default now(),
  revoked boolean not null default false,
  consent_publication_at timestamptz   -- PRIV-1, stamped at claim
);

-- ---------------------------------------------------------------------------
-- Published content (Wave 1 shapes; see src/clubhouse/schema.sql for docs)
-- ---------------------------------------------------------------------------
create table if not exists clubhouse_sessions (
  session_id text primary key,
  date date not null,
  venue text not null,
  attendance_count int not null default 0,
  recap_note text,
  shoutouts jsonb,
  practice_only boolean not null default false,
  published_at timestamptz not null default now()
);

create table if not exists clubhouse_pairs (
  session_id text not null references clubhouse_sessions(session_id) on delete cascade,
  pair_id text not null,
  players jsonb not null,
  primary key (session_id, pair_id)
);

create table if not exists clubhouse_results (
  session_id text not null references clubhouse_sessions(session_id) on delete cascade,
  game_id text not null,
  winner_pair_id text not null,
  loser_pair_id text not null,
  completed_at bigint not null,
  primary key (session_id, game_id)
);

create table if not exists clubhouse_champions (
  session_id text not null references clubhouse_sessions(session_id) on delete cascade,
  title text not null,
  points int not null default 0,
  pair jsonb not null,
  primary key (session_id, title)
);

create table if not exists clubhouse_finalists (
  session_id text not null references clubhouse_sessions(session_id) on delete cascade,
  title text not null,
  points int not null default 0,
  pair jsonb not null,
  primary key (session_id, title)
);

create table if not exists clubhouse_totals (
  player_id text primary key,
  sessions int not null default 0,
  games int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  championships int not null default 0,
  pto_points int not null default 0,
  longest_win_streak int not null default 0,
  current_week_streak int not null default 0,
  best_week_streak int not null default 0,
  milestones jsonb,
  show_winpct boolean not null default true,
  show_rank boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists clubhouse_rivalries (
  player_a text not null,
  player_b text not null,
  meetings int not null,
  wins_a int not null,
  wins_b int not null,
  primary key (player_a, player_b)
);

-- ---------------------------------------------------------------------------
-- Row level security: clubhouse content is for authenticated players (ACC-1).
-- ---------------------------------------------------------------------------
alter table clubhouse_roster    enable row level security;
alter table clubhouse_links     enable row level security;
alter table clubhouse_sessions  enable row level security;
alter table clubhouse_pairs     enable row level security;
alter table clubhouse_results   enable row level security;
alter table clubhouse_champions enable row level security;
alter table clubhouse_finalists enable row level security;
alter table clubhouse_totals    enable row level security;
alter table clubhouse_rivalries enable row level security;

-- Claim picker: signed-in users may read claimable names.
--
-- STALE AS OF 2026-08-18. The policy below says `using (true)`. What is
-- actually running on flahcijysipymafazhxq, read out of pg_policies, is
-- `is_engine_admin() OR hidden = false OR (your own linked row)`. It was
-- tightened in the dashboard and never written back here. Re-running this
-- file as written would LOOSEN production. Read pg_policies before touching
-- clubhouse_roster. See supabase/migrations/20260818_clubhouse_roster_anon_read.sql.
drop policy if exists "roster read for authenticated" on clubhouse_roster;
create policy "roster read for authenticated"
  on clubhouse_roster for select to authenticated using (true);

-- Links: a user may see and create only their own link. No self-service
-- update/delete: revoke and rebind are admin actions in the dashboard.
drop policy if exists "own link read" on clubhouse_links;
create policy "own link read"
  on clubhouse_links for select to authenticated
  using (auth.uid() = auth_user_id);
drop policy if exists "own link claim" on clubhouse_links;
create policy "own link claim"
  on clubhouse_links for insert to authenticated
  with check (
    auth.uid() = auth_user_id
    and exists (
      select 1 from clubhouse_roster r
      where r.player_id = clubhouse_links.player_id and r.claimable
    )
  );

-- Content: read for any signed-in user.
drop policy if exists "sessions read"  on clubhouse_sessions;
create policy "sessions read"  on clubhouse_sessions  for select to authenticated using (true);
drop policy if exists "pairs read"     on clubhouse_pairs;
create policy "pairs read"     on clubhouse_pairs     for select to authenticated using (true);
drop policy if exists "results read"   on clubhouse_results;
create policy "results read"   on clubhouse_results   for select to authenticated using (true);
drop policy if exists "champions read" on clubhouse_champions;
create policy "champions read" on clubhouse_champions for select to authenticated using (true);
drop policy if exists "finalists read" on clubhouse_finalists;
create policy "finalists read" on clubhouse_finalists for select to authenticated using (true);
drop policy if exists "totals read"    on clubhouse_totals;
create policy "totals read"    on clubhouse_totals    for select to authenticated using (true);
drop policy if exists "rivalries read" on clubhouse_rivalries;
create policy "rivalries read" on clubhouse_rivalries for select to authenticated using (true);

-- Public teaser exception (PUB-1/PRIV-2): the latest session's champions
-- are readable without login. Everything else stays behind auth.
drop policy if exists "latest champions public" on clubhouse_champions;
create policy "latest champions public"
  on clubhouse_champions for select to anon
  using (
    session_id = (
      select s.session_id from clubhouse_sessions s
      where not s.practice_only
      order by s.date desc limit 1
    )
  );
drop policy if exists "sessions public meta" on clubhouse_sessions;
create policy "sessions public meta"
  on clubhouse_sessions for select to anon using (true);

-- Writes: none for anon/authenticated. The publish pipeline writes with the
-- service role (bypasses RLS) from Court Manager's admin context.
