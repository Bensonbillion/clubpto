-- 012: the welcome email's bookkeeping on league_registrations.
--
-- The league-welcome Edge Function (supabase/functions/league-welcome)
-- sweeps this table once a minute and emails each new signup. It needs
-- three columns to do that safely: a claim stamp, so two sweeps never email
-- the same person; an attempt count, so a broken mailbox does not retry
-- forever; and the last error, so a failure is readable in the dashboard
-- without opening the function logs. The function is the only writer of
-- all three, through the secret key.
--
-- The browser's insert grant is narrowed at the same time. 011 granted
-- insert on the whole table, which after this migration would let a direct
-- API call pre-stamp welcome_sent_at and skip the email, or seed a failure
-- count. The grant now names the ten columns the form sends
-- (src/league/submitRegistration.ts, buildRegistrationRow) and nothing
-- else. id and created_at come from their defaults, which needs no
-- privilege. The insert policy from 011 stays as it is, and anon still has
-- no select, update or delete.
--
-- Re-runnable: revoking the table-level insert also drops any column-level
-- insert privileges, and the grant puts the column list back.

alter table public.league_registrations
  add column if not exists welcome_sent_at timestamptz,
  add column if not exists welcome_attempts int not null default 0,
  add column if not exists welcome_error text;

comment on column public.league_registrations.welcome_sent_at is
  'Claim and completion stamp for the welcome email. Set by the league-welcome function before it sends, cleared again if the send fails. Null means not yet welcomed.';
comment on column public.league_registrations.welcome_attempts is
  'Failed welcome sends so far. The sweep gives up at 5; reset to 0 to retry after fixing the cause. An address that is not a single mailbox is parked at 5 straight away.';
comment on column public.league_registrations.welcome_error is
  'Message from the last failed welcome send, addresses redacted, truncated to 500 characters. Cleared on success.';

-- The browser keeps insert, but only on the columns the form sends.
revoke insert on public.league_registrations from anon, authenticated;
grant insert (
  season,
  first_name,
  last_name,
  email,
  phone,
  division,
  experience,
  instagram,
  consent,
  source
) on public.league_registrations to anon, authenticated;
