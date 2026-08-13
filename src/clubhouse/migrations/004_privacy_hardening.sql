-- Clubhouse migration 004: privacy hardening found by the Wave 3 review.
-- Idempotent: safe to re-run.
--
-- 1) PROF-3: a hidden player must vanish from every surface. The publish
--    pipeline hides people by stripping their id from the bundle, which
--    keeps them out of boards, records, rivalries and the mosaic — but the
--    roster copy drives the players directory, so it needs its own flag.
alter table clubhouse_roster
  add column if not exists hidden boolean not null default false;

-- 2) PRIV-2 / PUB-3: the anon teaser policy on clubhouse_sessions exposed
--    EVERY column of EVERY session, including recap notes and shout-outs,
--    which name members. Postgres RLS is row-level only and cannot hide a
--    column, so the anon read is withdrawn here and the public teaser will
--    read a column-restricted view when it is built (Wave 4).
drop policy if exists "sessions public meta" on clubhouse_sessions;

-- The champions teaser policy sub-selects clubhouse_sessions, and that
-- sub-select is subject to RLS too — with the anon policy gone it would
-- return nothing. A security-definer function keeps the teaser working
-- while exposing exactly one value: the latest published session id.
create or replace function latest_published_session_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.session_id
  from clubhouse_sessions s
  where not s.practice_only
  order by s.date desc
  limit 1
$$;

drop policy if exists "latest champions public" on clubhouse_champions;
create policy "latest champions public"
  on clubhouse_champions for select to anon
  using (session_id = latest_published_session_id());
