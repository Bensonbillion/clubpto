-- Clubhouse migration 007: Publish, as one transaction.
--
-- APPLY: paste into the Supabase SQL editor (project flahcijysipymafazhxq).
-- Idempotent: safe to re-run.
--
-- REQUIRES 001 (content tables), 005 (attendance), 006 (aliases) and
-- is_engine_admin() from supabase/migrations/20260814_engine_admins.sql.
--
-- ROLLBACK:
--   drop function if exists publish_session(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb);
--
-- ---------------------------------------------------------------------------
-- WHY A FUNCTION AND NOT SEVEN CALLS
--
-- PostgREST gives one transaction per HTTP request. Publishing touches seven
-- tables, so from the browser that is seven transactions and six chances to
-- stop halfway. A Publish that half-writes at 11pm is worse than one that
-- refuses, because the admin walks away believing the night is recorded: the
-- session row exists, the recap renders, and the attendance simply is not
-- there. Nobody finds out until someone's count is wrong weeks later.
--
-- One function, one transaction. Everything lands or nothing does.
--
-- WHY SECURITY DEFINER
--
-- The five content tables have RLS enabled and carry SELECT policies only —
-- 001 assumed a service-role writer that never arrived, so there is no
-- INSERT, UPDATE or DELETE policy on any of them. Under SECURITY INVOKER the
-- inserts raise 42501, and worse, the child DELETEs silently affect zero rows
-- (a DELETE with no permissive policy is not an error), which would surface
-- later as a bogus duplicate-key failure.
--
-- DEFINER means RLS is not the gate here, so the gate is written out below as
-- the first statement. It is load-bearing: all 66 roster members hold a
-- passwordless login on this project, so without it any signed-in member
-- could rewrite the club's published record. auth.uid() still resolves inside
-- DEFINER — it reads the JWT claim — so attribution stays honest.
-- ---------------------------------------------------------------------------

create or replace function publish_session(
  p_session    jsonb,
  p_pairs      jsonb default '[]'::jsonb,
  p_results    jsonb default '[]'::jsonb,
  p_champions  jsonb default '[]'::jsonb,
  p_finalists  jsonb default '[]'::jsonb,
  p_attendance jsonb default '[]'::jsonb,
  p_aliases    jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text := p_session ->> 'session_id';
  v_venue      text := p_session ->> 'venue';
  v_date       text := p_session ->> 'date';
  v_actor      uuid := auth.uid();
  v_missing    text;
  v_bad_pair   text;
  v_counts     jsonb;
begin
  -- ── the gate ──────────────────────────────────────────────────────
  if not is_engine_admin() then
    raise exception using errcode = '42501',
      message = 'You are not signed in as a court manager admin, so nothing was published.';
  end if;

  -- ── refusals, in the admin's language, before anything is written ──
  if v_session_id is null or v_session_id = '' then
    raise exception using errcode = '22023',
      message = 'This night has no session id, so there is nothing to file it under.';
  end if;
  if v_date is null or v_date = '' then
    raise exception using errcode = '22023',
      message = 'This night has no date.';
  end if;
  if v_venue is null or btrim(v_venue) = '' then
    raise exception using errcode = '22023',
      message = 'This night needs a venue before it can be published.';
  end if;

  -- Every attending player must already map to a roster member. The FK would
  -- catch this, but as a constraint name at the end of a long transaction;
  -- named up front it is something an admin can act on.
  select string_agg(distinct a.player_id, ', ' order by a.player_id) into v_missing
  from jsonb_to_recordset(p_attendance) as a(player_id text)
  where not exists (select 1 from clubhouse_roster r where r.player_id = a.player_id);
  if v_missing is not null then
    raise exception using errcode = '23503',
      message = 'These people are not matched to a roster member yet: ' || v_missing
                || '. Match them, then publish.';
  end if;

  -- clubhouse_results has no foreign key to clubhouse_pairs (001), so a
  -- mistyped pair id would publish a result pointing at nothing and the room
  -- would render a game between two blanks.
  select string_agg(distinct bad, ', ') into v_bad_pair
  from (
    select r.winner_pair_id as bad from jsonb_to_recordset(p_results)
      as r(winner_pair_id text, loser_pair_id text)
    where not exists (select 1 from jsonb_to_recordset(p_pairs) as p(pair_id text)
                      where p.pair_id = r.winner_pair_id)
    union
    select r.loser_pair_id from jsonb_to_recordset(p_results)
      as r(winner_pair_id text, loser_pair_id text)
    where not exists (select 1 from jsonb_to_recordset(p_pairs) as p(pair_id text)
                      where p.pair_id = r.loser_pair_id)
  ) q;
  if v_bad_pair is not null then
    raise exception using errcode = '23503',
      message = 'A result refers to a pair that is not in this night: ' || v_bad_pair || '.';
  end if;

  -- ── the session row ───────────────────────────────────────────────
  -- published_at is NEVER touched on conflict. It is when the night first
  -- became public, and re-pressing Publish does not make that later. It also
  -- feeds latest_published_session_id(), which the anon champions teaser
  -- keys on — churn there blinks the public teaser off mid-transaction.
  insert into clubhouse_sessions
    (session_id, date, venue, attendance_count, recap_note, shoutouts, practice_only)
  values (
    v_session_id,
    (p_session ->> 'date')::date,
    v_venue,
    coalesce((p_session ->> 'attendance_count')::int, 0),
    nullif(p_session ->> 'recap_note', ''),
    p_session -> 'shoutouts',
    coalesce((p_session ->> 'practice_only')::boolean, false)
  )
  on conflict (session_id) do update set
    date             = excluded.date,
    venue            = excluded.venue,
    attendance_count = excluded.attendance_count,
    recap_note       = excluded.recap_note,
    shoutouts        = excluded.shoutouts,
    practice_only    = excluded.practice_only
  where clubhouse_sessions.date             is distinct from excluded.date
     or clubhouse_sessions.venue            is distinct from excluded.venue
     or clubhouse_sessions.attendance_count is distinct from excluded.attendance_count
     or clubhouse_sessions.recap_note       is distinct from excluded.recap_note
     or clubhouse_sessions.shoutouts        is distinct from excluded.shoutouts
     or clubhouse_sessions.practice_only    is distinct from excluded.practice_only;

  -- ── the four children ─────────────────────────────────────────────
  -- Delete-what-is-gone THEN upsert-what-changed, rather than a plain upsert.
  -- An upsert never removes: a game voided between one press and the next, or
  -- a champion corrected, would survive in the published record forever.
  --
  -- Not a cascade delete of the session row either — that discards
  -- published_at and empties latest_published_session_id() mid-transaction.

  delete from clubhouse_pairs p
  where p.session_id = v_session_id
    and not exists (select 1 from jsonb_to_recordset(p_pairs) as x(pair_id text)
                    where x.pair_id = p.pair_id);

  insert into clubhouse_pairs (session_id, pair_id, players)
  select v_session_id, x.pair_id, x.players
  from jsonb_to_recordset(p_pairs) as x(pair_id text, players jsonb)
  on conflict (session_id, pair_id) do update set players = excluded.players
  where clubhouse_pairs.players is distinct from excluded.players;

  delete from clubhouse_results r
  where r.session_id = v_session_id
    and not exists (select 1 from jsonb_to_recordset(p_results) as x(game_id text)
                    where x.game_id = r.game_id);

  insert into clubhouse_results (session_id, game_id, winner_pair_id, loser_pair_id, completed_at)
  select v_session_id, x.game_id, x.winner_pair_id, x.loser_pair_id, x.completed_at
  from jsonb_to_recordset(p_results)
    as x(game_id text, winner_pair_id text, loser_pair_id text, completed_at bigint)
  on conflict (session_id, game_id) do update set
    winner_pair_id = excluded.winner_pair_id,
    loser_pair_id  = excluded.loser_pair_id,
    completed_at   = excluded.completed_at
  where clubhouse_results.winner_pair_id is distinct from excluded.winner_pair_id
     or clubhouse_results.loser_pair_id  is distinct from excluded.loser_pair_id
     or clubhouse_results.completed_at   is distinct from excluded.completed_at;

  delete from clubhouse_champions c
  where c.session_id = v_session_id
    and not exists (select 1 from jsonb_to_recordset(p_champions) as x(title text)
                    where x.title = c.title);

  insert into clubhouse_champions (session_id, title, points, pair)
  select v_session_id, x.title, x.points, x.pair
  from jsonb_to_recordset(p_champions) as x(title text, points int, pair jsonb)
  on conflict (session_id, title) do update set points = excluded.points, pair = excluded.pair
  where clubhouse_champions.points is distinct from excluded.points
     or clubhouse_champions.pair   is distinct from excluded.pair;

  delete from clubhouse_finalists f
  where f.session_id = v_session_id
    and not exists (select 1 from jsonb_to_recordset(p_finalists) as x(title text)
                    where x.title = f.title);

  insert into clubhouse_finalists (session_id, title, points, pair)
  select v_session_id, x.title, x.points, x.pair
  from jsonb_to_recordset(p_finalists) as x(title text, points int, pair jsonb)
  on conflict (session_id, title) do update set points = excluded.points, pair = excluded.pair
  where clubhouse_finalists.points is distinct from excluded.points
     or clubhouse_finalists.pair   is distinct from excluded.pair;

  -- ── attendance ────────────────────────────────────────────────────
  -- DO NOTHING, not DO UPDATE, and this is not a shortcut.
  --
  -- The 005 guard refuses present -> booked and stamps updated_at on any
  -- update at all. A uniform upsert that sent `status` would abort the entire
  -- seven-table publish the moment one player had already been checked in —
  -- the single most likely way a real night fails at 10pm. Publish also has
  -- no better information than a row that already exists: a check-in knows
  -- the time, Publish only knows they were here.
  insert into clubhouse_attendance
    (session_id, player_id, status, source, checked_in_at, recorded_by)
  select v_session_id, a.player_id, 'present', 'publish', null, v_actor
  from jsonb_to_recordset(p_attendance) as a(player_id text)
  on conflict (session_id, player_id) do nothing;

  -- ── aliases ───────────────────────────────────────────────────────
  -- coalesce on confirmed_by keeps "who confirmed this mapping" from
  -- decaying into "who published last". The 006 audit trigger is already
  -- guarded on player_id changing, so a re-press writes no history row.
  insert into clubhouse_player_alias (kind, value, player_id, verified, confirmed_by)
  select x.kind, x.value, x.player_id, true, v_actor
  from jsonb_to_recordset(p_aliases) as x(kind text, value text, player_id text)
  on conflict (kind, value) do update set player_id = excluded.player_id
  where clubhouse_player_alias.player_id is distinct from excluded.player_id;

  select jsonb_build_object(
    'session_id', v_session_id,
    'pairs',      (select count(*) from clubhouse_pairs      where session_id = v_session_id),
    'results',    (select count(*) from clubhouse_results    where session_id = v_session_id),
    'champions',  (select count(*) from clubhouse_champions  where session_id = v_session_id),
    'finalists',  (select count(*) from clubhouse_finalists  where session_id = v_session_id),
    'attendance', (select count(*) from clubhouse_attendance where session_id = v_session_id),
    'aliases',    (select count(*) from clubhouse_player_alias)
  ) into v_counts;

  return v_counts;
end
$$;

-- anon must not be able to call this at all: DEFINER would run it as the
-- owner, and the gate inside would be the only thing standing between the
-- publishable key and the club's published record. Two locks, not one.
revoke execute on function publish_session(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon;
grant   execute on function publish_session(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
