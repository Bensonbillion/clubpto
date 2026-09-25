# league-welcome

The PTO League welcome email. A signup on /league/join lands in
`public.league_registrations` (clubhouse project `flahcijysipymafazhxq`);
this function sends the welcome a few minutes later.

## What it does

pg_cron (`src/clubhouse/migrations/013_league_welcome_cron.sql`) posts to
this function once a minute with the project's secret key on the `apikey`
header. Each call sweeps up to ten rows that are at least four minutes old,
have `welcome_sent_at` null and fewer than five attempts, oldest first. A row
is claimed (stamped) before the send so two sweeps cannot both email one
person; a failed send releases the claim, increments `welcome_attempts` and
stores the SMTP error in `welcome_error` with any addresses redacted. An
address that is not a single mailbox is parked at five attempts at once. An
auth or connection failure ends the sweep early, so a bad app password costs
one attempt a minute rather than ten. Every SMTP step has a short timeout and
the sweep claims no new rows after twenty seconds. Multipart over Gmail
SMTP, port 465, implicit TLS. The copy lives in `template.ts`, which is pure
and pinned by `src/league/__tests__/welcomeTemplate.test.ts`.

Responses and logs carry counts and row ids only.

## The HTML version

Each mail is multipart: the plain text as the text alternative, and an HTML
version that `renderWelcome` builds from the same rendered text, so the copy
exists once. The HTML is a light Club PTO shell: a dark header band with the
wordmark, the message on white, and a small dark footer with the Instagram
and site links; every string is escaped on the way in.

The wordmark is served by the site from `public/email/logo-wordmark-cream.png`,
so its default URL is `https://clubpto.com/email/logo-wordmark-cream.png`.
That file is not a copy of the site's transparent wordmark: it is an opaque
export, cream on `#1A1A1A`, 300 by 54 (twice the rendered 150 by 27, for
retina screens), because Gmail on iOS and Outlook for Windows invert the
whole mail for dark mode but leave images alone, and a transparent cream
wordmark would vanish on the inverted band. The test suite checks the file's
size and that it has no alpha channel. To regenerate it from the site asset:

```bash
magick src/assets/logo-wordmark-cream.png -filter Lanczos -resize 300x54 \
  -background '#1A1A1A' -alpha remove -alpha off -gravity center -extent 300x54 \
  -strip PNG24:public/email/logo-wordmark-cream.png
```

The URL only exists once the branch that adds `public/email/` is on main and
Vercel has deployed it. Until then clubpto.com answers that path with
index.html (a 200, so nothing logs an error) and the header shows the alt
text. Set `LEAGUE_EMAIL_LOGO_URL` in the function's secrets to an absolute
http(s) URL to load the image from somewhere else without a redeploy;
anything that is not an absolute http(s) URL falls back to the default.

## Secrets (Dashboard > Edge Functions > Secrets)

| name                    | value                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `GMAIL_USER`            | the sending Gmail address                                    |
| `GMAIL_APP_PASSWORD`    | a 16-character app password for that account, no spaces      |
| `LEAGUE_DEPOSIT_EMAIL`  | e-transfer address in the email; defaults to GMAIL_USER      |
| `LEAGUE_EMAIL_LOGO_URL` | absolute http(s) URL of the wordmark; defaults to clubpto.com |

The app password needs 2-Step Verification on the Google account
(myaccount.google.com/apppasswords). Never commit it.

`SUPABASE_URL`, `SUPABASE_SECRET_KEYS` and `SUPABASE_SERVICE_ROLE_KEY` are
provided by the runtime.

## Deploy

`verify_jwt = false` is set in `supabase/config.toml`. Either:

```bash
supabase functions deploy league-welcome --project-ref flahcijysipymafazhxq --use-api
```

then confirm JWT verification is OFF on the function's detail tab; the
setting has been known not to stick, and when it regresses every cron call
gets a silent 401. Or Dashboard > Edge Functions > Deploy a new function >
Via Editor, with both `index.ts` and `template.ts` as files, and the same
check afterwards (and again after every dashboard redeploy).

## Smoke test

Before the first send, make sure the wordmark actually loads: the HTML
header pulls `https://clubpto.com/email/logo-wordmark-cream.png`, which only
serves the image once the site deploy that adds `public/email/` has landed
on main. Either wait for that deploy, or set `LEAGUE_EMAIL_LOGO_URL` to a
URL that already serves the opaque export (a public Supabase Storage object,
for example); secrets apply on save, no redeploy. Without one of the two the
test mail arrives with alt text in the header band.

Sends the template with sample data to one address and touches nothing in
the database. `sb_secret_...` is the project's default secret key from
Settings > API Keys. If that page shows only the legacy anon and
service_role keys, either click Create new API keys first, or use the legacy
service_role key here and in Vault: the function falls back to it when
`SUPABASE_SECRET_KEYS` is absent. Whichever key you use must be the one the
function runtime has.

```bash
curl -i -X POST 'https://flahcijysipymafazhxq.supabase.co/functions/v1/league-welcome' \
  -H 'apikey: sb_secret_REPLACE_ME' \
  -H 'Content-Type: application/json' \
  -d '{"test_to": "you@example.com"}'
```

Expect `{"test":true}`. A 401 means the key is wrong or JWT verification is
still on; a 502 carries the SMTP error (Gmail's first login from a new IP
sometimes needs approving under the account's Security > Recent activity).

A sweep by hand is the same call with `-d '{}'` and answers
`{"sent":n,"failed":n,"skipped":n}`.

## Checking on it

```sql
-- Waiting (should be empty a few minutes after the last signup)
select id, created_at, welcome_attempts, welcome_error
from public.league_registrations
where welcome_sent_at is null
order by created_at;

-- Gave up (five failed attempts). Fix the cause, then reset:
--   update public.league_registrations set welcome_attempts = 0 where id = '<id>';
-- A welcome_error of "recipient is not a single address" is a bad signup,
-- not a mail problem; leave it parked.
select id, created_at, welcome_error
from public.league_registrations
where welcome_sent_at is null and welcome_attempts >= 5;

-- Is the cron firing?
select start_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'league-welcome-sweep')
order by start_time desc limit 10;
```

Function logs: Dashboard > Edge Functions > league-welcome > Logs.
