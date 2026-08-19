import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { clubhouse as supabase } from "@/clubhouse/supabaseClient";
import logoWordmarkCream from "@/assets/logo-wordmark-cream.png";
import {
  claimPlayer,
  ensureProfile,
  getMyIdentity,
  listClaimable,
  requestPasswordSetup,
  setNewPassword,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  type ClaimablePlayer,
  type ClubIdentity,
} from "@/clubhouse/auth/api";

// The clubhouse door: email + password -> claim -> in. Passwordless-era
// members set their first password once via the recovery email bridge.
// Behind the door (Wave 3): the room itself, split into its own chunk.
const ClubhouseHome = lazy(() => import("@/clubhouse/ui/ClubhouseHome"));

type Stage =
  | "loading"
  | "signedOut"
  | "confirmSent"
  | "resetSent"
  | "setPassword"
  | "claim"
  | "home"
  | "revoked";

const Club = () => {
  const recoveryRef = useRef(false);
  const [stage, setStage] = useState<Stage>("loading");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<ClubIdentity | null>(null);
  const [roster, setRoster] = useState<ClaimablePlayer[]>([]);
  const [search, setSearch] = useState("");
  const [consented, setConsented] = useState(false);

  const resolve = async () => {
    const id = await getMyIdentity();
    if (!id) {
      setStage("signedOut");
      return;
    }
    // Every signed-in member lands in the outreach book; insert-if-missing,
    // so this never overwrites anything. Not awaited — the door doesn't
    // wait on bookkeeping.
    void ensureProfile();
    setIdentity(id);
    if (id.revoked) setStage("revoked");
    else if (!id.playerId) {
      setRoster(await listClaimable());
      setStage("claim");
    } else setStage("home");
  };

  useEffect(() => {
    // Failed magic-link landings arrive as #error=...&error_code=otp_expired.
    // Surface a human message and clean the hash so refreshes start fresh.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errCode = hash.get("error_code");
    if (errCode) {
      setError(
        errCode === "otp_expired"
          ? "That sign-in link has expired. Links only last an hour. Enter your email and we'll send a fresh one."
          : hash.get("error_description") ?? "Sign-in didn't work. Try again."
      );
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (!recoveryRef.current) resolve();
    // Magic-link landings establish the session asynchronously.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // A recovery link fires PASSWORD_RECOVERY and SIGNED_IN; without the
      // ref, the SIGNED_IN resolve() would replace the set-password form
      // and the member would land in the room still passwordless.
      if (event === "PASSWORD_RECOVERY") {
        recoveryRef.current = true;
        setStage("setPassword");
      } else if (event === "SIGNED_IN" && !recoveryRef.current) {
        resolve();
      }
      if (event === "SIGNED_OUT") setStage("signedOut");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === "signup") {
      const res = await signUpWithPassword(email, password, fullName, phone);
      setBusy(false);
      if (res.error) setError(res.error);
      else if (res.confirmationPending) setStage("confirmSent");
      // else: session exists, onAuthStateChange -> resolve()
    } else {
      const res = await signInWithPassword(email, password);
      setBusy(false);
      if (res.error) setError(res.error);
      // success flows through onAuthStateChange -> resolve()
    }
  };

  const sendPasswordSetup = async () => {
    if (!email.trim()) {
      setError("Type your email above first, then tap Set a password.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await requestPasswordSetup(email);
    setBusy(false);
    if (res.error) setError(res.error);
    else setStage("resetSent");
  };

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await setNewPassword(password);
    setBusy(false);
    if (res.error) setError(res.error);
    else {
      recoveryRef.current = false;
      setPassword("");
      resolve();
    }
  };

  const claim = async (playerId: string) => {
    setBusy(true);
    setError(null);
    const res = await claimPlayer(playerId);
    setBusy(false);
    if (res.error) setError(res.error);
    else resolve();
  };

  const filtered = roster.filter((p) =>
    p.displayName.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="rly-page" style={{ paddingTop: 0 }}>
      {/* minimal door header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem clamp(1.2rem, 4.5vw, 4rem)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Link to="/">
          <img src={logoWordmarkCream} alt="Club PTO" style={{ height: "1.6rem", width: "auto" }} />
        </Link>
        {(stage === "home" || stage === "claim") && (
          <button
            className="rly-mono"
            style={{ background: "none", border: "none", color: "var(--chalk-dim)", fontSize: 14, cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase" }}
            onClick={async () => {
              await signOut();
              setStage("signedOut");
            }}
          >
            Sign out
          </button>
        )}
      </header>

      {stage === "home" && identity?.playerId ? (
        <Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--ink)" }} aria-busy="true" />}>
          <ClubhouseHome
            playerId={identity.playerId}
            displayName={identity.displayName ?? "player"}
          />
        </Suspense>
      ) : (
      <main className="rly-page__hero" style={{ maxWidth: 720 }}>
        {stage === "loading" && (
          <p className="rly-mono" style={{ color: "var(--chalk-dim)", fontSize: 15 }}>
            One second
          </p>
        )}

        {stage === "signedOut" && (
          <>
            <p className="rly-kicker">
              <span className="rly-dot" /> The clubhouse
            </p>
            <h1 className="rly-display rly-page__title">
              Come on <span className="rly-script">in.</span>
            </h1>
            <div className="rly-prose" style={{ marginTop: "1.6rem" }}>
              <p>
                {mode === "signin"
                  ? "Your stats, your streaks, your nights. Sign in and take your seat."
                  : "Create your account, then claim your name in the book."}
              </p>
            </div>
            <form className="rly-form" style={{ marginTop: "2rem" }} onSubmit={submitAuth}>
              {mode === "signup" && (
                <>
                  <label>
                    Full name
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      type="tel"
                      required
                      minLength={7}
                      autoComplete="tel"
                      placeholder="(416) 555 0100"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label>
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <div className="rly-cta-row" style={{ marginTop: 0 }}>
                <button type="submit" className="rly-pill" disabled={busy}>
                  {busy ? "One second" : mode === "signin" ? "Sign in ↗" : "Create account ↗"}
                </button>
                <button
                  type="button"
                  className="rly-pill rly-pill--ghost"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setMode(mode === "signin" ? "signup" : "signin");
                  }}
                >
                  {mode === "signin" ? "New here? Create account" : "Have an account? Sign in"}
                </button>
              </div>
            </form>
            <button
              type="button"
              className="rly-mono"
              style={{ marginTop: "1.4rem", background: "none", border: "none", color: "var(--chalk-dim)", fontSize: 13, cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase", padding: 0 }}
              disabled={busy}
              onClick={sendPasswordSetup}
            >
              Forgot your password, or used to sign in with a code? Set a password
            </button>
          </>
        )}

        {stage === "confirmSent" && (
          <>
            <p className="rly-kicker">
              <span className="rly-dot" /> Check your email
            </p>
            <h1 className="rly-display rly-page__title">
              Almost <span className="rly-script">there.</span>
            </h1>
            <div className="rly-prose" style={{ marginTop: "1.6rem" }}>
              <p>
                We sent a confirmation email to {email}. Tap the link inside
                and you're in. One time only, then it's just your password.
              </p>
            </div>
          </>
        )}

        {stage === "resetSent" && (
          <>
            <p className="rly-kicker">
              <span className="rly-dot" /> Check your email
            </p>
            <h1 className="rly-display rly-page__title">
              One <span className="rly-script">email.</span>
            </h1>
            <div className="rly-prose" style={{ marginTop: "1.6rem" }}>
              <p>
                We sent a set-your-password email to {email}. Tap the link in
                it, choose a password, and codes are behind you for good.
              </p>
            </div>
          </>
        )}

        {stage === "setPassword" && (
          <>
            <p className="rly-kicker">
              <span className="rly-dot" /> Nearly done
            </p>
            <h1 className="rly-display rly-page__title">
              Pick a <span className="rly-script">password.</span>
            </h1>
            <div className="rly-prose" style={{ marginTop: "1.6rem" }}>
              <p>This is the last time you'll ever need an email to get in.</p>
            </div>
            <form className="rly-form" style={{ marginTop: "2rem" }} onSubmit={submitNewPassword}>
              <label>
                New password
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <div className="rly-cta-row" style={{ marginTop: 0 }}>
                <button type="submit" className="rly-pill" disabled={busy || password.length < 6}>
                  {busy ? "Saving" : "Save and enter ↗"}
                </button>
              </div>
            </form>
          </>
        )}

        {stage === "claim" && (
          <>
            <p className="rly-kicker">
              <span className="rly-dot" /> You already have a profile
            </p>
            <h1 className="rly-display rly-page__title">
              Find your <span className="rly-script">name.</span>
            </h1>
            <div className="rly-prose" style={{ marginTop: "1.6rem" }}>
              <p>
                If you've played with us, you're already in the book. Claim
                your name and it's yours.
              </p>
            </div>
            <div className="rly-form" style={{ marginTop: "2rem" }}>
              <label>
                Search
                <input
                  type="text"
                  placeholder="Your first name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label
                style={{ flexDirection: "row", alignItems: "flex-start", gap: "0.8rem", textTransform: "none", letterSpacing: 0, fontFamily: "var(--f-body)", fontSize: 14, lineHeight: 1.5 }}
              >
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  style={{ marginTop: 3, width: "auto" }}
                />
                <span style={{ color: "var(--chalk-dim)" }}>
                  I'm good with Club PTO showing my name and my session results
                  (games, wins, championships, streaks, milestones) inside the
                  members-only clubhouse. If I win a championship, my name can
                  appear on the public page that week. I can switch to a
                  nickname or hide my profile completely at any time.
                </span>
              </label>
              <div style={{ display: "grid", gap: "0.6rem", maxHeight: 320, overflowY: "auto" }}>
                {filtered.length === 0 && (
                  <p className="rly-mono" style={{ color: "var(--chalk-dim)", fontSize: 14 }}>
                    {roster.length === 0
                      ? "The roster hasn't been loaded yet. Message the club."
                      : "No match. Try fewer letters, or message the club."}
                  </p>
                )}
                {filtered.slice(0, 30).map((p) => (
                  <button
                    key={p.playerId}
                    className="rly-pill rly-pill--ghost"
                    style={{ justifyContent: "flex-start" }}
                    disabled={busy || !consented}
                    onClick={() => claim(p.playerId)}
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {stage === "home" && identity && !identity.playerId && (
          <>
            <p className="rly-kicker">
              <span className="rly-dot" /> The clubhouse
            </p>
            <h1 className="rly-display rly-page__title">
              You're <span className="rly-script">in.</span>
            </h1>
            <div className="rly-prose" style={{ marginTop: "1.6rem" }}>
              <p>Claim your name to take your seat in the room.</p>
            </div>
          </>
        )}

        {stage === "revoked" && (
          <>
            <h1 className="rly-display rly-page__title">
              Hold <span className="rly-script">up.</span>
            </h1>
            <div className="rly-prose" style={{ marginTop: "1.6rem" }}>
              <p>
                This profile link was reset by the club. Message us and we'll
                get you back in.
              </p>
            </div>
          </>
        )}

        {error && (
          <p
            className="rly-mono"
            style={{ marginTop: "1.4rem", color: "var(--volt)", fontSize: 15 }}
            role="alert"
          >
            {error}
          </p>
        )}
      </main>
      )}
    </div>
  );
};

export default Club;
