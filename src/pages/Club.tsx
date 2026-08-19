import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { clubhouse as supabase } from "@/clubhouse/supabaseClient";
import logoWordmarkCream from "@/assets/logo-wordmark-cream.png";
import {
  acceptLinkInvite,
  ensureProfile,
  getMyIdentity,
  getMyInvite,
  getMyProfile,
  requestPasswordSetup,
  setNewPassword,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updateMyProfile,
  type ClubIdentity,
  type LinkInvite,
  type MemberProfile,
} from "@/clubhouse/auth/api";

// The clubhouse door: email + password -> in. Passwordless-era members set
// their first password once via the recovery email bridge.
//
// The find-your-name picker is retired (Benson, 2026-08-18): the door never
// lists members' names, and new accounts start from scratch as exactly who
// they signed up as. Members who linked a roster identity before keep it,
// and the room still renders their stats through that link.
const ClubhouseHome = lazy(() => import("@/clubhouse/ui/ClubhouseHome"));

type Stage =
  | "loading"
  | "signedOut"
  | "confirmSent"
  | "resetSent"
  | "setPassword"
  | "consentLink"
  | "home"
  | "revoked";

/**
 * The capture strip: shows only while the member's row is missing a phone
 * (or a name), saves once, then never appears again. "Later" hides it for
 * the visit; it returns next time because the book still has a gap.
 */
const ProfilePrompt = ({
  profile,
  onSaved,
}: {
  profile: MemberProfile;
  onSaved: () => void;
}) => {
  const needsName = !profile.fullName.trim();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await updateMyProfile(
      needsName ? { fullName: name, phone } : { phone }
    );
    setBusy(false);
    if (res.error) setError(res.error);
    else onSaved();
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--ink)",
    border: "1px solid var(--line)",
    color: "var(--chalk)",
    padding: "0.55rem 0.8rem",
    fontFamily: "var(--f-body)",
    fontSize: 14,
    minWidth: 170,
  };

  return (
    <div
      style={{
        borderBottom: "1px solid var(--line)",
        background: "var(--ink-2)",
        padding: "1.1rem clamp(1.2rem, 4.5vw, 4rem)",
      }}
    >
      <form
        onSubmit={save}
        style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", alignItems: "center" }}
      >
        <span
          className="rly-mono"
          style={{ color: "var(--chalk)", fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          One thing: {needsName ? "your name and number" : "what's your number?"}
        </span>
        {needsName && (
          <input
            type="text"
            required
            autoComplete="name"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          type="tel"
          required
          minLength={7}
          autoComplete="tel"
          placeholder="(416) 555 0100"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
        />
        <button
          type="submit"
          className="rly-pill"
          disabled={busy}
          style={{ padding: "0.6rem 1.2rem", fontSize: 13 }}
        >
          {busy ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          className="rly-mono"
          style={{ background: "none", border: "none", color: "var(--chalk-dim)", fontSize: 12, cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase" }}
          onClick={() => setHidden(true)}
        >
          Later
        </button>
        {error && (
          <span className="rly-mono" style={{ color: "var(--volt)", fontSize: 13 }} role="alert">
            {error}
          </span>
        )}
      </form>
    </div>
  );
};

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
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [invite, setInvite] = useState<LinkInvite | null>(null);
  const [consented, setConsented] = useState(false);

  const loadProfile = async () => {
    setProfile(await getMyProfile());
  };

  const resolve = async () => {
    const id = await getMyIdentity();
    if (!id) {
      setStage("signedOut");
      return;
    }
    setIdentity(id);
    if (id.revoked) {
      setStage("revoked");
      return;
    }
    // Every signed-in member lands in the outreach book; insert-if-missing,
    // so this never overwrites anything.
    await ensureProfile();
    await loadProfile();
    // The club may have assigned this account a playing record; the member
    // decides, with the consent text in front of them, before it links.
    if (!id.playerId) {
      const pending = await getMyInvite();
      if (pending) {
        setInvite(pending);
        setStage("consentLink");
        return;
      }
    }
    setStage("home");
  };

  const acceptInvite = async () => {
    if (!invite) return;
    setBusy(true);
    setError(null);
    const res = await acceptLinkInvite(invite.playerId);
    setBusy(false);
    if (res.error) setError(res.error);
    else {
      setInvite(null);
      resolve();
    }
  };

  useEffect(() => {
    // Failed recovery/confirmation landings arrive as #error=...&error_code=...
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errCode = hash.get("error_code");
    if (errCode) {
      setError(
        errCode === "otp_expired"
          ? "That email link has expired. Request a fresh one below."
          : hash.get("error_description") ?? "Sign-in didn't work. Try again."
      );
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (!recoveryRef.current) resolve();
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

  const needsPrompt =
    stage === "home" &&
    profile !== null &&
    (!profile.phone.trim() || !profile.fullName.trim());

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
        {stage === "home" && (
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

      {needsPrompt && profile && <ProfilePrompt profile={profile} onSaved={loadProfile} />}

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
                  : "Create your account and you're in."}
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

        {stage === "consentLink" && invite && (
          <>
            <p className="rly-kicker">
              <span className="rly-dot" /> Your playing record
            </p>
            <h1 className="rly-display rly-page__title">
              That's <span className="rly-script">you.</span>
            </h1>
            <div className="rly-prose" style={{ marginTop: "1.6rem" }}>
              <p>
                The club connected your account to
                {invite.displayName ? ` ${invite.displayName}'s` : " your"} playing
                record. Say the word and your nights, stats and streaks are
                yours in the room.
              </p>
            </div>
            <div className="rly-form" style={{ marginTop: "2rem" }}>
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
              <div className="rly-cta-row" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="rly-pill"
                  disabled={busy || !consented}
                  onClick={acceptInvite}
                >
                  {busy ? "Linking" : "That's me ↗"}
                </button>
                <button
                  type="button"
                  className="rly-pill rly-pill--ghost"
                  disabled={busy}
                  onClick={() => setStage("home")}
                >
                  Later
                </button>
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
              <p>
                {profile?.fullName.trim() ? `Welcome, ${profile.fullName.trim()}. ` : "Welcome. "}
                Your nights and stats will show up here once you've played
                with us. Book a session and come meet the room.
              </p>
            </div>
            <div className="rly-cta-row" style={{ marginTop: "2rem" }}>
              <Link to="/book" className="rly-pill">
                Book a session ↗
              </Link>
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
