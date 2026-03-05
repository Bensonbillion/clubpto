import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import AdminSetup from "@/components/manage/AdminSetup";
import CheckIn from "@/components/manage/CheckIn";
import CourtDisplay from "@/components/manage/CourtDisplay";
import StatsPlayoffs from "@/components/manage/StatsPlayoffs";
import LeaderboardTab from "@/components/manage/LeaderboardTab";
import DebugPanel from "@/components/manage/DebugPanel";
import { Settings, UserCheck, Monitor, BarChart3, Trophy, Lock, Bug } from "lucide-react";

const ADMIN_PASSCODE = "9999";

const tabs = [
  { id: "admin", label: "Admin Setup", icon: Settings },
  { id: "checkin", label: "Check-In", icon: UserCheck },
  { id: "courts", label: "Court Display", icon: Monitor },
  { id: "stats", label: "Stats & Playoffs", icon: BarChart3 },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "debug", label: "Debug", icon: Bug },
] as const;

type Tab = (typeof tabs)[number]["id"];

const PasscodeGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleDigit = (d: string) => {
    const next = code + d;
    setError(false);
    if (next.length === 4) {
      if (next === ADMIN_PASSCODE) {
        onUnlock();
      } else {
        setError(true);
        setCode("");
      }
    } else {
      setCode(next);
    }
  };

  const handleDelete = () => {
    setCode((c) => c.slice(0, -1));
    setError(false);
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-fade-up">
      <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
        <Lock className="w-10 h-10 text-accent" />
      </div>
      <div>
        <h3 className="font-display text-3xl text-accent text-center">Admin Access</h3>
        <p className="text-base text-muted-foreground text-center mt-2">Enter 4-digit passcode</p>
      </div>
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
              i < code.length
                ? "bg-accent border-accent scale-110"
                : "border-muted-foreground/40"
            } ${error ? "border-destructive bg-destructive/30 animate-pulse-soft" : ""}`}
          />
        ))}
      </div>
      {error && <p className="text-sm text-destructive">Incorrect passcode</p>}
      <div className="grid grid-cols-3 gap-4 max-w-[300px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"].map((d) =>
          d === "" ? (
            <div key="empty" />
          ) : (
            <button
              key={d}
              onClick={() => (d === "←" ? handleDelete() : handleDigit(d))}
              className="w-20 h-20 rounded-lg border border-border bg-card text-foreground font-display text-2xl hover:bg-muted hover:border-accent/40 transition-all active:scale-95"
            >
              {d}
            </button>
          )
        )}
      </div>
    </div>
  );
};

const Manage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("checkin");
  const [adminUnlocked, setAdminUnlockedRaw] = useState(() => sessionStorage.getItem("pto_admin") === "1");
  const [statsUnlocked, setStatsUnlockedRaw] = useState(() => sessionStorage.getItem("pto_stats") === "1");
  const setAdminUnlocked = (v: boolean) => { sessionStorage.setItem("pto_admin", v ? "1" : "0"); setAdminUnlockedRaw(v); };
  const setStatsUnlocked = (v: boolean) => { sessionStorage.setItem("pto_stats", v ? "1" : "0"); setStatsUnlockedRaw(v); };
  const gameState = useGameState();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-full xl:max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <h1 className="font-display text-2xl md:text-3xl text-accent">Club PTO</h1>
          <span className="text-xs md:text-sm uppercase tracking-widest text-muted-foreground">
            Court Manager
          </span>
        </div>
        <div className="max-w-full xl:max-w-6xl mx-auto px-4 md:px-6">
          <nav className="flex gap-2 -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2.5 px-5 py-4 text-base font-body whitespace-nowrap border-b-2 transition-colors min-h-[48px]
                    ${
                      activeTab === tab.id
                        ? "border-accent text-accent"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                  {tab.id === "admin" && !adminUnlocked && <Lock className="w-3.5 h-3.5 ml-0.5" />}
                  {tab.id === "stats" && !statsUnlocked && <Lock className="w-3.5 h-3.5 ml-0.5" />}
                  {tab.id === "debug" && !adminUnlocked && <Lock className="w-3.5 h-3.5 ml-0.5" />}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-full xl:max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {gameState.loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground text-base animate-pulse-soft">Loading game state…</div>
          </div>
        ) : (
          <>
            {activeTab === "admin" && (
              adminUnlocked ? <AdminSetup gameState={gameState} /> : <PasscodeGate onUnlock={() => setAdminUnlocked(true)} />
            )}
            {activeTab === "checkin" && (
              <CheckIn
                gameState={gameState}
                onSwitchToCourtDisplay={() => setActiveTab("courts")}
                isAdmin={adminUnlocked}
              />
            )}
            {activeTab === "courts" && <CourtDisplay gameState={gameState} onGoToCheckIn={() => setActiveTab("checkin")} isAdmin={adminUnlocked} />}
            {activeTab === "stats" && (
              statsUnlocked ? <StatsPlayoffs gameState={gameState} /> : <PasscodeGate onUnlock={() => setStatsUnlocked(true)} />
            )}
            {activeTab === "leaderboard" && <LeaderboardTab />}
            {activeTab === "debug" && (
              adminUnlocked ? <DebugPanel gameState={gameState} /> : <PasscodeGate onUnlock={() => setAdminUnlocked(true)} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Manage;