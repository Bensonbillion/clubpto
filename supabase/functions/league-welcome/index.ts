// league-welcome: the PTO League welcome email, a few minutes after signup.
//
// /league/join writes one row into league_registrations and nothing else
// happened; Benson replied by hand. This function is the reply. pg_cron
// (src/clubhouse/migrations/013) posts here once a minute with the
// project's secret key on the apikey header, and every call is a sweep:
// up to ten rows that are at least four minutes old, not yet welcomed and
// under the retry cap, oldest first. The four minutes are deliberate. The
// email arrives four to five minutes after signup, which reads like a
// person got round to it rather than a machine firing on submit. There is
// no insert trigger; the sweep is the whole mechanism, so a sweep that
// fails is retried by the next one.
//
// Each row is CLAIMED before anything is sent: welcome_sent_at is stamped
// only where it is still null, returning the id, so two overlapping sweeps
// cannot both email the same person. A send that fails releases the claim,
// counts the attempt and keeps the SMTP error on the row for the dashboard,
// addresses redacted; after five failures the row is left alone. A send
// that succeeds clears the error. Two failures are handled differently. An
// address that is not one plain mailbox (the form only checks the shape,
// and nodemailer would fan a comma list out to every name in it) is parked
// at the cap straight away. An auth or connection failure ends the sweep,
// since the next row would fail the same way: a mistyped app password costs
// one attempt a minute, not ten, and Gmail sees one login, not ten.
//
// Every SMTP step has a short timeout and the sweep claims no new rows
// after twenty seconds, so a stalled connection surfaces as an error and
// releases the claim instead of holding it until the isolate is killed.
// The residual case is a send Gmail accepted whose reply never arrived:
// the send times out, the claim is released and the person gets a second
// copy on the next sweep, which at this volume is the right trade.
//
// Transport is Gmail SMTP over implicit TLS on port 465, the one SMTP port
// Supabase leaves open (25 and 587 are blocked). Multipart: the plain text
// and a light branded HTML version of the same copy, both from template.ts,
// one link.
//
// Auth: the caller sends one of the project's secret keys (an sb_secret_
// key or the legacy service role key) on the "apikey" header, compared in
// constant time against the runtime's own copies. verify_jwt is off for
// this function (supabase/config.toml): the platform check only
// understands JWTs and the sb_secret_ keys are not JWTs.
//
// Secrets (Dashboard > Edge Functions > Secrets):
//   GMAIL_USER            the sending Gmail address
//   GMAIL_APP_PASSWORD    a 16-character app password for it, spaces removed
//   LEAGUE_DEPOSIT_EMAIL  where e-transfers go; defaults to GMAIL_USER
//   LEAGUE_EMAIL_LOGO_URL the wordmark in the HTML header; defaults to the
//                         copy the site serves at clubpto.com/email/
//
// Test hook: POST {"test_to": "you@example.com"} sends the template with
// sample data to that address and touches nothing in the database.
//
// Responses and logs carry counts and row ids only, never names or emails.

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9.1.1";
import { renderWelcome } from "./template.ts";

const DELAY_MINUTES = 4;
const BATCH = 10;
const MAX_ATTEMPTS = 5;
const ERROR_MAX_CHARS = 500;

// The sweep claims no new rows once this much of the call has gone by;
// whatever is left waits for the next minute. pg_cron gives the call
// thirty seconds, and this keeps a normal batch well inside that.
const SWEEP_BUDGET_MS = 20_000;

// nodemailer's defaults (two minutes to connect, ten minutes of socket
// silence) outlast the function's own wall clock. These do not.
const SMTP_TIMEOUTS = {
  dnsTimeout: 10_000,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
};

// One mailbox, with nothing nodemailer or Gmail could read as a list or a
// display name. The table's own check only looks at length and an "@".
const SINGLE_ADDRESS = /^[^\s,;<>"'()]+@[^\s,;<>"'()@]+$/;

// nodemailer codes that mean the transport is broken, not the recipient.
// The next row would fail the same way, so the sweep stops at the first.
const TRANSPORT_ERROR_CODES = new Set([
  "EAUTH",
  "ECONNECTION",
  "EDNS",
  "ETLS",
  "ETIMEDOUT",
  "ESOCKET",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// The project's secret keys as the runtime provides them. A project on the
// new keys carries a JSON dict of them, keyed by name, and still has the
// legacy service role key beside it. Every one of them is a server-only
// credential for this project, so any of them opens this function: the
// Vault entry the sweep sends may hold whichever one was pasted.
const secretKeyValues = (parsed: unknown): string[] => {
  if (!parsed || typeof parsed !== "object") return [];
  return Object.values(parsed as Record<string, unknown>).flatMap((v) => {
    if (typeof v === "string" && v) return [v];
    // Tolerate a future shape where each entry is an object with the key.
    const nested = (v as { api_key?: unknown } | null)?.api_key;
    return typeof nested === "string" && nested ? [nested] : [];
  });
};

const acceptedKeys = (): string[] => {
  const keys: string[] = [];
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      keys.push(...secretKeyValues(JSON.parse(raw)));
    } catch {
      // Unparseable: the legacy key below still counts.
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) keys.push(legacy);
  return keys;
};

// The key the function itself uses against the database: the default
// secret key when there is one, otherwise the legacy service role key.
const secretKey = (): string | null => {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const def = (JSON.parse(raw) as { default?: unknown } | null)?.default;
      if (typeof def === "string" && def) return def;
    } catch {
      // Unparseable: fall through to the legacy key.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;
};

// Constant-time equality: the loop always runs over the longer input and
// every byte is folded into one accumulator, so the time taken does not
// depend on where the first difference is.
const timingSafeEqual = (a: string, b: string): boolean => {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const n = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < n; i++) {
    const xi = i < x.length ? x[i] : 0;
    const yi = i < y.length ? y[i] : 0;
    diff |= xi ^ yi;
  }
  return diff === 0;
};

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

const errorCode = (e: unknown): string | undefined => {
  if (!e || typeof e !== "object") return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

// SMTP errors can quote the recipient. Neither the row nor the logs get
// the address, only the shape of what went wrong.
const redact = (s: string): string =>
  s.replace(/[^\s@<>"',;]+@[^\s@<>"',;]+/g, "[email]");

// A failure that retrying cannot fix; the row is parked at the cap.
class PermanentSendError extends Error {}

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const mailer = () => {
  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass) return null;
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    // Implicit TLS, written as a literal on purpose: Boolean("false") is
    // true, so this must never be derived from an env string.
    secure: true,
    auth: { user, pass },
    ...SMTP_TIMEOUTS,
  });
  const from = `Club PTO <${user}>`;
  const depositEmail = Deno.env.get("LEAGUE_DEPOSIT_EMAIL") || user;
  // Unset means the wordmark on clubpto.com; set it to move the image
  // without a redeploy.
  const logoUrl = Deno.env.get("LEAGUE_EMAIL_LOGO_URL") || undefined;
  const send = (mail: Mail) =>
    new Promise<void>((resolve, reject) => {
      transport.sendMail(
        {
          from,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        },
        (error: Error | null) => (error ? reject(error) : resolve()),
      );
    });
  return { send, depositEmail, logoUrl };
};

interface Pending {
  id: string;
  first_name: string;
  email: string;
  division: string;
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const key = secretKey();
  if (!key) return json({ error: "no secret key" }, 500);
  // Every candidate is compared, so the time taken does not say which one
  // matched or whether any did.
  const presented = (req.headers.get("apikey") ?? "").trim();
  let authorized = false;
  for (const candidate of acceptedKeys()) {
    if (timingSafeEqual(presented, candidate)) authorized = true;
  }
  if (!authorized) return json({ error: "unauthorized" }, 401);

  // The sweep is called with an empty body or {}; both mean "sweep".
  let body: { test_to?: unknown } = {};
  try {
    const raw = (await req.text()).trim();
    if (raw) body = JSON.parse(raw);
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "bad json" }, 400);
  }

  const mail = mailer();
  if (!mail) return json({ error: "smtp not configured" }, 500);

  if (body.test_to !== undefined) {
    const to = typeof body.test_to === "string" ? body.test_to.trim() : "";
    if (!to || to.length > 254 || !SINGLE_ADDRESS.test(to)) {
      return json({ error: "bad test_to" }, 400);
    }
    const rendered = renderWelcome({
      firstName: "Benson",
      division: "mens",
      depositEmail: mail.depositEmail,
      logoUrl: mail.logoUrl,
    });
    try {
      await mail.send({ to, ...rendered });
    } catch (e) {
      const message = redact(errorMessage(e)).slice(0, ERROR_MAX_CHARS);
      console.error(`league-welcome: test send failed: ${message}`);
      return json({ test: false, error: message }, 502);
    }
    return json({ test: true });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false },
  });

  const cutoff = new Date(Date.now() - DELAY_MINUTES * 60_000).toISOString();
  const { data: rows, error } = await db
    .from("league_registrations")
    .select("id, first_name, email, division")
    .is("welcome_sent_at", null)
    .lt("welcome_attempts", MAX_ATTEMPTS)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error(`league-welcome: select failed: ${redact(error.message)}`);
    return json({ error: error.message }, 500);
  }

  const pending = (rows ?? []) as Pending[];
  const deadline = startedAt + SWEEP_BUDGET_MS;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let left = 0;

  for (let i = 0; i < pending.length; i++) {
    if (Date.now() > deadline) {
      left = pending.length - i;
      break;
    }
    const row = pending[i];

    // Claim: only the sweep that flips null to a timestamp goes on to send.
    // The returned attempts count is the one to increment; it was read
    // under the claim, so no other sweep can have moved it since.
    const { data: claimed, error: claimError } = await db
      .from("league_registrations")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("welcome_sent_at", null)
      .select("id, welcome_attempts");
    if (claimError) {
      console.error(`league-welcome: claim failed for ${row.id}: ${redact(claimError.message)}`);
      failed++;
      continue;
    }
    const claim = claimed?.[0] as { id: string; welcome_attempts: number } | undefined;
    if (!claim) {
      skipped++;
      continue;
    }

    try {
      if (!SINGLE_ADDRESS.test(row.email)) {
        throw new PermanentSendError("recipient is not a single address");
      }
      const rendered = renderWelcome({
        firstName: row.first_name,
        division: row.division,
        depositEmail: mail.depositEmail,
        logoUrl: mail.logoUrl,
      });
      await mail.send({ to: row.email, ...rendered });
    } catch (e) {
      const permanent = e instanceof PermanentSendError;
      const code = errorCode(e);
      const message = redact(errorMessage(e)).slice(0, ERROR_MAX_CHARS);
      const { error: releaseError } = await db
        .from("league_registrations")
        .update({
          welcome_sent_at: null,
          welcome_attempts: permanent
            ? MAX_ATTEMPTS
            : Number(claim.welcome_attempts ?? 0) + 1,
          welcome_error: message,
        })
        .eq("id", row.id);
      if (releaseError) {
        // The row is stuck claimed and will not be retried; say so loudly.
        console.error(`league-welcome: ${row.id} stuck claimed after a failed send: ${redact(releaseError.message)}`);
      }
      console.error(`league-welcome: send failed for ${row.id}${code ? ` (${code})` : ""}: ${message}`);
      failed++;
      if (code && TRANSPORT_ERROR_CODES.has(code)) {
        left = pending.length - i - 1;
        console.error(`league-welcome: ${code} is a transport failure, ending the sweep early`);
        break;
      }
      continue;
    }

    const { error: clearError } = await db
      .from("league_registrations")
      .update({ welcome_error: null })
      .eq("id", row.id);
    if (clearError) {
      console.error(`league-welcome: sent ${row.id} but could not clear its error: ${redact(clearError.message)}`);
    }
    sent++;
    console.log(`league-welcome: sent ${row.id}`);
  }

  if (left > 0) {
    console.log(`league-welcome: ${left} rows left unclaimed for the next sweep`);
  }
  console.log(`league-welcome: sweep sent=${sent} failed=${failed} skipped=${skipped}`);
  return json({ sent, failed, skipped });
});
