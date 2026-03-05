import { useState, useMemo } from "react";
import type { GameState, Match, Pair } from "@/types/courtManager";
import { AlertTriangle, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";

interface DebugPanelProps {
  gameState: {
    state: GameState;
    regenerateRemainingSchedule: () => void;
  };
}

function getPairPlayerIds(p: Pair): string[] {
  return [p.player1.id, p.player2.id];
}
function getMatchPlayerIds(m: Match): string[] {
  return [...getPairPlayerIds(m.pair1), ...getPairPlayerIds(m.pair2)];
}

const DebugPanel = ({ gameState }: DebugPanelProps) => {
  const { state, regenerateRemainingSchedule } = gameState;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    overview: true,
    courts: true,
    pairs: false,
    diagnostics: false,
    matches: false,
  });

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Computed diagnostics ────────────────────────────────
  const diagnostics = useMemo(() => {
    const { pairs, matches, roster } = state;
    const activePairIds = new Set(pairs.map((p) => p.id));

    // Match counts by status
    const playing = matches.filter((m) => m.status === "playing");
    const pending = matches.filter((m) => m.status === "pending");
    const completed = matches.filter((m) => m.status === "completed");

    // Pair game counts
    const pairGameCounts = new Map<string, number>();
    pairs.forEach((p) => pairGameCounts.set(p.id, 0));
    for (const m of matches) {
      if (m.status === "completed") {
        pairGameCounts.set(m.pair1.id, (pairGameCounts.get(m.pair1.id) || 0) + 1);
        pairGameCounts.set(m.pair2.id, (pairGameCounts.get(m.pair2.id) || 0) + 1);
      }
    }

    // Busy player IDs (currently on court)
    const busyPlayerIds = new Set<string>();
    playing.forEach((m) => getMatchPlayerIds(m).forEach((id) => busyPlayerIds.add(id)));

    // Ghost matches: pending/playing matches referencing removed pairs
    const ghostMatches = matches.filter(
      (m) =>
        m.status !== "completed" &&
        (!activePairIds.has(m.pair1.id) || !activePairIds.has(m.pair2.id)),
    );

    // Orphaned players: checked in but not in any pair
    const pairedPlayerIds = new Set<string>();
    pairs.forEach((p) => {
      pairedPlayerIds.add(p.player1.id);
      pairedPlayerIds.add(p.player2.id);
    });
    const orphanedPlayers = roster.filter(
      (p) => p.checkedIn && !pairedPlayerIds.has(p.id),
    );

    // Equity: min/max games across pairs
    const gameCounts = Array.from(pairGameCounts.values());
    const minGames = gameCounts.length > 0 ? Math.min(...gameCounts) : 0;
    const maxGames = gameCounts.length > 0 ? Math.max(...gameCounts) : 0;

    // Courts with no active match
    const courtCount = state.sessionConfig.courtCount || 2;
    const activeCourts = new Set(playing.map((m) => m.court));
    const emptyCourts: number[] = [];
    for (let c = 1; c <= courtCount; c++) {
      if (!activeCourts.has(c)) emptyCourts.push(c);
    }

    // Stalled detection: empty courts + pending matches exist
    const isStalled = emptyCourts.length > 0 && pending.length > 0 && state.sessionStarted;

    // Back-to-back detection in pending schedule
    const backToBackPairs: string[] = [];
    for (let i = 0; i < pending.length - 1; i++) {
      const curr = getMatchPlayerIds(pending[i]);
      const next = getMatchPlayerIds(pending[i + 1]);
      const overlap = curr.filter((id) => next.includes(id));
      if (overlap.length > 0) {
        const names = overlap.map(
          (id) => roster.find((p) => p.id === id)?.name || id,
        );
        backToBackPairs.push(
          `Games #${pending[i].gameNumber || "?"} & #${pending[i + 1].gameNumber || "?"}: ${names.join(", ")}`,
        );
      }
    }

    return {
      playing,
      pending,
      completed,
      pairGameCounts,
      busyPlayerIds,
      ghostMatches,
      orphanedPlayers,
      minGames,
      maxGames,
      emptyCourts,
      isStalled,
      backToBackPairs,
      courtCount,
    };
  }, [state]);

  // ── Export diagnostics as JSON ──────────────────────────
  const exportDiagnostics = () => {
    const data = {
      timestamp: new Date().toISOString(),
      sessionConfig: state.sessionConfig,
      rosterCount: state.roster.length,
      checkedInCount: state.roster.filter((p) => p.checkedIn).length,
      pairCount: state.pairs.length,
      matchCounts: {
        playing: diagnostics.playing.length,
        pending: diagnostics.pending.length,
        completed: diagnostics.completed.length,
      },
      ghostMatches: diagnostics.ghostMatches.map((m) => ({
        id: m.id,
        pair1: m.pair1.player1.name + " & " + m.pair1.player2.name,
        pair2: m.pair2.player1.name + " & " + m.pair2.player2.name,
        status: m.status,
      })),
      orphanedPlayers: diagnostics.orphanedPlayers.map((p) => p.name),
      pairGameCounts: state.pairs.map((p) => ({
        pair: p.player1.name + " & " + p.player2.name,
        tier: p.skillLevel,
        completed: diagnostics.pairGameCounts.get(p.id) || 0,
        watched: state.pairGamesWatched?.[p.id] || 0,
        busy: getPairPlayerIds(p).some((id) => diagnostics.busyPlayerIds.has(id)),
      })),
      backToBackViolations: diagnostics.backToBackPairs,
      isStalled: diagnostics.isStalled,
      emptyCourts: diagnostics.emptyCourts,
      equityGap: diagnostics.maxGames - diagnostics.minGames,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pto-debug-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Section = ({
    id,
    title,
    badge,
    children,
  }: {
    id: string;
    title: string;
    badge?: string | number;
    children: React.ReactNode;
  }) => (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-left"
      >
        <span className="font-body text-sm font-medium text-foreground">{title}</span>
        <span className="flex items-center gap-2">
          {badge !== undefined && (
            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">{badge}</span>
          )}
          {expanded[id] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </span>
      </button>
      {expanded[id] && <div className="px-4 py-3 border-t border-border">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-accent">Debug Panel</h2>
        <div className="flex gap-2">
          <button
            onClick={exportDiagnostics}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Alerts */}
      {diagnostics.isStalled && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Match Generation Stalled</p>
            <p className="text-xs text-muted-foreground mt-1">
              Court{diagnostics.emptyCourts.length > 1 ? "s" : ""}{" "}
              {diagnostics.emptyCourts.join(", ")} empty with {diagnostics.pending.length} pending
              match{diagnostics.pending.length !== 1 ? "es" : ""}. Try regenerating the schedule.
            </p>
            <button
              onClick={regenerateRemainingSchedule}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-destructive/20 border border-destructive/30 rounded hover:bg-destructive/30 transition-colors text-destructive"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate Schedule
            </button>
          </div>
        </div>
      )}

      {diagnostics.ghostMatches.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-500">Ghost Players Detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              {diagnostics.ghostMatches.length} match{diagnostics.ghostMatches.length !== 1 ? "es" : ""}{" "}
              reference removed pairs. Regenerating should fix this.
            </p>
          </div>
        </div>
      )}

      {diagnostics.backToBackPairs.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-500">Back-to-Back Violations</p>
            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {diagnostics.backToBackPairs.slice(0, 5).map((v, i) => (
                <li key={i}>{v}</li>
              ))}
              {diagnostics.backToBackPairs.length > 5 && (
                <li>...and {diagnostics.backToBackPairs.length - 5} more</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Overview */}
      <Section id="overview" title="Session Overview">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Roster" value={state.roster.length} sub={`${state.roster.filter((p) => p.checkedIn).length} checked in`} />
          <Stat label="Pairs" value={state.pairs.length} sub={`${state.pairs.filter((p) => p.skillLevel === "A").length}A / ${state.pairs.filter((p) => p.skillLevel === "B").length}B / ${state.pairs.filter((p) => p.skillLevel === "C").length}C`} />
          <Stat label="Matches" value={state.matches.length} sub={`${diagnostics.completed.length} done, ${diagnostics.playing.length} live, ${diagnostics.pending.length} pending`} />
          <Stat label="Equity Gap" value={diagnostics.maxGames - diagnostics.minGames} sub={`${diagnostics.minGames} min / ${diagnostics.maxGames} max`} warn={diagnostics.maxGames - diagnostics.minGames > 2} />
        </div>
      </Section>

      {/* Court Status */}
      <Section id="courts" title="Court Status" badge={`${diagnostics.playing.length} / ${diagnostics.courtCount}`}>
        <div className="space-y-2">
          {Array.from({ length: diagnostics.courtCount }, (_, i) => i + 1).map((court) => {
            const match = diagnostics.playing.find((m) => m.court === court);
            return (
              <div key={court} className={`flex items-center gap-3 p-2 rounded ${match ? "bg-accent/5 border border-accent/20" : "bg-muted/30 border border-border"}`}>
                <span className={`text-xs font-mono font-bold ${match ? "text-accent" : "text-muted-foreground"}`}>
                  CT {court}
                </span>
                {match ? (
                  <div className="flex-1">
                    <span className="text-sm text-foreground">
                      {match.pair1.player1.name} & {match.pair1.player2.name}
                      <span className="text-muted-foreground mx-1">vs</span>
                      {match.pair2.player1.name} & {match.pair2.player2.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      [{match.matchupLabel}] #{match.gameNumber}
                    </span>
                    {match.startedAt && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({Math.round((Date.now() - Date.parse(match.startedAt)) / 60000)}m ago)
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Empty</span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Pair Status */}
      <Section id="pairs" title="Pair Status" badge={state.pairs.length}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-1.5 pr-3">Pair</th>
                <th className="text-center py-1.5 px-2">Tier</th>
                <th className="text-center py-1.5 px-2">Games</th>
                <th className="text-center py-1.5 px-2">W/L</th>
                <th className="text-center py-1.5 px-2">Watched</th>
                <th className="text-center py-1.5 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.pairs
                .slice()
                .sort((a, b) => (diagnostics.pairGameCounts.get(a.id) || 0) - (diagnostics.pairGameCounts.get(b.id) || 0))
                .map((pair) => {
                  const games = diagnostics.pairGameCounts.get(pair.id) || 0;
                  const isBusy = getPairPlayerIds(pair).some((id) => diagnostics.busyPlayerIds.has(id));
                  const watched = state.pairGamesWatched?.[pair.id] || 0;
                  return (
                    <tr key={pair.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1.5 pr-3 text-foreground">
                        {pair.player1.name} & {pair.player2.name}
                      </td>
                      <td className="text-center py-1.5 px-2">
                        <span className={`inline-block w-5 h-5 rounded text-center leading-5 text-[10px] font-bold ${pair.skillLevel === "A" ? "bg-blue-500/20 text-blue-400" : pair.skillLevel === "B" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                          {pair.skillLevel}
                        </span>
                      </td>
                      <td className="text-center py-1.5 px-2 font-mono">{games}</td>
                      <td className="text-center py-1.5 px-2 font-mono">{pair.wins}-{pair.losses}</td>
                      <td className="text-center py-1.5 px-2 font-mono">{watched}</td>
                      <td className="text-center py-1.5 px-2">
                        {isBusy ? (
                          <span className="text-accent font-medium">On Court</span>
                        ) : (
                          <span className="text-muted-foreground">Idle</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Diagnostics */}
      <Section
        id="diagnostics"
        title="Diagnostics"
        badge={diagnostics.ghostMatches.length + diagnostics.orphanedPlayers.length + diagnostics.backToBackPairs.length > 0
          ? `${diagnostics.ghostMatches.length + diagnostics.orphanedPlayers.length + diagnostics.backToBackPairs.length} issues`
          : "OK"}
      >
        <div className="space-y-3 text-xs">
          <div>
            <span className="font-medium text-foreground">Ghost Matches: </span>
            <span className={diagnostics.ghostMatches.length > 0 ? "text-destructive" : "text-green-400"}>
              {diagnostics.ghostMatches.length === 0 ? "None" : diagnostics.ghostMatches.length}
            </span>
          </div>
          <div>
            <span className="font-medium text-foreground">Orphaned Players: </span>
            <span className={diagnostics.orphanedPlayers.length > 0 ? "text-yellow-500" : "text-green-400"}>
              {diagnostics.orphanedPlayers.length === 0
                ? "None"
                : diagnostics.orphanedPlayers.map((p) => p.name).join(", ")}
            </span>
          </div>
          <div>
            <span className="font-medium text-foreground">Mode: </span>
            <span className="text-muted-foreground">
              {state.sessionConfig.dynamicMode ? "Dynamic" : "Pre-scheduled"} / {diagnostics.courtCount} courts
            </span>
          </div>
          <div>
            <span className="font-medium text-foreground">Waitlist: </span>
            <span className="text-muted-foreground">
              {(state.waitlistedPlayers || []).length === 0
                ? "Empty"
                : (state.waitlistedPlayers || [])
                    .map((id) => state.roster.find((p) => p.id === id)?.name || id)
                    .join(", ")}
            </span>
          </div>
        </div>
      </Section>

      {/* Pending Match Queue */}
      <Section id="matches" title="Pending Queue" badge={diagnostics.pending.length}>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {diagnostics.pending.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending matches</p>
          ) : (
            diagnostics.pending.slice(0, 30).map((m) => {
              const isGhost =
                !state.pairs.some((p) => p.id === m.pair1.id) ||
                !state.pairs.some((p) => p.id === m.pair2.id);
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${isGhost ? "bg-destructive/10 border border-destructive/20" : "hover:bg-muted/30"}`}
                >
                  <span className="text-muted-foreground font-mono w-6">#{m.gameNumber}</span>
                  <span className={isGhost ? "text-destructive" : "text-foreground"}>
                    {m.pair1.player1.name} & {m.pair1.player2.name} vs{" "}
                    {m.pair2.player1.name} & {m.pair2.player2.name}
                  </span>
                  <span className="text-muted-foreground ml-auto">[{m.matchupLabel}]</span>
                  {isGhost && <span className="text-destructive font-medium">GHOST</span>}
                </div>
              );
            })
          )}
          {diagnostics.pending.length > 30 && (
            <p className="text-xs text-muted-foreground py-1">
              ...and {diagnostics.pending.length - 30} more
            </p>
          )}
        </div>
      </Section>
    </div>
  );
};

const Stat = ({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: number;
  sub: string;
  warn?: boolean;
}) => (
  <div className="p-2 rounded bg-muted/30 border border-border">
    <div className={`text-lg font-mono font-bold ${warn ? "text-destructive" : "text-foreground"}`}>
      {value}
    </div>
    <div className="text-xs font-medium text-foreground">{label}</div>
    <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
  </div>
);

export default DebugPanel;
