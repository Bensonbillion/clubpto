-- The transaction-boundary check, after a real Publish from a real device.
-- Paste into the Supabase SQL editor. Read-only: nothing here writes.
--
-- WHY EXACT EQUALITY AND NOT A WINDOW. Postgres now() returns TRANSACTION
-- START time and is stable for the whole transaction — clock_timestamp() is
-- the one that moves. Every default in publish_session's path uses now(), so
-- if the session row, the attendance rows and the alias rows were written by
-- one transaction they carry the IDENTICAL timestamp, to the microsecond.
-- Two timestamps a few milliseconds apart do not mean "close enough"; they
-- mean two transactions, which is the thing being disproved.

-- 1. The night, and everything filed under it.
select
  s.session_id,
  s.date,
  s.venue,
  s.attendance_count                                        as says_this_many,
  (select count(*) from clubhouse_attendance a
    where a.session_id = s.session_id)                      as actually_has_this_many,
  s.practice_only,
  s.published_at
from clubhouse_sessions s
order by s.published_at desc
limit 5;

-- 2. THE BOUNDARY. One row per table, all written by the same call.
--    same_transaction must be true on every row.
with newest as (
  select session_id, published_at from clubhouse_sessions
  order by published_at desc limit 1
)
select
  'clubhouse_sessions'      as table_name,
  n.published_at            as stamped_at,
  true                      as same_transaction
from newest n
union all
select
  'clubhouse_attendance',
  a.created_at,
  a.created_at = n.published_at
from newest n
join clubhouse_attendance a on a.session_id = n.session_id
union all
select
  'clubhouse_player_alias',
  al.created_at,
  al.created_at = n.published_at
from newest n
join clubhouse_player_alias al
  on al.created_at >= n.published_at - interval '1 minute'
order by table_name, stamped_at;

-- 3. The aliases themselves, with the human name they resolve to.
--    (clubhouse_player_alias has no id column — the key is (kind, value).)
select
  al.kind,
  al.value        as engine_id,
  al.player_id,
  r.display_name,
  al.verified,
  al.confirmed_by,
  al.created_at
from clubhouse_player_alias al
join clubhouse_roster r on r.player_id = al.player_id
order by al.created_at desc
limit 10;

-- 4. Who the room will say was there.
select a.player_id, r.display_name, a.status, a.source, a.checked_in_at, a.recorded_by
from clubhouse_attendance a
join clubhouse_roster r on r.player_id = a.player_id
where a.session_id = (select session_id from clubhouse_sessions order by published_at desc limit 1)
order by r.display_name;

-- 5. Nothing should EVER appear here. A reassignment during a first publish
--    means an engine id was already mapped to somebody else.
select * from clubhouse_player_alias_history order by changed_at desc limit 10;

-- ---------------------------------------------------------------------------
-- CLEANUP, after the throwaway night.
--
-- These writes go to the LIVE database — the RPC is applied to production, so
-- a publish from a dev server writes real rows. Run this to remove the test
-- night. Order matters: attendance and aliases have no cascade from the
-- session, because attendance is deliberately not FK'd to it (migration 005)
-- and an alias outlives any single night by design.
--
-- Replace the id with the one from query 1.
-- ---------------------------------------------------------------------------
-- \set sid 'night-2026-08-…'
--
-- delete from clubhouse_attendance   where session_id = 'night-2026-08-…';
-- delete from clubhouse_sessions     where session_id = 'night-2026-08-…';  -- cascades to pairs/results/champions/finalists
-- -- Aliases are worth KEEPING: they are true mappings that cost a confirmation
-- -- to make, and the next real night will want them. Delete only if the
-- -- throwaway night mapped somebody wrongly:
-- -- delete from clubhouse_player_alias where value in ('…');
--
-- select (select count(*) from clubhouse_sessions)   as sessions,
--        (select count(*) from clubhouse_attendance) as attendance,
--        (select count(*) from clubhouse_player_alias) as aliases;
