-- Clubhouse migration 006: the join the schema never had.
--
-- APPLY: paste into the Supabase SQL editor (project flahcijysipymafazhxq).
-- Idempotent: safe to re-run.
--
-- REQUIRES is_engine_admin() (supabase/migrations/20260814_engine_admins.sql)
-- and clubhouse_roster (src/clubhouse/migrations/001_clubhouse.sql).
--
-- ROLLBACK (in this order):
--   drop table    if exists clubhouse_player_alias;      -- takes its triggers
--   drop table    if exists clubhouse_player_alias_history;
--   drop function if exists clubhouse_player_alias_audit();
--
-- ---------------------------------------------------------------------------
-- WHY THIS TABLE EXISTS (C1 in docs/SCHEMA-MAP.md)
--
-- clubhouse_roster.player_id values are hand-authored slugs: p-benson,
-- p-timi-olaoye. The engine mints its own: pl-<base36>-<n>, csv_<normalized>,
-- plv4-<...>, and a legacy 9-character random. There is ZERO overlap and no
-- mapping code anywhere. Attendance is keyed on roster ids, so without this
-- table Step 2 cannot write a single row.
--
-- WHY NOT MATCH ON NAMES. Because "Timi" is two people. The seeded roster
-- holds p-timi ("Timi") and p-timi-olaoye ("Timi Olaoye"), and a silent
-- first-name match picks one of them at random and is unrecoverable by the
-- time anyone notices — the wrong person's attendance count just quietly
-- grows. Names may SUGGEST. Only an admin decides.
--
-- WHY GENERIC (kind/value) AND NOT A player_id COLUMN ON THE ROSTER. Because
-- one person accumulates handles: an engine id today, a second engine id the
-- moment a CSV re-import swaps it (see the id-churn note below), an email
-- later, maybe a phone. Many aliases point at one member; one alias points at
-- exactly one member, which is what the primary key says.
--
-- ID CHURN, the thing that makes this table earn its keep. v3's mergeRoster
-- (src/court-manager/rosterMerge.ts, attach()) REPLACES an existing csv_ id
-- with a stable incoming one when the same person is re-imported. The person
-- did not change; their engine id did. This table sees that as a new
-- unmapped id and asks once. The old alias stays, still pointing at the same
-- member, so last month's sessions keep resolving.
-- ---------------------------------------------------------------------------

create table if not exists clubhouse_player_alias (
  -- Constrained from day one. An unconstrained text column is how one table
  -- quietly becomes three tables' worth of junk. 'email' and 'phone' get
  -- added here by migration when something actually writes them.
  kind         text not null,
  value        text not null,

  player_id    text not null references clubhouse_roster (player_id) on delete restrict,

  -- True means a human admin looked at this and said yes. Engine ids may not
  -- exist in any other state (see the check below); the column is here
  -- because 'email' will one day arrive unverified from a member.
  verified     boolean not null default false,
  confirmed_by uuid references auth.users (id),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- "Unique on (kind, value)." One handle, one person.
  primary key (kind, value),

  constraint alias_kind check (kind in ('engine_player_id')),

  -- "Never auto-confirm on an exact name match" made structural: an
  -- unconfirmed engine alias cannot be stored at all, so no code path can
  -- create one by accident.
  constraint alias_engine_id_is_confirmed
    check (kind <> 'engine_player_id' or verified),
  constraint alias_engine_id_names_its_admin
    check (kind <> 'engine_player_id' or confirmed_by is not null)
);

create index if not exists clubhouse_player_alias_player
  on clubhouse_player_alias (player_id);

-- ---------------------------------------------------------------------------
-- Reassignment must be VISIBLE, not silent.
--
-- An admin who maps an engine id to the wrong member has to be able to fix
-- it — the same courtside-error reasoning that allows DELETE on attendance.
-- But a plain upsert would overwrite the old mapping leaving no trace, and
-- "whose attendance was this before?" is exactly the question someone will
-- ask three weeks later. Every change of player_id, and every deletion,
-- appends a row here first.
--
-- Append-only by construction: no UPDATE or DELETE policy exists.
-- ---------------------------------------------------------------------------

create table if not exists clubhouse_player_alias_history (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null,
  value            text not null,
  was_player_id    text not null,
  -- Null means the alias was DELETED rather than reassigned.
  now_player_id    text,
  was_confirmed_by uuid,
  was_created_at   timestamptz,
  changed_by       uuid references auth.users (id),
  changed_at       timestamptz not null default now()
);

create index if not exists clubhouse_player_alias_history_value
  on clubhouse_player_alias_history (kind, value, changed_at desc);

create or replace function clubhouse_player_alias_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    insert into clubhouse_player_alias_history
      (kind, value, was_player_id, now_player_id, was_confirmed_by, was_created_at, changed_by)
    values (old.kind, old.value, old.player_id, null, old.confirmed_by, old.created_at, auth.uid());
    return old;
  end if;

  -- An upsert that re-confirms the SAME mapping is not a reassignment and
  -- does not deserve a history row. Step 2 re-commits the whole confirmed
  -- set on every Publish; that must stay a no-op for anything unchanged.
  if new.player_id is distinct from old.player_id then
    insert into clubhouse_player_alias_history
      (kind, value, was_player_id, now_player_id, was_confirmed_by, was_created_at, changed_by)
    values (old.kind, old.value, old.player_id, new.player_id, old.confirmed_by, old.created_at, auth.uid());
    -- The reassignment starts its own clock; the original stands in history.
    new.created_at := now();
  end if;

  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists clubhouse_player_alias_audit_upd on clubhouse_player_alias;
create trigger clubhouse_player_alias_audit_upd
  before update on clubhouse_player_alias
  for each row execute function clubhouse_player_alias_audit();

drop trigger if exists clubhouse_player_alias_audit_del on clubhouse_player_alias;
create trigger clubhouse_player_alias_audit_del
  before delete on clubhouse_player_alias
  for each row execute function clubhouse_player_alias_audit();

-- ---------------------------------------------------------------------------
-- RLS, in the same migration as the tables.
--
-- Admin-only in both directions, which is stricter than clubhouse_attendance.
-- Nothing the room renders reads an alias: the seat reads attendance, which
-- is already keyed on roster ids. This table is admin machinery, and the one
-- thing it would leak to a member is which engine id belongs to whom.
-- ---------------------------------------------------------------------------

alter table clubhouse_player_alias         enable row level security;
alter table clubhouse_player_alias_history enable row level security;

drop policy if exists "alias admin read"   on clubhouse_player_alias;
drop policy if exists "alias admin insert" on clubhouse_player_alias;
drop policy if exists "alias admin update" on clubhouse_player_alias;
drop policy if exists "alias admin delete" on clubhouse_player_alias;

create policy "alias admin read"   on clubhouse_player_alias for select to authenticated using (is_engine_admin());
create policy "alias admin insert" on clubhouse_player_alias for insert to authenticated with check (is_engine_admin());
create policy "alias admin update" on clubhouse_player_alias for update to authenticated using (is_engine_admin()) with check (is_engine_admin());
create policy "alias admin delete" on clubhouse_player_alias for delete to authenticated using (is_engine_admin());

drop policy if exists "alias history admin read"   on clubhouse_player_alias_history;
drop policy if exists "alias history admin insert" on clubhouse_player_alias_history;

create policy "alias history admin read"
  on clubhouse_player_alias_history for select to authenticated using (is_engine_admin());
-- Insert exists only so the audit trigger can write as the admin who made the
-- change. There is deliberately no update or delete policy, and none for anon.
create policy "alias history admin insert"
  on clubhouse_player_alias_history for insert to authenticated with check (is_engine_admin());

-- ---------------------------------------------------------------------------
-- A GAP MIGRATION 005 LEFT, WHICH THIS STEP IS WHAT EXPOSES.
--
-- 005 narrowed the roster read to `hidden = false OR the reader owns the row`
-- and stopped there. That is correct for members and wrong for admins, and
-- nothing noticed because zero rows are hidden today.
--
-- The confirm screen builds its candidate list by reading clubhouse_roster as
-- the admin. Without an admin clause, a hidden member is not in that list, so
-- their engine id can never be mapped, so no attendance row is ever written
-- for them, so their own seat goes empty. Hiding is supposed to remove
-- someone from the room's surfaces, not stop the club recording that they
-- turned up. An admin already sees every name at check-in.
--
-- ROLLBACK for this policy alone: re-create it without the is_engine_admin()
-- clause, exactly as 005 has it.
-- ---------------------------------------------------------------------------

drop policy if exists "roster read for authenticated" on clubhouse_roster;
create policy "roster read for authenticated"
  on clubhouse_roster for select to authenticated
  using (
    is_engine_admin()
    or hidden = false
    or player_id in (
      select l.player_id from clubhouse_links l
      where l.auth_user_id = auth.uid() and not l.revoked
    )
  );

-- ---------------------------------------------------------------------------
-- HOW STEP 2 COMMITS THESE (the all-or-nothing rule)
--
-- The admin confirms names in the browser. Those confirmations are held in
-- memory and written by ONE statement at the moment of Publish:
--
--   insert into clubhouse_player_alias (kind, value, player_id, verified, confirmed_by)
--   values (...), (...), (...)
--   on conflict (kind, value) do update
--     set player_id = excluded.player_id, verified = excluded.verified,
--         confirmed_by = excluded.confirmed_by;
--
-- One statement is one transaction, so a bad row takes the whole set with it
-- and a cancelled Publish writes nothing. Do NOT write aliases one at a time
-- as the admin taps through the list: an admin confirming 24 names at 11pm
-- and closing the laptop halfway would leave the next Publish resolving some
-- players and re-asking for others, with nothing to say which was which.
--
-- ORDER WITHIN THE PUBLISH: aliases FIRST, then attendance and the session.
-- The two are not in one transaction — that would need a stored procedure
-- covering five tables — so one of them has to be able to land alone, and it
-- must be this one. An alias that outlives a failed Publish is simply a true
-- fact recorded early: re-running the Publish resolves those ids without
-- asking again. The reverse is corrupting. Attendance rows written from a
-- mapping that was never stored would be re-asked next time, answered
-- differently by a tired admin, and the same person would end up counted
-- under two roster members across two nights.
-- ---------------------------------------------------------------------------
