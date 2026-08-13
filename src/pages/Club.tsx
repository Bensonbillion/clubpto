import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clubhouse as supabase } from "@/clubhouse/supabaseClient";
import logoWordmarkCream from "@/assets/logo-wordmark-cream.png";
import {
  claimPlayer,
  getMyIdentity,
  listClaimable,
  requestLoginCode,
  signOut,
  verifyLoginCode,
  type ClaimablePlayer,
  type ClubIdentity,
} from "@/clubhouse/auth/api";

// The clubhouse door (Wave 2, AUTH-1..6): email -> link or code -> claim -> in.
// One door, no passwords, no gated areas (ACC-1).
// Behind the door (Wave 3): the room itself, split into its own chunk.
const ClubhouseHome = lazy(() => import("@/clubhouse/ui/ClubhouseHome"));

type Stage = "loading" | "signedOut" | "codeSent" | "claim" | "home" | "revoked";

const Club = () => {
  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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
    resolve();
    // Magic-link landings establish the session asynchronously.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") resolve();
      if (event === "SIGNED_OUT") setStage("signedOut");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await requestLoginCode(email);
    setBusy(false);
    if (res.error) setError(res.error);
    else setStage("codeSent");
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await verifyLoginCode(email, code);
    setBusy(false);
    if (res.error) setError(res.error);
    // success flows through onAuthStateChange -> resolve()
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
                Your stats, your streaks, your nights. Enter your email and
                we'll send a sign-in link and a code. No passwords, ever.
              </p>
            </div>
            <form className="rly-form" style={{ marginTop: "2rem" }} onSubmit={sendCode}>
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
              <div className="rly-cta-row" style={{ marginTop: 0 }}>
                <button type="submit" className="rly-pill" disabled={busy}>
                  {busy ? "Sending" : "Send me a code ↗"}
                </button>
              </div>
            </form>
          </>
        )}

        {stage === "codeSent" && (
          <>
            <p className="rly-kicker">
              <span className="rly-dot" /> Check your email
            </p>
            <h1 className="rly-display rly-page__title">
              Almost <span className="rly-script">there.</span>
            </h1>
            <div className="rly-prose" style={{ marginTop: "1.6rem" }}>
              <p>
                We sent a sign-in email to {email}. Tap the link in it, or type
                the 6-digit code here. Either works.
              </p>
            </div>
            <form className="rly-form" style={{ marginTop: "2rem" }} onSubmit={submitCode}>
              <label>
                6-digit code
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <div className="rly-cta-row" style={{ marginTop: 0 }}>
                <button type="submit" className="rly-pill" disabled={busy || code.length < 6}>
                  {busy ? "Checking" : "Let me in ↗"}
                </button>
                <button
                  type="button"
                  className="rly-pill rly-pill--ghost"
                  disabled={busy}
                  onClick={() => sendCode(new Event("submit") as unknown as React.FormEvent)}
                >
                  Resend
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
