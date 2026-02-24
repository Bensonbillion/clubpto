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

interface PlayoffSeed {
  seed: number;
  player: Player;
  winPct: number;
}

interface PairStanding {
  id: string;
  player1Name: string;
  player2Name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winPct: number;
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
  const [playoffSeeds, setPlayoffSeeds] = useState<PlayoffSeed[]>([]);

  // Build pair standings from completed matches per tier
  const buildPairStandings = (skillLevel: SkillTier | "cross"): PairStanding[] => {
    const pairMap = new Map<string, PairStanding>();
    
    for (const match of state.matches.filter((m) => m.status === "completed" && m.skillLevel === skillLevel)) {
      const processPair = (pair: Pair, won: boolean) => {
        const key = [pair.player1.id, pair.player2.id].sort().join("|||");
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            id: key,
            player1Name: pair.player1.name,
            player2Name: pair.player2.name,
            wins: 0, losses: 0, gamesPlayed: 0, winPct: 0,
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

  const aPairStandings = buildPairStandings("A");
  const crossPairStandings = buildPairStandings("cross");
  const cPairStandings = buildPairStandings("C");

  // Individual standings for playoff seeding
  const withWinPct = (players: Player[]) =>
    players
      .filter((p) => p.checkedIn)
      .map((p) => ({
        ...p,
        winPct: p.gamesPlayed > 0 ? p.wins / p.gamesPlayed : 0,
      }))
      .sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        return b.wins - a.wins;
      });

  const aStandings = withWinPct(state.roster.filter((p) => p.skillLevel === "A"));
  const bStandings = withWinPct(state.roster.filter((p) => p.skillLevel === "B"));
  const cStandings = withWinPct(state.roster.filter((p) => p.skillLevel === "C"));

  const handleGeneratePlayoffSeeds = () => {
    // Build set of C player IDs who beat a B player in cross-tier matches
    const cBeatB = new Set<string>();
    const bBeatenByC = new Set<string>();
    for (const match of state.matches) {
      if (match.status !== "completed" || match.skillLevel !== "cross" || !match.winner || !match.loser) continue;
      const winnerTier = match.winner.skillLevel;
      const loserTier = match.loser.skillLevel;
      if (winnerTier === "C" && loserTier === "B") {
        [match.winner.player1.id, match.winner.player2.id].forEach((id) => cBeatB.add(id));
        [match.loser.player1.id, match.loser.player2.id].forEach((id) => bBeatenByC.add(id));
      }
    }

    // Priority: A first, then B/C with override rule
    const seeded: PlayoffSeed[] = [];

    // 1. All A players
    aStandings.forEach((p) => { seeded.push({ seed: 0, player: p, winPct: p.winPct }); });

    // 2. Interleave B and C with override:
    //    - C players who beat B get promoted above the B players they beat
    //    - B players beaten by C get demoted below those C players
    const promotedC = cStandings.filter((p) => cBeatB.has(p.id));
    const demotedB = bStandings.filter((p) => bBeatenByC.has(p.id));
    const normalB = bStandings.filter((p) => !bBeatenByC.has(p.id));
    const normalC = cStandings.filter((p) => !cBeatB.has(p.id));

    // Order: normal B, then promoted C (above demoted B), then demoted B, then normal C
    normalB.forEach((p) => { seeded.push({ seed: 0, player: p, winPct: p.winPct }); });
    promotedC.forEach((p) => { seeded.push({ seed: 0, player: p, winPct: p.winPct }); });
    demotedB.forEach((p) => { seeded.push({ seed: 0, player: p, winPct: p.winPct }); });
    normalC.forEach((p) => { seeded.push({ seed: 0, player: p, winPct: p.winPct }); });

    // Take top 8 and assign seeds
    const top8 = seeded.slice(0, 8);
    top8.forEach((s, i) => { s.seed = i + 1; });
    setPlayoffSeeds(top8);
    generatePlayoffMatches(top8);
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

  const totalPlayers = aStandings.length + bStandings.length + cStandings.length;

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
            <p className="font-display text-3xl text-foreground">{completedMatches.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">{state.totalScheduledGames}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Games</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">
              {state.matches.filter((m) => m.status === "pending").length}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Remaining</p>
          </div>
        </div>
      </div>

      {/* Pair Leaderboards by tier */}
      <div className="space-y-4">
        <PairLeaderboard title="Standings — Tier A (Advanced)" pairs={aPairStandings} />
        {crossPairStandings.length > 0 && (
          <PairLeaderboard title="Standings — Cross-Tier (B vs A/C)" pairs={crossPairStandings} />
        )}
        <PairLeaderboard title="Standings — Tier C (Beginner)" pairs={cPairStandings} />
      </div>

      {/* Playoff Section */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display text-xl text-accent">Playoffs</h3>

        {champion && (
          <div className="rounded-lg border-2 border-accent bg-accent/10 p-6 text-center space-y-2">
            <Trophy className="w-10 h-10 text-accent mx-auto" />
            <h4 className="font-display text-2xl text-accent">Champions!</h4>
            <p className="font-display text-xl text-foreground">
              {champion.player1.name} & {champion.player2.name}
            </p>
          </div>
        )}

        {(state.playoffMatches || []).length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Top 8 players seeded by tier priority (A → B → C) then Win%. NBA-style bracket with doubles teams.
            </p>
            {roundRobinComplete && (
              <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
                ✦ Round-robin complete! Generate playoff bracket below.
              </div>
            )}
            <Button
              onClick={handleGeneratePlayoffSeeds}
              disabled={totalPlayers < 4}
              className="bg-accent text-accent-foreground hover:bg-accent/80"
            >
              <Trophy className="w-4 h-4 mr-1" /> Generate Playoff Bracket
            </Button>

            {playoffSeeds.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {playoffSeeds.map((s) => (
                  <div key={s.player.id} className="flex items-center gap-3 rounded-md border border-border bg-muted p-3">
                    <span className="font-display text-2xl text-accent w-8 text-center">{s.seed}</span>
                    <div className="flex-1">
                      <p className="font-display text-foreground">{s.player.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{s.player.wins}W - {s.player.losses}L</span>
                        <span>•</span>
                        <span className="font-mono">{(s.winPct * 100).toFixed(0)}%</span>
                        <span>•</span>
                        <span className={
                          s.player.skillLevel === "A" ? "text-yellow-400" :
                          s.player.skillLevel === "B" ? "text-gray-300" :
                          "text-amber-600"
                        }>Tier {s.player.skillLevel}</span>
                      </div>
                    </div>
                    {s.seed <= 3 && (
                      <Medal className={`w-5 h-5 ${s.seed === 1 ? "text-yellow-400" : s.seed === 2 ? "text-gray-300" : "text-amber-600"}`} />
                    )}
                  </div>
                ))}
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
