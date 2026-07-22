// Court Manager v2 — dev route while the rebuild hardens (COURT-MANAGER.md).
// Passcode-gated, never linked from the public site, robots-blocked.
// The legacy /manage and /manage2 are untouched and remain the live systems.

import { useEffect, useState } from "react";
import { Lock, Delete, Settings, Monitor, BarChart3, RotateCcw } from "lucide-react";
import { useSessionV2 } from "@/court-manager/react/useSessionV2";
import SetupCheckIn from "@/components/manage-next/SetupCheckIn";
import RoundBoard from "@/components/manage-next/RoundBoard";
import StandingsPlayoffs from "@/components/manage-next/StandingsPlayoffs";

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
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-dark text-cream">
      <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
        <Lock className="w-10 h-10 text-accent" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-3xl text-accent">Court Manager · Next</h1>
        <p className="mt-2 text-muted-foreground">{error ? "Wrong passcode — try again" : "Enter 4-digit passcode"}</p>
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
  { id: "session", label: "Session", icon: Settings },
  { id: "courts", label: "Courts", icon: Monitor },
  { id: "standings", label: "Standings & Playoffs", icon: BarChart3 },
] as const;

type Tab = (typeof tabs)[number]["id"];

const ManageNext = () => {
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>("session");
  const s = useSessionV2();

  // Follow the session: setup → Session tab, rounds → Courts, playoffs → Standings.
  useEffect(() => {
    if (s.loading) return;
    if (s.session.phase === "rounds") setTab("courts");
    else if (s.session.phase === "playoffs" || s.session.phase === "done") setTab("standings");
  }, [s.loading, s.session.phase]);

  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-dark text-cream">
      <header className="sticky top-0 z-20 bg-dark/95 backdrop-blur border-b border-dark-elevated">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="font-display text-xl text-accent whitespace-nowrap">PTO Court Manager · Next</h1>
          <nav className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
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
              </button>
            ))}
          </nav>
          <button
            onClick={() => {
              if (window.confirm("Reset the whole session? Completed data will be cleared from this tablet.")) {
                s.resetSession();
                setTab("session");
              }
            }}
            className="min-h-[44px] px-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-cream transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {s.loading ? (
          <div className="py-24 text-center text-muted-foreground animate-pulse">Loading session…</div>
        ) : (
          <>
            {tab === "session" && <SetupCheckIn s={s} />}
            {tab === "courts" &&
              (s.session.phase === "setup" ? (
                <div className="py-24 text-center text-muted-foreground">
                  Courts light up once the session starts. Set up and check in from the Session tab.
                </div>
              ) : (
                <RoundBoard s={s} />
              ))}
            {tab === "standings" && <StandingsPlayoffs s={s} />}
          </>
        )}
      </main>
    </div>
  );
};

export default ManageNext;
