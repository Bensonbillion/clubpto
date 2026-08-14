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
// The session persists via refresh token, so this is a one-time login per
// device, not a courtside ritual.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Stage = "checking" | "signedOut" | "codeSent" | "notAdmin" | "ready";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("checking");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setStage("signedOut");
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
      setError(rpcError.message);
      setStage("notAdmin");
      return;
    }
    setStage(ok ? "ready" : "notAdmin");
  };

  useEffect(() => {
    resolve();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") resolve();
      if (event === "SIGNED_OUT") setStage("signedOut");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      // Admins are added deliberately in SQL; this screen never creates one.
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/manage` },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setStage("codeSent");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (err) setError(err.message);
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
          {error ? ` (${error})` : ""}
        </p>
        <button
          className="min-h-[44px] px-4 text-sm underline text-muted-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            setStage("signedOut");
          }}
        >
          Sign in as someone else
        </button>
      </div>
    );
  }

  return shell(
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-cream">Court Manager</h1>
        <p className="text-sm text-muted-foreground">
          {stage === "codeSent"
            ? `Enter the 6-digit code sent to ${email}, or tap the link in that email.`
            : "Admin sign-in. One time per device — it stays signed in."}
        </p>
      </div>

      {stage === "signedOut" ? (
        <form onSubmit={send} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded bg-black/30 border border-white/15 text-cream"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[44px] rounded bg-cream text-black font-medium disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded bg-black/30 border border-white/15 text-cream tracking-[0.3em] text-center"
          />
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="w-full min-h-[44px] rounded bg-cream text-black font-medium disabled:opacity-50"
          >
            {busy ? "Checking…" : "Let me in"}
          </button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline"
            onClick={() => setStage("signedOut")}
          >
            Use a different email
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm" style={{ color: "#e8f088" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
