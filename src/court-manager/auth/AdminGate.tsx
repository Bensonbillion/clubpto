// The door on the court manager.
//
// WHY THIS EXISTS: game_state holds the live session — the 78KB row that a
// night runs on. It used to be readable AND writable with the anon key that
// ships inside the public bundle, so anyone who opened devtools could
// overwrite a session mid-night. That is not a privacy problem, it is an
// availability problem at the exact moment the product has to work.
//
// WHY NOT JUST `authenticated`: the clubhouse gives every player on the
// roster a passwordless login on this same Supabase project. Being signed in
// therefore cannot be the test. The database checks membership of
// engine_admins (see supabase/migrations/20260814_engine_admins.sql); this
// screen just gets an admin a session so those policies can see who they are.
//
// WHY A PASSCODE AND NOT AN EMAIL (Part B): an inbox is not available at 8pm
// in a dark venue, and a magic link lands wherever the browser decides — on
// this project the clubhouse owns a second auth client, so a tapped link could
// be consumed into the wrong storage slot and leave the manager still locked.
// The pad is now the door: the code goes to an Edge Function that holds the
// real secret, and the function returns a session for a dedicated engine
// account that is a member of engine_admins. The passcode is NOT in this
// bundle — grep the build for it and you will not find one.
//
// Email survives as a hidden recovery route, one tap below the pad, for the
// day the function is down.
//
// The session persists via refresh token, so this is a one-time login per
// device, not a courtside ritual.

import { useEffect, useState } from "react";
import { Delete, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  messageFor,
  type PasscodeOutcome,
} from "../../../supabase/functions/_shared/passcodeRules";

/** Must match PASSCODE_LENGTH in supabase/functions/manager-passcode. */
const PASSCODE_LENGTH = 6;

type Stage = "checking" | "locked" | "codeSent" | "notAdmin" | "ready";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("checking");
  const [entry, setEntry] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");

  const resolve = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setStage("locked");
      return;
    }
    // is_engine_admin() is SECURITY DEFINER, so this answers even though the
    // allowlist itself is not readable.
    //
    // Cast: src/integrations/supabase/types.ts is generated and predates this
    // function, so `rpc` types its name as `never`. Regenerating those types
    // needs the service-role key, which does not belong in this repo.
    const rpc = supabase.rpc as unknown as (
      fn: string
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
    const { data: ok, error: rpcError } = await rpc("is_engine_admin");
    if (rpcError) {
      // Fail closed on an unreadable answer rather than assuming admin.
      setMessage(rpcError.message);
      setStage("notAdmin");
      return;
    }
    setStage(ok ? "ready" : "notAdmin");
  };

  useEffect(() => {
    resolve();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") resolve();
      if (event === "SIGNED_OUT") setStage("locked");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── the pad ───────────────────────────────────────────────────── */

  const submit = async (code: string) => {
    setBusy(true);
    setMessage(null);
    let outcome: PasscodeOutcome = "unreachable";
    let retryInMs = 0;
    let tokens: { access_token: string; refresh_token: string } | null = null;

    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${base}/functions/v1/manager-passcode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ passcode: code }),
      });
      const body = await res.json().catch(() => null);
      outcome = (body?.outcome as PasscodeOutcome) ?? "unreachable";
      retryInMs = Number(body?.retryInMs ?? 0);
      if (outcome === "ok" && body?.access_token && body?.refresh_token) {
        tokens = { access_token: body.access_token, refresh_token: body.refresh_token };
      }
    } catch {
      // Network/DNS/CORS — distinct from a refused code, and says so.
      outcome = "unreachable";
    }

    if (tokens) {
      const { error } = await supabase.auth.setSession(tokens);
      if (error) {
        setBusy(false);
        setEntry("");
        setMessage(messageFor("unreachable"));
        return;
      }
      setBusy(false);
      setEntry("");
      await resolve(); // onAuthStateChange also fires; resolve() is idempotent.
      return;
    }

    setBusy(false);
    setEntry("");
    setMessage(messageFor(outcome, retryInMs));
  };

  const digit = (d: string) => {
    if (busy) return;
    const next = entry + d;
    setMessage(null);
    if (next.length === PASSCODE_LENGTH) {
      setEntry(next);
      void submit(next);
    } else {
      setEntry(next);
    }
  };

  /* ── email recovery (hidden by default) ────────────────────────── */

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      // Admins are added deliberately in SQL; this screen never creates one.
      // No emailRedirectTo: the code is typed here, so nothing should ever be
      // asked to land on a URL. A tapped link is how the session ended up in
      // the clubhouse's storage slot instead of this one.
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (err) setMessage(err.message);
    else setStage("codeSent");
  };

  const verifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: emailCode.trim(),
      type: "email",
    });
    setBusy(false);
    if (err) setMessage(err.message);
  };

  if (stage === "ready") return <>{children}</>;

  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--ink, #0a1810)" }}>
      <div className="w-full max-w-sm">{body}</div>
    </div>
  );

  if (stage === "checking") {
    return shell(<p className="text-center text-sm text-muted-foreground animate-pulse">Checking access…</p>);
  }

  if (stage === "notAdmin") {
    return shell(
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold text-cream">Not an admin account</h1>
        <p className="text-sm text-muted-foreground">
          This account is signed in but is not on the court manager allowlist.
          {message ? ` (${message})` : ""}
        </p>
        <button
          className="min-h-[44px] px-4 text-sm underline text-muted-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            setMessage(null);
            setStage("locked");
          }}
        >
          Use a different account
        </button>
      </div>
    );
  }

  if (stage === "codeSent") {
    return shell(
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-cream">Email recovery</h1>
          <p className="text-sm text-muted-foreground">
            Type the 6-digit code sent to {email}. Do not tap the link — the code
            signs you in here, where the manager is looking.
          </p>
        </div>
        <form onSubmit={verifyEmail} className="space-y-3">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoComplete="one-time-code"
            placeholder="000000"
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded bg-black/30 border border-white/15 text-cream tracking-[0.3em] text-center"
          />
          <button
            type="submit"
            disabled={busy || emailCode.length < 6}
            className="w-full min-h-[44px] rounded bg-cream text-black font-medium disabled:opacity-50"
          >
            {busy ? "Checking…" : "Let me in"}
          </button>
          <button type="button" className="w-full text-xs text-muted-foreground underline"
            onClick={() => { setStage("locked"); setRecovery(false); setMessage(null); }}>
            Back to the passcode
          </button>
        </form>
        {message && <p className="text-sm" style={{ color: "#e8f088" }} role="alert">{message}</p>}
      </div>
    );
  }

  // stage === "locked" — the pad, and only the pad.
  return shell(
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
          <Lock className="w-8 h-8 text-accent" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-2xl text-accent">Court Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {busy ? "Opening…" : `Enter the ${PASSCODE_LENGTH}-digit passcode`}
          </p>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        {Array.from({ length: PASSCODE_LENGTH }, (_, i) => (
          <div key={i} className={`w-3 h-3 rounded-full border ${
            i < entry.length ? "bg-accent border-accent" : "border-muted-foreground/40"}`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 justify-items-center">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
          k === "" ? <div key={i} /> : k === "del" ? (
            <button key={i} onClick={() => setEntry((c) => c.slice(0, -1))} aria-label="Delete digit"
              disabled={busy}
              className="w-16 h-16 rounded-full border border-muted-foreground/30 flex items-center justify-center text-muted-foreground disabled:opacity-40">
              <Delete className="w-5 h-5" />
            </button>
          ) : (
            <button key={i} onClick={() => digit(k)} disabled={busy}
              className="w-16 h-16 rounded-full border border-muted-foreground/30 text-2xl text-cream active:bg-accent/10 disabled:opacity-40">
              {k}
            </button>
          ))}
      </div>

      {message && (
        <p className="text-sm text-center" style={{ color: "#e8f088" }} role="alert">{message}</p>
      )}

      {/* Recovery, deliberately quiet: it is the path that needs an inbox. */}
      {recovery ? (
        <form onSubmit={sendEmail} className="space-y-2 pt-2 border-t border-white/10">
          <input
            type="email" required autoComplete="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded bg-black/30 border border-white/15 text-cream"
          />
          <button type="submit" disabled={busy}
            className="w-full min-h-[44px] rounded border border-white/20 text-cream text-sm disabled:opacity-50">
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setRecovery(true)}
          className="w-full text-xs text-muted-foreground/60 underline">
          Passcode not working? Use email instead
        </button>
      )}
    </div>
  );
}
