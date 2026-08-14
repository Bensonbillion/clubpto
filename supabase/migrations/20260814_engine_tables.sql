-- Engine migration: move the court-manager tables off the Lovable-managed
-- Supabase project (ikfbtktofcfkpqxwlfku) onto the club's own project
-- (flahcijysipymafazhxq), which already hosts the clubhouse.
--
-- Faithful copy of the source schema. RLS below reproduces the access the
-- app has TODAY, because the engine authenticates with the anon key and has
-- no login: locking these down in the same change that moves them would take
-- /manage offline. Tightening is a separate, deliberate step.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The court manager's live state. One row per surface:
--   current, open_current  legacy engine
--   cm_v3_session          Court Manager v3 (what /manage runs on)
--   cm_v4_session          Americano v4 (/manage4)
create table if not exists game_state (
  id          text primary key,
  state       jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists sessions (
  id               uuid primary key default gen_random_uuid(),
  session_date     date not null,
  session_time     time not null,
  max_spots        integer not null default 20,
  spots_remaining  integer not null default 20,
  price_cents      integer not null default 1500,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists pair_history (
  id            uuid primary key default gen_random_uuid(),
  player1_name  text not null,
  player2_name  text not null,
  session_date  date not null,
  created_at    timestamptz not null default now()
);

create table if not exists players (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  first_name      text,
  last_name       text,
  preferred_name  text,
  email           text,
  tier            text not null default 'B',
  is_vip          boolean not null default false,
  total_points    integer not null default 0,
  total_wins      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists bookings (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid references sessions (id) on delete set null,
  customer_name     text,
  customer_email    text,
  payment_status    text default 'pending',
  stripe_payment_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table game_state   enable row level security;
alter table sessions     enable row level security;
alter table pair_history enable row level security;
alter table players      enable row level security;
alter table bookings     enable row level security;

-- game_state: the court manager reads AND writes this with the anon key from
-- courtside. Both are required for /manage to function at all.
drop policy if exists "game_state anon read"  on game_state;
drop policy if exists "game_state anon write" on game_state;
create policy "game_state anon read"  on game_state for select to anon, authenticated using (true);
create policy "game_state anon write" on game_state for all    to anon, authenticated using (true) with check (true);

-- Read-only reference data for the site and the manager.
drop policy if exists "sessions read"     on sessions;
drop policy if exists "pair_history read" on pair_history;
drop policy if exists "players read"      on players;
create policy "sessions read"     on sessions     for select to anon, authenticated using (true);
create policy "pair_history read" on pair_history for select to anon, authenticated using (true);
create policy "players read"      on players      for select to anon, authenticated using (true);

-- bookings holds customer_email / customer_name / stripe_payment_id. On the
-- old project this was readable by anyone holding the anon key, which ships
-- in the browser bundle. It is empty, so this migration is the free moment to
-- close it: no policy at all means no anon or authenticated access, and the
-- service role (server side) still bypasses RLS.
-- If something later needs to read bookings from the browser, give it a
-- policy scoped to that need rather than reopening the table.

-- ---------------------------------------------------------------------------
-- Keep updated_at honest on the rows the app touches directly.
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists sessions_touch on sessions;
create trigger sessions_touch before update on sessions
  for each row execute function touch_updated_at();

drop trigger if exists players_touch on players;
create trigger players_touch before update on players
  for each row execute function touch_updated_at();

drop trigger if exists bookings_touch on bookings;
create trigger bookings_touch before update on bookings
  for each row execute function touch_updated_at();
