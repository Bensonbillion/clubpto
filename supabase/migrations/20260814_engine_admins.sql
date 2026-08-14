-- Who is allowed to run a night.
--
-- WHY AN ALLOWLIST AND NOT `to authenticated`:
-- the clubhouse and the engine now share one Supabase project, and the
-- clubhouse hands a passwordless login to every player on the 66-name
-- roster. A policy of `to authenticated` would therefore let any member who
-- signed in at /club write the row holding a live session. That is barely
-- better than anon. Membership in this table is the actual boundary.
--
-- Idempotent: safe to re-run.

create table if not exists engine_admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  note      text,
  added_at  timestamptz not null default now()
);

alter table engine_admins enable row level security;

-- An admin may see the allowlist (so the app can tell you why you are
-- locked out). Nobody can modify it from the browser: adding an admin is a
-- deliberate act in the SQL editor.
drop policy if exists "engine_admins self read" on engine_admins;
create policy "engine_admins self read"
  on engine_admins for select to authenticated
  using (user_id = auth.uid());

-- Seed: the owner's account, already created by the clubhouse sign-in.
insert into engine_admins (user_id, note)
values ('9d3a9efc-6630-41c0-a999-a75b4cd802c8', 'Benson — owner')
on conflict (user_id) do nothing;

-- Helper used by the game_state policies. SECURITY DEFINER so the check
-- itself is not subject to engine_admins' own RLS.
create or replace function is_engine_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from engine_admins a where a.user_id = auth.uid())
$$;

-- To add the second admin later: have them sign in at /manage once so the
-- auth user exists, then
--   insert into engine_admins (user_id, note)
--   select id, 'second admin' from auth.users where email = 'them@example.com';
