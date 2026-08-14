// Court Manager v2 — dev route while the rebuild hardens (COURT-MANAGER.md).
// Never linked from the public site, robots-blocked.
// The legacy /manage and /manage2 are untouched and remain the live systems.
//
// ACCESS MODEL (owner's rule): the passcode guards ONLY the admin surfaces —
// Roster (add/edit players, tiers, generate the play) and Standings (the
// leaderboard/playoffs). Check-In and Courts are WIDE OPEN so day-of helpers
// can check people in and run both courts with no passcode. Tier labels are
// never shown on the open surfaces (§18).

import { useEffect, useRef, useState } from "react";
import { Lock, Delete, Settings, UserCheck, Monitor, BarChart3, RotateCcw } from "lucide-react";
import { useSessionV2 } from "@/court-manager/react/useSessionV2";
import { SessionSetup, CheckIn } from "@/components/manage-next/SetupCheckIn";
import RoundBoard from "@/components/manage-next/RoundBoard";
import StandingsPlayoffs from "@/components/manage-next/StandingsPlayoffs";
import { ManageErrorBoundary } from "@/components/manage-next/ManageErrorBoundary";
import AdminGate from "@/court-manager/auth/AdminGate";

const ADMIN_PASSCODE = "9999";

const PasscodeGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleDigit = (d: string) => {
    const next = code + d;
    setError(false);
    if (next.length === 4) {
      if (next === ADMIN_PASSCODE) onUnlock();
      else {
        setError(true);
        setCode("");
      }
    } else {
      setCode(next);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-8 text-cream">
      <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
        <Lock className="w-10 h-10 text-accent" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-3xl text-accent">Admin area</h1>
        <p className="mt-2 text-muted-foreground">{error ? "Wrong passcode — try again" : "Enter 4-digit passcode"}</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Check-In and Courts need no code — helpers can use them freely.
        </p>
      </div>
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border ${i < code.length ? "bg-accent border-accent" : "border-muted-foreground/40"}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key, i) =>
          key === "" ? (
            <div key={i} />
          ) : key === "del" ? (
            <button
              key={i}
              onClick={() => setCode((c) => c.slice(0, -1))}
              className="w-16 h-16 rounded-full border border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition-colors"
              aria-label="Delete digit"
            >
              <Delete className="w-6 h-6" />
            </button>
          ) : (
            <button
              key={i}
              onClick={() => handleDigit(key)}
              className="w-16 h-16 rounded-full border border-muted-foreground/30 text-2xl text-cream hover:border-accent hover:text-accent transition-colors"
            >
              {key}
            </button>
          ),
        )}
      </div>
    </div>
  );
};

const tabs = [
  { id: "session", label: "Roster", icon: Settings, locked: true },
  { id: "checkin", label: "Check-In", icon: UserCheck, locked: false },
  { id: "courts", label: "Courts", icon: Monitor, locked: false },
  { id: "standings", label: "Standings & Playoffs", icon: BarChart3, locked: true },
] as const;

type Tab = (typeof tabs)[number]["id"];

const LOCKED_TABS: Tab[] = tabs.filter((t) => t.locked).map((t) => t.id);
const isLocked = (t: Tab) => LOCKED_TABS.includes(t);

const ManageNextInner = () => {
  // Passcode unlocks the admin tabs (Roster, Standings) for this browser
  // session; a refresh re-locks them — the open tabs never lock, so helpers
  // are never blocked, and a curious player who grabs the tablet can't reach
  // the leaderboard after a reload.
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  // Default to the open Check-In tab so opening the app never shows a passcode.
  const [tab, setTab] = useState<Tab>("checkin");
  const s = useSessionV2();

  // Follow the session: rounds → Courts (open). At playoffs/done, only send the
  // admin to the locked Standings tab — a no-passcode helper stays on the open
  // Courts tab (which shows a playoffs pointer) instead of being trapped at the
  // passcode gate the instant someone taps JUMP TO PLAYOFFS.
  // Fire ONLY when the phase actually changes. Keying this on adminUnlocked too
  // meant that entering the passcode mid-session re-ran the effect and yanked
  // the admin straight back off the tab they had just unlocked.
  const lastPhase = useRef<string | null>(null);
  useEffect(() => {
    if (s.loading) return;
    const phase = s.session.phase;
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    if (phase === "rounds") setTab("courts");
    else if (phase === "playoffs" || phase === "done") setTab("courts");
  }, [s.loading, s.session.phase]);

  const gated = isLocked(tab) && !adminUnlocked;

  return (
    <div className="min-h-screen bg-dark text-cream">
      <header className="sticky top-0 z-20 bg-dark/95 backdrop-blur border-b border-dark-elevated">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="font-display text-xl text-accent whitespace-nowrap">PTO Court Manager · Next</h1>
          <nav className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon, locked }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`min-h-[44px] px-4 rounded-none flex items-center gap-2 text-sm transition-colors ${
                  tab === id
                    ? "bg-accent/15 text-accent border-b-2 border-accent"
                    : "text-muted-foreground hover:text-cream"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {locked && !adminUnlocked && <Lock className="w-3 h-3 opacity-50" />}
              </button>
            ))}
          </nav>
          {adminUnlocked ? (
            <button
              onClick={() => {
                if (window.confirm("Reset tonight's session? The roster is kept — check-ins, pairs, games, and results are cleared.")) {
                  s.resetSession();
                  setTab("session");
                }
              }}
              className="min-h-[44px] px-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-cream transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          ) : (
            <div className="w-4" />
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {s.loading ? (
          <div className="py-24 text-center text-muted-foreground animate-pulse">Loading session…</div>
        ) : gated ? (
          <PasscodeGate onUnlock={() => setAdminUnlocked(true)} />
        ) : (
          <>
            {tab === "session" && <SessionSetup s={s} />}
            {tab === "checkin" && <CheckIn s={s} />}
            {tab === "courts" &&
              (s.session.phase === "setup" ? (
                <div className="py-24 text-center text-muted-foreground">
                  Courts light up once the session starts. Check players in, then start it from the Roster tab.
                </div>
              ) : (
                // Rounds AND playoffs both render here — RoundBoard switches to the
                // playoff courts itself, so helpers keep running games either way.
                <RoundBoard s={s} />
              ))}
            {tab === "standings" && <StandingsPlayoffs s={s} />}
          </>
        )}
      </main>
    </div>
  );
};

// The boundary must sit OUTSIDE the component that calls useSessionV2, so a
// throw during that component's render is caught instead of white-screening.
//
// AdminGate sits outside both: game_state is admin-only in the database now,
// so an un-signed-in device cannot read the session at all and there is no
// point mounting the manager behind it. The 9999 passcode stays exactly where
// it was — it still separates admin surfaces from the day-of helper surfaces
// once you are through the door.
const ManageNext = () => (
  <AdminGate>
    <ManageErrorBoundary>
      <ManageNextInner />
    </ManageErrorBoundary>
  </AdminGate>
);

export default ManageNext;
