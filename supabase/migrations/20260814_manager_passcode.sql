-- The manager passcode door (Part B).
--
-- Pairs with supabase/functions/manager-passcode. Nothing here weakens
-- 20260814_lock_game_state.sql: game_state stays admin-only, and the passcode
-- path works by signing in a real member of engine_admins rather than by
-- reopening anon access.
--
-- Idempotent: safe to re-run.
--
-- ROLLBACK (if the door ever misbehaves): the email path still exists in
-- AdminGate under "Use email instead", so simply not deploying — or deleting —
-- the function returns you to where you were. Dropping this table only loses
-- the rate-limit history.

-- 1) Rate limiting + an audit trail for a public endpoint.
--    Only the service role touches this. No policy is created, and RLS is on,
--    so the anon key cannot read who has been knocking or forge a clean slate.
create table if not exists manager_passcode_attempts (
  id bigint generated always as identity primary key,
  -- SHA-256 of (secret || ip). A rate limiter needs to recognise a repeat
  -- caller; it does not need to be able to name them later.
  ip_hash text not null,
  ok boolean not null,
  at timestamptz not null default now()
);

alter table manager_passcode_attempts enable row level security;

-- The limiter reads a rolling window per caller; without this every check is a
-- full scan of every knock ever made.
create index if not exists manager_passcode_attempts_ip_at
  on manager_passcode_attempts (ip_hash, at desc);

-- 2) Keep the table from growing without bound. Attempts older than a day have
--    no bearing on a 15-minute window.
create or replace function prune_manager_passcode_attempts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from manager_passcode_attempts where at < now() - interval '1 day';
$$;

-- 3) The dedicated engine account.
--
-- OWNER STEP — this cannot be done in SQL alone, because creating an auth user
-- with a password is an auth-API operation, not a table insert:
--
--   1. Supabase dashboard -> Authentication -> Users -> Add user
--      email: engine@clubpto.com   (any address you control; it never receives
--      mail — the account exists only to hold a session)
--      password: generate a long random one
--      "Auto Confirm User": ON  (there is no inbox to confirm from)
--
--   2. Set the function secrets from those values:
--      supabase secrets set MANAGER_PASSCODE=...      (6 digits)
--      supabase secrets set ENGINE_EMAIL=engine@clubpto.com
--      supabase secrets set ENGINE_PASSWORD=...
--
--   3. Run the insert below to put that account on the allowlist.
--
-- Written as a lookup by email so it is safe to re-run and impossible to
-- mistype a UUID. It is a no-op until the account exists.
insert into engine_admins (user_id, note)
select u.id, 'engine account — passcode door'
from auth.users u
where u.email = 'engine@clubpto.com'
  and not exists (select 1 from engine_admins e where e.user_id = u.id);

-- 4) Verification, to run after the three steps above. Expect one row.
--    select u.email, e.note
--      from engine_admins e join auth.users u on u.id = e.user_id
--     where u.email = 'engine@clubpto.com';
