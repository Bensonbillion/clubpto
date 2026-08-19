// The manager door: a passcode in, a real Supabase session out.
//
// WHY THIS EXISTS: game_state is admin-only in the database (see
// 20260814_lock_game_state.sql) and that is not negotiable — it is the row a
// live night runs on. But the owner cannot be asked for an inbox at 8pm in a
// dark venue, and a magic link lands wherever the browser feels like landing.
// So the passcode becomes the credential and this function is the only thing
// that knows it: the code is compared against a secret that exists ONLY in the
// function's environment, never in a VITE_ var and never in the shipped bundle.
//
// On success it signs in ONE dedicated engine account — a member of
// engine_admins — and hands the browser that account's tokens. The client calls
// setSession() with them, so from RLS's point of view nothing changed: the
// policies still see a real, allowlisted user.
//
// SECRETS (set by the owner, never in this repo):
//   MANAGER_PASSCODE   the code the pad accepts
//   ENGINE_EMAIL       the dedicated engine account
//   ENGINE_PASSWORD    its password
// Supabase injects SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY automatically.
//
// Deploy:  supabase functions deploy manager-passcode --no-verify-jwt
// (--no-verify-jwt is REQUIRED: the whole point is that the caller has no JWT
// yet. Authorisation is the passcode plus the rate limit, not a bearer token.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import {
  DEFAULT_POLICY,
  isLockedOut,
  isPasscodeShape,
  lockoutRemaining,
  timingSafeEqual,
  type AttemptRecord,
} from "../_shared/passcodeRules.ts";

/** Owner-configurable. Six digits recommended; change here and on the pad. */
const PASSCODE_LENGTH = 6;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/**
 * Store a hash, never the address. The table is a rate limiter, not a log of
 * who was where — and it is one leak away from being exactly that.
 */
async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ outcome: "wrong" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const passcode = Deno.env.get("MANAGER_PASSCODE");
  const engineEmail = Deno.env.get("ENGINE_EMAIL");
  const enginePassword = Deno.env.get("ENGINE_PASSWORD");

  // Fail loudly-but-vaguely: the admin needs to know it is not their code, and
  // a passer-by learns nothing about which piece is missing.
  if (!url || !anon || !service || !passcode || !engineEmail || !enginePassword) {
    return json({ outcome: "misconfigured" }, 503);
  }

  let submitted: unknown;
  try {
    submitted = (await req.json())?.passcode;
  } catch {
    return json({ outcome: "wrong" }, 400);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";
  const ipHash = await hashIp(ip, passcode);

  // ---- rate limit BEFORE the comparison -----------------------------------
  // Checking the code first would let an attacker time the compare even while
  // locked out, and would log a "wrong" that the limiter then has to ignore.
  // Fetch window + lockout, not just window. The trip point can be older than
  // the window by the time the lockout is running down, and a limiter that
  // cannot see the failure that locked it will reopen the door early.
  const since = new Date(
    Date.now() - (DEFAULT_POLICY.windowMs + DEFAULT_POLICY.lockoutMs),
  ).toISOString();
  const { data: rows, error: readError } = await admin
    .from("manager_passcode_attempts")
    .select("at, ok")
    .eq("ip_hash", ipHash)
    .gte("at", since);

  if (readError) return json({ outcome: "misconfigured" }, 503);

  const attempts: AttemptRecord[] = (rows ?? []).map((r) => ({
    at: Date.parse(r.at as string),
    ok: Boolean(r.ok),
  }));
  const now = Date.now();

  if (isLockedOut(attempts, now)) {
    return json({ outcome: "locked", retryInMs: lockoutRemaining(attempts, now) }, 429);
  }

  const record = (ok: boolean) =>
    admin.from("manager_passcode_attempts").insert({ ip_hash: ipHash, ok });

  if (!isPasscodeShape(submitted, PASSCODE_LENGTH) ||
      !timingSafeEqual(submitted, passcode)) {
    await record(false);
    return json({ outcome: "wrong" }, 401);
  }

  // ---- mint the session ---------------------------------------------------
  // signInWithPassword is the only supported way to obtain a real session for
  // an existing account: supabase-js 2.90's admin API has createUser and
  // generateLink but no createSession. Verified against the installed typings
  // rather than copied from a snippet.
  const gate = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await gate.auth.signInWithPassword({
    email: engineEmail,
    password: enginePassword,
  });

  if (error || !data.session) {
    // The passcode was right but the engine account is wrong/absent. That is
    // our fault, not the admin's, and it must not read as "wrong passcode".
    await record(false);
    return json({ outcome: "misconfigured" }, 503);
  }

  await record(true);
  return json(
    {
      outcome: "ok",
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    200,
  );
});
