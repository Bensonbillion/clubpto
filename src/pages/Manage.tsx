import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import AdminSetup from "@/components/manage/AdminSetup";
import CheckIn from "@/components/manage/CheckIn";
import CourtDisplay from "@/components/manage/CourtDisplay";
import StatsPlayoffs from "@/components/manage/StatsPlayoffs";
import { Settings, UserCheck, Monitor, BarChart3 } from "lucide-react";

const tabs = [
  { id: "admin", label: "Admin Setup", icon: Settings },
  { id: "checkin", label: "Check-In", icon: UserCheck },
  { id: "courts", label: "Court Display", icon: Monitor },
  { id: "stats", label: "Stats & Playoffs", icon: BarChart3 },
] as const;

type Tab = (typeof tabs)[number]["id"];

const Manage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("admin");
  const gameState = useGameState();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-display text-2xl text-accent">Club PTO</h1>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Court Manager</span>
        </div>
        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-body whitespace-nowrap border-b-2 transition-colors
                    ${
                      activeTab === tab.id
                        ? "border-accent text-accent"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === "admin" && <AdminSetup gameState={gameState} />}
        {activeTab === "checkin" && <CheckIn gameState={gameState} />}
        {activeTab === "courts" && <CourtDisplay gameState={gameState} />}
        {activeTab === "stats" && <StatsPlayoffs gameState={gameState} />}
      </main>
    </div>
  );
};

export default Manage;
