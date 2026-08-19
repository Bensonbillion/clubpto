-- Clubhouse migration 008: adding a member, at booking time.
--
-- APPLY: paste into the Supabase SQL editor (project flahcijysipymafazhxq).
-- Idempotent: safe to re-run.
--
-- REQUIRES 001 (clubhouse_roster), 006 (clubhouse_player_alias) and
-- is_engine_admin() from supabase/migrations/20260814_engine_admins.sql.
--
-- ROLLBACK:
--   drop function if exists upsert_roster_member(text,text,text,text);
--   drop table    if exists clubhouse_roster_contact;
--
-- ---------------------------------------------------------------------------
-- WHY A SEPARATE CONTACT TABLE, AND NOT TWO COLUMNS ON clubhouse_roster
--
-- The roster read policy is `is_engine_admin() OR hidden = false OR you own
-- the row`, so every one of the 66 members can read every non-hidden roster
-- row. Postgres RLS is ROW-level: there is no way to let a member see a
-- name on that table and not see an email sitting beside it. Adding
-- email and phone as columns would publish the club's whole contact list to
-- anyone who signs in at /club.
--
-- So contact details live in their own table, admin-only in all four verbs.
-- This is not a parallel person table — clubhouse_roster is still the person,
-- and this is keyed to it one-to-one. Nothing here is required.
-- ---------------------------------------------------------------------------

create table if not exists clubhouse_roster_contact (
  player_id  text primary key references clubhouse_roster (player_id) on delete cascade,
  email      text,
  phone      text,
  updated_at timestamptz not null default now()
);

alter table clubhouse_roster_contact enable row level security;

drop policy if exists "roster contact admin read"   on clubhouse_roster_contact;
drop policy if exists "roster contact admin write"  on clubhouse_roster_contact;
drop policy if exists "roster contact admin update" on clubhouse_roster_contact;
drop policy if exists "roster contact admin delete" on clubhouse_roster_contact;

create policy "roster contact admin read"   on clubhouse_roster_contact for select to authenticated using (is_engine_admin());
create policy "roster contact admin write"  on clubhouse_roster_contact for insert to authenticated with check (is_engine_admin());
create policy "roster contact admin update" on clubhouse_roster_contact for update to authenticated using (is_engine_admin()) with check (is_engine_admin());
create policy "roster contact admin delete" on clubhouse_roster_contact for delete to authenticated using (is_engine_admin());

-- Nothing for anon, and deliberately nothing for a plain member — not even
-- their own row. A member who wants their email changed asks the club; the
-- alternative is a self-service write path on contact details, which is a
-- bigger surface than this step is buying.

-- ---------------------------------------------------------------------------
-- ONE WRITE PATH
--
-- Both the roster screen and the Publish confirm's "someone new" call this,
-- and so will the Acuity webhook when it lands. That is the whole reason it
-- is a database function rather than a TypeScript helper: a webhook runs
-- server-side and cannot call anything in the browser bundle. If the manual
-- path wrote rows a webhook would have to write differently, automation
-- would be a rewrite instead of one more caller.
--
-- SECURITY DEFINER because clubhouse_roster has no INSERT policy at all —
-- 001 created a SELECT policy and assumed a service-role writer that never
-- arrived. The gate is written out as the first statement, and it admits two
-- callers: an engine admin (the screens) and the service role (the webhook).
-- ---------------------------------------------------------------------------

create or replace function upsert_roster_member(
  p_display_name text,
  p_email        text default null,
  p_phone        text default null,
  -- Pass an existing id to EDIT that member. Null creates one.
  p_player_id    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text := btrim(coalesce(p_display_name, ''));
  v_slug  text;
  v_id    text;
  v_n     int := 1;
  v_created boolean := false;
begin
  if not (is_engine_admin() or auth.role() = 'service_role') then
    raise exception using errcode = '42501',
      message = 'You are not signed in as a court manager admin, so nothing was saved.';
  end if;

  if v_name = '' then
    raise exception using errcode = '22023',
      message = 'A member needs a name.';
  end if;

  if p_player_id is not null then
    -- Editing. The name and contact details move; the id never does, because
    -- aliases and attendance point at it.
    update clubhouse_roster set display_name = v_name, updated_at = now()
     where player_id = p_player_id;
    if not found then
      raise exception using errcode = '23503',
        message = 'That member no longer exists.';
    end if;
    v_id := p_player_id;
  else
    -- p-benson, p-timi-olaoye. Readable, and stable once minted.
    v_slug := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
    v_slug := btrim(v_slug, '-');
    if v_slug = '' then v_slug := 'member'; end if;
    v_id := 'p-' || v_slug;
    -- Two real people can share a name (p-timi and p-timi-olaoye already do),
    -- so a collision suffixes rather than merging them into one row.
    while exists (select 1 from clubhouse_roster r where r.player_id = v_id) loop
      v_n := v_n + 1;
      v_id := 'p-' || v_slug || '-' || v_n;
    end loop;

    -- claimable true: a member who cannot claim their own name is invisible
    -- to themselves with no way to discover it. `hidden` covers the genuine
    -- exception and is the flag with a UI behind it.
    insert into clubhouse_roster (player_id, display_name, claimable)
    values (v_id, v_name, true);
    v_created := true;
  end if;

  -- Contact details are optional at every entry point. The 11pm path sends
  -- neither; the roster screen may send both; either can be filled in later.
  -- Null means "not supplied", never "erase what is there".
  if p_email is not null or p_phone is not null then
    insert into clubhouse_roster_contact (player_id, email, phone)
    values (v_id, nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''))
    on conflict (player_id) do update set
      email      = coalesce(nullif(btrim(excluded.email), ''), clubhouse_roster_contact.email),
      phone      = coalesce(nullif(btrim(excluded.phone), ''), clubhouse_roster_contact.phone),
      updated_at = now();
  end if;

  return jsonb_build_object('player_id', v_id, 'display_name', v_name, 'created', v_created);
end
$$;

revoke execute on function upsert_roster_member(text,text,text,text) from public, anon;
grant   execute on function upsert_roster_member(text,text,text,text) to authenticated, service_role;
