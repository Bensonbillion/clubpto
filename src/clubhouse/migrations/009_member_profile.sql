-- 009: the signup capture table. Every account that comes through the door
-- lands here with a name, an email, and a phone number — the club's
-- outreach book, one query to export.
--
-- Phone numbers are PII, so this table follows the project rule: RLS is
-- row-level, owner-only, in the same migration as the table. Plain
-- `to authenticated` is never a boundary here — every roster member holds a
-- login, so member-wide read would leak every phone number to every member.
-- Admins read through is_engine_admin(), same allowlist as 006/007/008.

create table if not exists public.clubhouse_member_profile (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clubhouse_member_profile enable row level security;

-- You see yours, nobody else's.
create policy member_profile_own_read on public.clubhouse_member_profile
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy member_profile_own_insert on public.clubhouse_member_profile
  for insert to authenticated
  with check (auth_user_id = auth.uid());

create policy member_profile_own_update on public.clubhouse_member_profile
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- The club reads the whole book.
create policy member_profile_admin_read on public.clubhouse_member_profile
  for select to authenticated
  using (public.is_engine_admin());
