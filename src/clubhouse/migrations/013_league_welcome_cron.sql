-- 013: the welcome sweep, once a minute, from inside the database.
--
-- pg_cron calls the league-welcome Edge Function every minute through
-- pg_net, with the project's secret key read from Vault at call time. The
-- function does the rest (supabase/functions/league-welcome/index.ts): it
-- picks up signups older than four minutes that have not been welcomed and
-- emails them. There is no insert trigger on purpose. One mechanism, one
-- code path, and a call that fails is simply retried a minute later.
--
-- Prerequisites, in this order. Each step is checkable before the next.
--
--   1. Run 012_league_welcome.sql (the welcome_* columns and the narrowed
--      insert grant).
--
--   2. Deploy the function with verify_jwt off, and set its secrets in
--      Dashboard > Edge Functions > Secrets:
--        GMAIL_USER, GMAIL_APP_PASSWORD, LEAGUE_DEPOSIT_EMAIL
--      (supabase functions deploy league-welcome
--         --project-ref flahcijysipymafazhxq --use-api)
--
--   3. Create the Vault secret named league_welcome_key holding the
--      project's default sb_secret_... key (Settings > API Keys). Prefer
--      Dashboard > Integrations > Vault. The SQL form also works:
--        select vault.create_secret(
--          '<sb_secret_...>', 'league_welcome_key', 'league-welcome sweep auth');
--      but the SQL editor keeps query history, so run it as an unsaved
--      query and clear it from the history afterwards. The key is never
--      written into this file or into cron.job; the job reads it from
--      vault.decrypted_secrets each run.
--      If Settings > API Keys shows only the legacy anon and service_role
--      keys, either click Create new API keys first and store the
--      sb_secret_ default, or store the legacy service_role key instead:
--      the function falls back to it when SUPABASE_SECRET_KEYS is absent.
--      Whichever key goes in Vault must be the one the function runtime
--      has, or every sweep answers 401.
--
--   4. Test the function with the test_to hook (see the README next to
--      index.ts) and confirm the email arrives.
--
--   5. Then run this file.
--
-- cron.schedule with an existing job name replaces that job, so running
-- this again is an upsert, not a duplicate.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- pg_net's positional order is (url, body, params, headers, timeout), so
-- the arguments are named. Keep it that way.
--
-- timeout_milliseconds is the caller's patience, not the function's. The
-- function claims no new rows after twenty seconds, so a full batch
-- normally answers well inside thirty; a row here with timed_out = true
-- usually means one stalled SMTP send, not a dead function. Claims are
-- per row and the function finishes on its own, so nothing is lost or
-- doubled either way. Raise this only if timed_out rows become routine.
select cron.schedule(
  'league-welcome-sweep',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://flahcijysipymafazhxq.supabase.co/functions/v1/league-welcome',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'league_welcome_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- Observability. Run by hand as needed.
--
-- Is the job scheduled, and is it firing?
--   select jobid, jobname, schedule, active from cron.job
--   where jobname = 'league-welcome-sweep';
--
--   select start_time, status, return_message
--   from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'league-welcome-sweep')
--   order by start_time desc limit 20;
--
-- Did the HTTP call reach the function? (pg_net keeps six hours.)
--   select id, created, status_code, timed_out, error_msg, content
--   from net._http_response
--   where status_code >= 400 or error_msg is not null or timed_out
--   order by created desc limit 20;
--
-- Anyone still waiting, and anyone the sweep has given up on?
--   select count(*) as pending
--   from public.league_registrations
--   where welcome_sent_at is null;
--
--   select id, created_at, welcome_attempts, welcome_error
--   from public.league_registrations
--   where welcome_sent_at is null and welcome_attempts > 0
--   order by created_at;
--
-- cron.job_run_details is never cleaned up on its own. Once a day is plenty:
--   select cron.schedule('job-run-details-cleanup', '0 0 * * *',
--     $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$);
--
-- Undo (stops the emails; leaves the columns and the function in place):
--   select cron.unschedule('league-welcome-sweep');
