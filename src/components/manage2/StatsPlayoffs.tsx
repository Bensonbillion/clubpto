/**
 * StatsPlayoffs for Open Mode (/manage2).
 *
 * Key differences from original:
 * - Single unified leaderboard (no tier grouping)
 * - Tier badge shown next to pair names (reference only)
 * - Playoff seeding: purely by Win% (no tier priority)
 * - Tiebreakers: Win% → Head-to-head → Games played → Total wins (NO tier)
 * - Top 4 (1-court) or top 8 (2-court) for playoffs
 */
import { useOpenGameState } from "@/hooks/useOpenGameState";
import { Pair, Match } from "@/types/openCourtManager";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Trophy, Medal, Info, ArrowUp, ArrowDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PlayoffBracket from "./PlayoffBracket";
import SessionExport from "./SessionExport";

interface StatsPlayoffsProps {
  gameState: ReturnType<typeof useOpenGameState>;
}

interface PlayoffPairSeed {
  seed: number;
  pair: Pair;
  winPct: number;
  tiebreakerReason?: string;
}

interface PairStanding {
  id: string;
  pair: Pair;
  player1Name: string;
  player2Name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winPct: number;
  tier: string;
  tiebreakerReason?: string;
}

const TIER_COLORS: Record<string, string> = {
  A: "text-yellow-400",
  B: "text-gray-300",
  C: "text-amber-600",
};

/** Simple head-to-head between two pairs from completed matches */
function getHeadToHead(pairAId: string, pairBId: string, matches: Match[]): number {
  let aWins = 0;
  let bWins = 0;
  for (const m of matches) {
    if (m.status !== "completed" || !m.winner) continue;
    const isMatch =
      (m.pair1.id === pairAId && m.pair2.id === pairBId) ||
      (m.pair1.id === pairBId && m.pair2.id === pairAId);
    if (!isMatch) continue;
    if (m.winner.id === pairAId) aWins++;
    else if (m.winner.id === pairBId) bWins++;
  }
  if (aWins > bWins) return 1;
  if (bWins > aWins) return -1;
  return 0;
}

function annotateTiebreakers(pairs: PairStanding[], matches: Match[]): PairStanding[] {
  if (pairs.length <= 1) return pairs;
  const result = pairs.map((p) => ({ ...p }));

  for (let i = 0; i < result.length; i++) {
    let j = i;
    while (j < result.length && Math.abs(result[j].winPct - result[i].winPct) < 0.001) j++;
    const tiedGroup = result.slice(i, j);
    if (tiedGroup.length <= 1) continue;

    for (let k = i; k < j - 1; k++) {
      const a = result[k];
      const b = result[k + 1];
      const h2h = getHeadToHead(a.pair.id, b.pair.id, matches);
      if (h2h === 1) {
        result[k].tiebreakerReason = result[k].tiebreakerReason || "Wins H2H tiebreaker";
        result[k + 1].tiebreakerReason = result[k + 1].tiebreakerReason || "Loses H2H tiebreaker";
      } else if (h2h === -1) {
        result[k].tiebreakerReason = result[k].tiebreakerReason || "Loses H2H tiebreaker";
        result[k + 1].tiebreakerReason = result[k + 1].tiebreakerReason || "Wins H2H tiebreaker";
      } else {
        if (a.gamesPlayed !== b.gamesPlayed) {
          result[k].tiebreakerReason = result[k].tiebreakerReason || "Wins on games played";
          result[k + 1].tiebreakerReason = result[k + 1].tiebreakerReason || "Fewer games played";
        } else if (a.wins !== b.wins) {
          result[k].tiebreakerReason = result[k].tiebreakerReason || "Wins on total wins";
          result[k + 1].tiebreakerReason = result[k + 1].tiebreakerReason || "Fewer total wins";
        } else {
          result[k].tiebreakerReason = result[k].tiebreakerReason || "Tied — same record";
          result[k + 1].tiebreakerReason = result[k + 1].tiebreakerReason || "Tied — same record";
        }
      }
    }
    i = j - 1;
  }
  return result;
}

const StatsPlayoffs = ({ gameState }: StatsPlayoffsProps) => {
  const { state, checkedInPlayers, completedMatches, generatePlayoffMatches, startPlayoffMatch, completePlayoffMatch } = gameState;
  const [playoffSeeds, setPlayoffSeeds] = useState<PlayoffPairSeed[]>([]);

  const courtCount = (state.sessionConfig.courtCount as 1 | 2) || 2;
  const maxPlayoffTeams = courtCount === 1 ? 4 : 8;

  // Build unified pair standings (no tier grouping)
  const buildAllPairStandings = (): PairStanding[] => {
    const pairMap = new Map<string, PairStanding>();

    for (const match of state.matches.filter((m) => m.status === "completed")) {
      const processPair = (pair: Pair, won: boolean) => {
        const key = [pair.player1.id, pair.player2.id].sort().join("|||");
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            id: key,
            pair,
            player1Name: pair.player1.name,
            player2Name: pair.player2.name,
            wins: 0, losses: 0, gamesPlayed: 0, winPct: 0,
            tier: pair.skillLevel,
          });
        }
        const s = pairMap.get(key)!;
        s.gamesPlayed++;
        if (won) s.wins++;
        else s.losses++;
        s.winPct = s.gamesPlayed > 0 ? s.wins / s.gamesPlayed : 0;
      };

      if (match.winner && match.loser) {
        processPair(match.winner, true);
        processPair(match.loser, false);
      }
    }

    // Also include pairs from courts-based WSO
    for (const court of state.courts || []) {
      if (!court.wso) continue;
      for (const [pairId, wsoStats] of Object.entries(court.wso.stats)) {
        if (wsoStats.gamesPlayed === 0) continue;
        const pair = court.assignedPairs.find((p) => p.id === pairId);
        if (!pair) continue;
        const key = [pair.player1.id, pair.player2.id].sort().join("|||");
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            id: key,
            pair,
            player1Name: pair.player1.name,
            player2Name: pair.player2.name,
            wins: wsoStats.wins, losses: wsoStats.losses, gamesPlayed: wsoStats.gamesPlayed,
            winPct: wsoStats.gamesPlayed > 0 ? wsoStats.wins / wsoStats.gamesPlayed : 0,
            tier: pair.skillLevel,
          });
        }
      }
    }

    // Sort purely by Win% (no tier priority in open mode)
    return Array.from(pairMap.values()).sort((a, b) => {
      if (Math.abs(b.winPct - a.winPct) > 0.001) return b.winPct - a.winPct;
      const h2h = getHeadToHead(a.pair.id, b.pair.id, state.matches);
      if (h2h !== 0) return -h2h;
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return b.wins - a.wins;
    });
  };

  const allPairStandings = buildAllPairStandings();

  const handleGeneratePlayoffSeeds = () => {
    const eligible = allPairStandings.filter((s) => s.gamesPlayed > 0).slice(0, maxPlayoffTeams);
    const annotated = annotateTiebreakers(eligible, state.matches);

    const seeds: PlayoffPairSeed[] = annotated.map((ps, i) => ({
      seed: i + 1,
      pair: ps.pair,
      winPct: ps.winPct,
      tiebreakerReason: ps.tiebreakerReason,
    }));

    setPlayoffSeeds(seeds);
  };

  const handleConfirmPlayoffBracket = () => {
    if (playoffSeeds.length < 2) return;
    const renumbered = playoffSeeds.map((s, i) => ({ ...s, seed: i + 1 }));
    generatePlayoffMatches(renumbered);
  };

  const moveSeed = (index: number, direction: "up" | "down") => {
    const newSeeds = [...playoffSeeds];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newSeeds.length) return;
    [newSeeds[index], newSeeds[swapIndex]] = [newSeeds[swapIndex], newSeeds[index]];
    setPlayoffSeeds(newSeeds.map((s, i) => ({ ...s, seed: i + 1 })));
  };

  const roundRobinComplete = state.matches.length > 0 && state.matches.every((m) => m.status === "completed");
  const allPlayoffComplete = (state.playoffMatches || []).length > 0 && (state.playoffMatches || []).every((m) => m.status === "completed");
  const playoffMatchesByRound = (state.playoffMatches || []).reduce((acc, m) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {} as Record<number, typeof state.playoffMatches>);
  const rounds = Object.keys(playoffMatchesByRound).map(Number).sort((a, b) => a - b);
  const lastRound = rounds[rounds.length - 1];
  const champion = allPlayoffComplete && lastRound ? playoffMatchesByRound[lastRound]?.[0]?.winner : null;
  const totalPairs = allPairStandings.length;
  const annotatedStandings = annotateTiebreakers(allPairStandings, state.matches);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Session Overview */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-display text-xl text-accent mb-4">Session Overview</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="font-display text-3xl text-foreground">{checkedInPlayers.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Players</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">{state.pairs.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Pairs</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">{completedMatches.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">
              {state.matches.filter((m) => m.status === "pending").length}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Remaining</p>
          </div>
        </div>
      </div>

      {/* Fixed Pairs Display */}
      {state.pairs.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h4 className="font-display text-lg text-accent">Session Pairs</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {state.pairs.map((pair) => {
              const tierColor = TIER_COLORS[pair.skillLevel] || "text-muted-foreground";
              return (
                <div key={pair.id} className="rounded-md border border-border/40 bg-muted/30 p-3 text-center">
                  <p className="font-display text-foreground">{pair.player1.name} & {pair.player2.name}</p>
                  <p className={`text-xs uppercase tracking-widest ${tierColor}`}>{pair.skillLevel} pool</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WSO Court Stats */}
      {(state.courts || []).some((c) => c.wso && c.wso.history.length > 0) && (
        <div className="space-y-4">
          {(state.courts || []).filter((c) => c.wso && c.wso.history.length > 0).map((court) => {
            const wso = court.wso!;
            const sortedStats = Object.values(wso.stats)
              .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.streak - a.streak);

            return (
              <div key={court.courtNumber} className="rounded-lg border border-border bg-card p-6 space-y-3">
                <h4 className="font-display text-lg text-accent">Court {court.courtNumber} — Winner Stays On Stats</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-2 text-xs uppercase tracking-widest text-muted-foreground w-8">#</th>
                        <th className="py-2 pr-2 text-xs uppercase tracking-widest text-muted-foreground">Pair</th>
                        <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">W</th>
                        <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">L</th>
                        <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">GP</th>
                        <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">Streak</th>
                        <th className="py-2 pl-2 text-xs uppercase tracking-widest text-muted-foreground text-right">Win%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStats.map((st, i) => {
                        const pair = court.assignedPairs.find((p) => p.id === st.pairId);
                        if (!pair) return null;
                        const tierColor = TIER_COLORS[pair.skillLevel] || "";
                        const winPct = st.gamesPlayed > 0 ? Math.round((st.wins / st.gamesPlayed) * 100) : 0;
                        return (
                          <tr key={st.pairId} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-2.5 pr-2">
                              <span className="font-display text-accent">{i + 1}</span>
                            </td>
                            <td className="py-2.5 pr-2">
                              <span className="font-display text-foreground">{pair.player1.name} & {pair.player2.name}</span>
                              <span className={`ml-1.5 text-xs ${tierColor}`}>{pair.skillLevel}</span>
                            </td>
                            <td className="py-2.5 px-2 text-center text-foreground">{st.wins}</td>
                            <td className="py-2.5 px-2 text-center text-foreground">{st.losses}</td>
                            <td className="py-2.5 px-2 text-center text-muted-foreground">{st.gamesPlayed}</td>
                            <td className="py-2.5 px-2 text-center">
                              {st.longestStreak > 1 ? (
                                <span className="text-yellow-400 text-xs">🔥{st.longestStreak} best</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-2.5 pl-2 text-right">
                              <span className="font-mono text-accent">{winPct}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Standings */}
      <TooltipProvider>
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h4 className="font-display text-lg text-accent">Standings — All Pairs</h4>
          <p className="text-xs text-muted-foreground">Sorted by Win%. Tier shown for reference only.</p>
          {annotatedStandings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No games played yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-2 text-xs uppercase tracking-widest text-muted-foreground w-8">#</th>
                    <th className="py-2 pr-2 text-xs uppercase tracking-widest text-muted-foreground">Pair</th>
                    <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">W</th>
                    <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">L</th>
                    <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">GP</th>
                    <th className="py-2 pl-2 text-xs uppercase tracking-widest text-muted-foreground text-right">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {annotatedStandings.map((p, i) => {
                    const tierColor = TIER_COLORS[p.tier] || "text-muted-foreground";
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2.5 pr-2">
                          <span className="font-display text-accent">{i + 1}</span>
                        </td>
                        <td className="py-2.5 pr-2">
                          <span className="font-display text-foreground">{p.player1Name} & {p.player2Name}</span>
                          <span className={`ml-1.5 text-xs ${tierColor}`}>{p.tier}</span>
                          {p.tiebreakerReason && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-1.5 inline-flex items-center">
                                  <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-accent cursor-help" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[200px]">
                                <p>Tied on W% — {p.tiebreakerReason.toLowerCase()}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center text-foreground">{p.wins}</td>
                        <td className="py-2.5 px-2 text-center text-foreground">{p.losses}</td>
                        <td className="py-2.5 px-2 text-center text-muted-foreground">{p.gamesPlayed}</td>
                        <td className="py-2.5 pl-2 text-right">
                          <span className="font-mono text-accent">{(p.winPct * 100).toFixed(0)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* Playoff Section */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display text-xl text-accent">Playoffs</h3>

        {(state.playoffMatches || []).length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Top {maxPlayoffTeams} pairs seeded purely by Win% — no tier priority in Open mode.
              Tiebreakers: head-to-head → games played → total wins. {maxPlayoffTeams}-team single-elimination bracket.
            </p>
            {roundRobinComplete && (
              <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
                ✦ Round-robin complete! Generate playoff bracket below.
              </div>
            )}
            <Button
              onClick={handleGeneratePlayoffSeeds}
              disabled={totalPairs < 2}
              className="bg-accent text-accent-foreground hover:bg-accent/80"
            >
              <Trophy className="w-4 h-4 mr-1" /> Generate Playoff Bracket
            </Button>

            {playoffSeeds.length > 0 && (
              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Reorder seeds, then confirm:</p>
                  <Button
                    onClick={handleConfirmPlayoffBracket}
                    className="bg-accent text-accent-foreground hover:bg-accent/80"
                    size="sm"
                  >
                    <Trophy className="w-4 h-4 mr-1" /> Confirm & Start Playoffs
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {playoffSeeds.map((s, idx) => {
                    const tierColor = TIER_COLORS[s.pair.skillLevel] || "text-muted-foreground";
                    return (
                      <div key={s.pair.id} className="flex items-center gap-3 rounded-md border border-border bg-muted p-3">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveSeed(idx, "up")}
                            disabled={idx === 0}
                            className="p-0.5 rounded hover:bg-accent/20 disabled:opacity-20 transition-colors"
                          >
                            <ArrowUp className="w-3.5 h-3.5 text-accent" />
                          </button>
                          <button
                            onClick={() => moveSeed(idx, "down")}
                            disabled={idx === playoffSeeds.length - 1}
                            className="p-0.5 rounded hover:bg-accent/20 disabled:opacity-20 transition-colors"
                          >
                            <ArrowDown className="w-3.5 h-3.5 text-accent" />
                          </button>
                        </div>
                        <span className="font-display text-2xl text-accent w-8 text-center">{s.seed}</span>
                        <div className="flex-1">
                          <p className="font-display text-foreground">{s.pair.player1.name} & {s.pair.player2.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{(s.winPct * 100).toFixed(0)}%</span>
                            <span>•</span>
                            <span className={tierColor}>{s.pair.skillLevel} pool</span>
                            {s.tiebreakerReason && (
                              <>
                                <span>•</span>
                                <span className="italic text-muted-foreground/70">{s.tiebreakerReason}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {s.seed <= 3 && (
                          <Medal className={`w-5 h-5 ${s.seed === 1 ? "text-yellow-400" : s.seed === 2 ? "text-gray-300" : "text-amber-600"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <PlayoffBracket
            playoffMatches={state.playoffMatches}
            onStart={startPlayoffMatch}
            onComplete={completePlayoffMatch}
            isAdmin={true}
            courtCount={courtCount}
          />
        )}
      </div>

      {/* Session Export */}
      <SessionExport state={state} />
    </div>
  );
};

export default StatsPlayoffs;
