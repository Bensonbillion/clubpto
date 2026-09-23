-- 011: PTO League registrations, written by the public /league/join form.
--
-- The join page used to confirm a registration without sending it anywhere
-- (leadCaptureUrl was never pinned). Each submission now lands here as one
-- row. The public site is write-only: anon and authenticated can insert,
-- and nothing else. No select, update, or delete policies exist, so a
-- visitor can never read anyone's details back, including their own. The
-- table's check constraints do the validation; the insert policy is open.
--
-- Benson reads signups in the Supabase dashboard (service role):
--   select created_at, first_name, last_name, email, phone, division,
--          experience, instagram
--   from public.league_registrations
--   order by created_at desc;

create table if not exists public.league_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  season int not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  division text not null,
  experience text not null,
  instagram text,
  consent boolean not null,
  source text,
  constraint reg_first_name_len check (char_length(first_name) between 1 and 100),
  constraint reg_last_name_len check (char_length(last_name) between 1 and 100),
  constraint reg_email_shape check (
    char_length(email) between 3 and 254
    and position('@' in email) > 1
    and email = lower(email)
  ),
  constraint reg_phone_len check (char_length(phone) between 1 and 100),
  constraint reg_division check (division in ('mens', 'womens')),
  constraint reg_experience check (experience in ('few', 'developing', 'intermediate')),
  constraint reg_instagram_len check (instagram is null or char_length(instagram) <= 100),
  constraint reg_consent_given check (consent),
  constraint reg_source_len check (source is null or char_length(source) <= 100)
);

alter table public.league_registrations enable row level security;

-- Write-only for the browser: insert is the one privilege granted.
revoke all on public.league_registrations from anon, authenticated;
grant insert on public.league_registrations to anon, authenticated;

create policy league_registration_insert on public.league_registrations
  for insert to anon, authenticated
  with check (true);
