-- Clubhouse public tables (PIPE-1) — REFERENCE DRAFT, not auto-applied.
-- Apply deliberately via Supabase once auth (Wave 2) is in place, because
-- RLS below assumes authenticated readers.
--
-- ARCHITECTURAL LAW: these tables physically contain no tier data.
-- The publish transform (src/clubhouse/publish/transform.ts) is the only
-- writer; the site reads only these tables and never Court Manager's.
-- Everything is upserted by session_id (PIPE-4: republish is idempotent).

create table if not exists clubhouse_sessions (
  session_id text primary key,
  date date not null,
  venue text not null,
  attendance_count int not null default 0,
  recap_note text,
  shoutouts jsonb,          -- string[]
  practice_only boolean not null default false,
  published_at timestamptz not null default now()
);

create table if not exists clubhouse_players (
  player_id text primary key,      -- stable roster id (PIPE-5)
  display_name text not null,
  member_number int,               -- MEM-1: #001-#024 founding, then sequential
  is_founding boolean not null default false,
  is_member boolean not null default false,
  hidden boolean not null default false,
  consent_publication_at timestamptz,   -- PRIV-1
  updated_at timestamptz not null default now()
);

create table if not exists clubhouse_pairs (
  session_id text not null references clubhouse_sessions(session_id) on delete cascade,
  pair_id text not null,
  players jsonb not null,   -- [{id?, displayName}, {id?, displayName}] — hidden refs carry no id
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
  title text not null,      -- court/title name only (PRIV-6): never a division
  points int not null default 0,  -- openly-published event value (LB-4)
  pair jsonb not null,
  primary key (session_id, title)
);

-- Derived tables, recomputed and replaced at each publish (PIPE-6):
create table if not exists clubhouse_totals (
  player_id text primary key,
  sessions int not null default 0,
  games int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  championships int not null default 0,
  pto_points int not null default 0,     -- LB-4 prestige board
  longest_win_streak int not null default 0,
  current_week_streak int not null default 0,
  best_week_streak int not null default 0,
  milestones jsonb,          -- earned milestone tiers, e.g. [10, 25]
  show_winpct boolean not null default true,   -- LB-3 opt-out
  show_rank boolean not null default false,    -- DASH-7: hidden by default
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

-- RLS: clubhouse content is for authenticated players only (ACC-1).
-- The public teaser reads ONLY clubhouse_sessions (this week's champions
-- via clubhouse_champions where consented) + an anonymous attendee count.
alter table clubhouse_sessions  enable row level security;
alter table clubhouse_players   enable row level security;
alter table clubhouse_pairs     enable row level security;
alter table clubhouse_results   enable row level security;
alter table clubhouse_champions enable row level security;
alter table clubhouse_totals    enable row level security;
alter table clubhouse_rivalries enable row level security;

create policy "clubhouse read for authenticated"
  on clubhouse_sessions for select to authenticated using (true);
-- (repeat per table; champions additionally get a public-read policy limited
--  to the most recent session for the teaser layer, PUB-1/PRIV-2)
