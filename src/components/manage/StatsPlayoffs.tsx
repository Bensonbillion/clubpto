import { useGameState } from "@/hooks/useGameState";
import { Player, Pair, PlayoffMatch, SkillTier } from "@/types/courtManager";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Trophy, Medal } from "lucide-react";
import PlayoffBracket from "./PlayoffBracket";
import SessionExport from "./SessionExport";

interface StatsPlayoffsProps {
  gameState: ReturnType<typeof useGameState>;
}

interface PlayoffPairSeed {
  seed: number;
  pair: Pair;
  winPct: number;
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
  skillLevel: SkillTier;
}

const TIER_LABELS: Record<string, string> = {
  A: "Tier A — Advanced",
  B: "Tier B — Intermediate",
  C: "Tier C — Beginner",
};

const PairLeaderboard = ({ title, pairs }: { title: string; pairs: PairStanding[] }) => (
  <div className="rounded-lg border border-border bg-card p-6 space-y-3">
    <h4 className="font-display text-lg text-accent">{title}</h4>
    {pairs.length === 0 ? (
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
            {pairs.map((p, i) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/50">
                <td className="py-2.5 pr-2">
                  <span className="font-display text-accent">{i + 1}</span>
                </td>
                <td className="py-2.5 pr-2">
                  <span className="font-display text-foreground">{p.player1Name} & {p.player2Name}</span>
                </td>
                <td className="py-2.5 px-2 text-center text-foreground">{p.wins}</td>
                <td className="py-2.5 px-2 text-center text-foreground">{p.losses}</td>
                <td className="py-2.5 px-2 text-center text-muted-foreground">{p.gamesPlayed}</td>
                <td className="py-2.5 pl-2 text-right">
                  <span className="font-mono text-accent">{(p.winPct * 100).toFixed(0)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const StatsPlayoffs = ({ gameState }: StatsPlayoffsProps) => {
  const { state, checkedInPlayers, completedMatches, generatePlayoffMatches, startPlayoffMatch, completePlayoffMatch } = gameState;
  const [playoffSeeds, setPlayoffSeeds] = useState<PlayoffPairSeed[]>([]);

  // Build pair standings filtered by pair's own tier (counts ALL matches that pair played)
  const buildPairStandingsByTier = (tier: SkillTier): PairStanding[] => {
    const pairMap = new Map<string, PairStanding>();
    
    for (const match of state.matches.filter((m) => m.status === "completed")) {
      const processPair = (pair: Pair, won: boolean) => {
        if (pair.skillLevel !== tier) return; // only count pairs belonging to this tier
        const key = [pair.player1.id, pair.player2.id].sort().join("|||");
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            id: key,
            pair,
            player1Name: pair.player1.name,
            player2Name: pair.player2.name,
            wins: 0, losses: 0, gamesPlayed: 0, winPct: 0,
            skillLevel: pair.skillLevel,
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

    return Array.from(pairMap.values()).sort((a, b) => {
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return b.wins - a.wins;
    });
  };

  // Build ALL pair standings (across all match types) for playoff seeding
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
            skillLevel: pair.skillLevel,
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

    return Array.from(pairMap.values()).sort((a, b) => {
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return b.wins - a.wins;
    });
  };

  const aPairStandings = buildPairStandingsByTier("A");
  const bPairStandings = buildPairStandingsByTier("B");
  const cPairStandings = buildPairStandingsByTier("C");
  const allPairStandings = buildAllPairStandings();

  const handleGeneratePlayoffSeeds = () => {
    // B-beats-A override: find B pairs that beat A pairs in cross-tier
    const bBeatAPairIds = new Set<string>();
    // C-beats-B override: find C pairs that beat B pairs in cross-tier
    const cBeatBPairIds = new Set<string>();
    for (const match of state.matches) {
      if (match.status !== "completed" || match.skillLevel !== "cross" || !match.winner || !match.loser) continue;
      if (match.winner.skillLevel === "B" && match.loser.skillLevel === "A") {
        const winKey = [match.winner.player1.id, match.winner.player2.id].sort().join("|||");
        bBeatAPairIds.add(winKey);
      }
      if (match.winner.skillLevel === "C" && match.loser.skillLevel === "B") {
        const winKey = [match.winner.player1.id, match.winner.player2.id].sort().join("|||");
        cBeatBPairIds.add(winKey);
      }
    }

    // Separate standings by tier
    const aPairs = allPairStandings.filter((p) => p.skillLevel === "A");
    const bPairs = allPairStandings.filter((p) => p.skillLevel === "B");
    const cPairs = allPairStandings.filter((p) => p.skillLevel === "C");

    const promotedB = bPairs.filter((p) => bBeatAPairIds.has(p.id));
    const normalB = bPairs.filter((p) => !bBeatAPairIds.has(p.id));
    const promotedC = cPairs.filter((p) => cBeatBPairIds.has(p.id));
    const normalC = cPairs.filter((p) => !cBeatBPairIds.has(p.id));

    // Strict priority: A → promoted B (beat A) → normal B → promoted C (beat B) → normal C
    const ordered: PairStanding[] = [...aPairs, ...promotedB, ...normalB, ...promotedC, ...normalC];

    // Take top 8 pairs for playoff bracket
    const top = ordered.slice(0, 8);
    const seeds: PlayoffPairSeed[] = top.map((ps, i) => ({
      seed: i + 1,
      pair: ps.pair,
      winPct: ps.winPct,
    }));

    setPlayoffSeeds(seeds);
    generatePlayoffMatches(seeds);
  };

  const roundRobinComplete = state.matches.length > 0 && state.matches.every((m) => m.status === "completed");

  const allPlayoffComplete = (state.playoffMatches || []).length > 0 && (state.playoffMatches || []).every((m) => m.status === "completed");
  const playoffMatchesByRound = (state.playoffMatches || []).reduce((acc, m) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {} as Record<number, PlayoffMatch[]>);
  const rounds = Object.keys(playoffMatchesByRound).map(Number).sort((a, b) => a - b);
  const lastRound = rounds[rounds.length - 1];
  const champion = allPlayoffComplete && lastRound ? playoffMatchesByRound[lastRound]?.[0]?.winner : null;

  const totalPairs = allPairStandings.length;

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
          <h4 className="font-display text-lg text-accent">Session Pairs (Fixed)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {state.pairs.map((pair) => {
              const tierColor = pair.skillLevel === "A" ? "text-yellow-400 border-yellow-500/40" :
                               pair.skillLevel === "B" ? "text-gray-300 border-gray-300/40" :
                               "text-amber-600 border-amber-700/40";
              return (
                <div key={pair.id} className={`rounded-md border ${tierColor} bg-muted/30 p-3 text-center`}>
                  <p className="font-display text-foreground">{pair.player1.name} & {pair.player2.name}</p>
                  <p className={`text-xs uppercase tracking-widest ${tierColor.split(" ")[0]}`}>Tier {pair.skillLevel}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pair Leaderboards by tier */}
      <div className="space-y-4">
        <PairLeaderboard title="Standings — Tier A (Advanced)" pairs={aPairStandings} />
        <PairLeaderboard title="Standings — Tier B (Intermediate)" pairs={bPairStandings} />
        <PairLeaderboard title="Standings — Tier C (Beginner)" pairs={cPairStandings} />
      </div>

      {/* Playoff Section */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display text-xl text-accent">Playoffs</h3>

        {(state.playoffMatches || []).length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Top 8 pairs seeded by strict tier priority (A → B → C) then Win%. B-beats-A and C-beats-B overrides active. 8-team single-elimination bracket.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {playoffSeeds.map((s) => {
                  const tierColor = s.pair.skillLevel === "A" ? "text-yellow-400" :
                                   s.pair.skillLevel === "B" ? "text-gray-300" : "text-amber-600";
                  return (
                    <div key={s.pair.id} className="flex items-center gap-3 rounded-md border border-border bg-muted p-3">
                      <span className="font-display text-2xl text-accent w-8 text-center">{s.seed}</span>
                      <div className="flex-1">
                        <p className="font-display text-foreground">{s.pair.player1.name} & {s.pair.player2.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{(s.winPct * 100).toFixed(0)}%</span>
                          <span>•</span>
                          <span className={tierColor}>Tier {s.pair.skillLevel}</span>
                        </div>
                      </div>
                      {s.seed <= 3 && (
                        <Medal className={`w-5 h-5 ${s.seed === 1 ? "text-yellow-400" : s.seed === 2 ? "text-gray-300" : "text-amber-600"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <PlayoffBracket
            playoffMatches={state.playoffMatches}
            onStart={startPlayoffMatch}
            onComplete={completePlayoffMatch}
            isAdmin={true}
          />
        )}
      </div>

      {/* Session Export */}
      <SessionExport state={state} />
    </div>
  );
};

export default StatsPlayoffs;
