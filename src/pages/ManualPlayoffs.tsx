import { useState, useEffect, useCallback } from "react";
import { query } from "@/lib/turso";
import { awardPoints } from "@/lib/leaderboard";
import { Trophy, Check, Search, ChevronRight, Lock } from "lucide-react";

// ── Types ──────────────────────────────────────────────────

interface DbPlayer {
  id: string;
  first_name: string;
  preferred_name: string | null;
  display: string;
}

interface SeedPair {
  seed: number;
  player1: DbPlayer | null;
  player2: DbPlayer | null;
}

interface BracketMatch {
  id: string;
  round: "QF" | "SF" | "F";
  seed1: number;
  seed2: number;
  pair1: SeedPair | null;
  pair2: SeedPair | null;
  winner: SeedPair | null;
  pointsAwarded: boolean;
}

const PASSCODE = "9999";

// ── Component ──────────────────────────────────────────────

const ManualPlayoffs = () => {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  // Player data
  const [allPlayers, setAllPlayers] = useState<DbPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Seeds (1-8, each has 2 players)
  const [seeds, setSeeds] = useState<SeedPair[]>(
    Array.from({ length: 8 }, (_, i) => ({ seed: i + 1, player1: null, player2: null })),
  );

  // Bracket
  const [bracket, setBracket] = useState<BracketMatch[]>([]);
  const [bracketStarted, setBracketStarted] = useState(false);

  // Player picker state
  const [pickingFor, setPickingFor] = useState<{ seed: number; slot: "player1" | "player2" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Status messages
  const [statusMsg, setStatusMsg] = useState("");

  // ── Load players ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const result = await query(
          "SELECT id, first_name, preferred_name FROM players WHERE is_deleted = 0 ORDER BY COALESCE(preferred_name, first_name)",
        );
        setAllPlayers(
          result.rows.map((r: any) => ({
            id: r.id,
            first_name: r.first_name,
            preferred_name: r.preferred_name,
            display: r.preferred_name || r.first_name,
          })),
        );
      } catch (err) {
        console.error("Failed to load players:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Passcode gate ───────────────────────────────────────
  const handleDigit = (d: string) => {
    const next = code + d;
    setCodeError(false);
    if (next.length === 4) {
      if (next === PASSCODE) setUnlocked(true);
      else { setCodeError(true); setCode(""); }
    } else setCode(next);
  };

  // ── Player selection ────────────────────────────────────
  const usedPlayerIds = new Set<string>();
  seeds.forEach((s) => {
    if (s.player1) usedPlayerIds.add(s.player1.id);
    if (s.player2) usedPlayerIds.add(s.player2.id);
  });

  const filteredPlayers = allPlayers.filter((p) => {
    if (usedPlayerIds.has(p.id)) return false;
    if (!searchQuery) return true;
    return p.display.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectPlayer = (player: DbPlayer) => {
    if (!pickingFor) return;
    setSeeds((prev) =>
      prev.map((s) =>
        s.seed === pickingFor.seed ? { ...s, [pickingFor.slot]: player } : s,
      ),
    );
    setPickingFor(null);
    setSearchQuery("");
  };

  const clearPlayer = (seed: number, slot: "player1" | "player2") => {
    setSeeds((prev) => prev.map((s) => (s.seed === seed ? { ...s, [slot]: null } : s)));
  };

  // ── Generate bracket ───────────────────────────────────
  const allSeedsFilled = seeds.every((s) => s.player1 && s.player2);

  const generateBracket = () => {
    // Standard 8-seed bracket: 1v8, 4v5, 2v7, 3v6
    const qf: BracketMatch[] = [
      { id: "qf1", round: "QF", seed1: 1, seed2: 8, pair1: seeds[0], pair2: seeds[7], winner: null, pointsAwarded: false },
      { id: "qf2", round: "QF", seed1: 4, seed2: 5, pair1: seeds[3], pair2: seeds[4], winner: null, pointsAwarded: false },
      { id: "qf3", round: "QF", seed1: 2, seed2: 7, pair1: seeds[1], pair2: seeds[6], winner: null, pointsAwarded: false },
      { id: "qf4", round: "QF", seed1: 3, seed2: 6, pair1: seeds[2], pair2: seeds[5], winner: null, pointsAwarded: false },
    ];
    const sf: BracketMatch[] = [
      { id: "sf1", round: "SF", seed1: 0, seed2: 0, pair1: null, pair2: null, winner: null, pointsAwarded: false },
      { id: "sf2", round: "SF", seed1: 0, seed2: 0, pair1: null, pair2: null, winner: null, pointsAwarded: false },
    ];
    const f: BracketMatch[] = [
      { id: "f1", round: "F", seed1: 0, seed2: 0, pair1: null, pair2: null, winner: null, pointsAwarded: false },
    ];
    setBracket([...qf, ...sf, ...f]);
    setBracketStarted(true);
  };

  // ── Select winner & award points ───────────────────────
  const selectWinner = useCallback(
    async (matchId: string, winner: SeedPair) => {
      setBracket((prev) => {
        const updated = prev.map((m) => (m.id === matchId ? { ...m, winner } : m));

        // Advance winner to next round
        if (matchId === "qf1") {
          const sf = updated.find((m) => m.id === "sf1")!;
          updated[updated.indexOf(sf)] = { ...sf, pair1: winner, seed1: winner.seed };
        } else if (matchId === "qf2") {
          const sf = updated.find((m) => m.id === "sf1")!;
          updated[updated.indexOf(sf)] = { ...sf, pair2: winner, seed2: winner.seed };
        } else if (matchId === "qf3") {
          const sf = updated.find((m) => m.id === "sf2")!;
          updated[updated.indexOf(sf)] = { ...sf, pair1: winner, seed1: winner.seed };
        } else if (matchId === "qf4") {
          const sf = updated.find((m) => m.id === "sf2")!;
          updated[updated.indexOf(sf)] = { ...sf, pair2: winner, seed2: winner.seed };
        } else if (matchId === "sf1") {
          const f = updated.find((m) => m.id === "f1")!;
          updated[updated.indexOf(f)] = { ...f, pair1: winner, seed1: winner.seed };
        } else if (matchId === "sf2") {
          const f = updated.find((m) => m.id === "f1")!;
          updated[updated.indexOf(f)] = { ...f, pair2: winner, seed2: winner.seed };
        }

        return updated;
      });

      // Award points
      const match = bracket.find((m) => m.id === matchId);
      if (!match || match.pointsAwarded) return;

      const pts: 5 | 10 = matchId === "f1" ? 10 : 5;
      const reason = matchId === "f1" ? "tournament_win" as const : "playoff_win" as const;

      const players = [winner.player1, winner.player2].filter(Boolean) as DbPlayer[];
      let awarded = 0;
      for (const p of players) {
        const result = await awardPoints(p.id, pts, reason, `manual-playoff-${matchId}`);
        if (result.success) awarded++;
      }

      setBracket((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, pointsAwarded: true } : m)),
      );

      const roundName = matchId === "f1" ? "Final" : matchId.startsWith("sf") ? "Semifinal" : "Quarterfinal";
      setStatusMsg(
        `${roundName}: ${winner.player1?.display} & ${winner.player2?.display} — ${pts} pts awarded to ${awarded} player(s)`,
      );
      setTimeout(() => setStatusMsg(""), 4000);
    },
    [bracket],
  );

  // ── Passcode screen ────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <Lock className="w-10 h-10 text-[#C9A84C] mb-4" />
        <h2 className="font-serif text-2xl text-[#C9A84C] mb-2">Playoff Admin</h2>
        <p className="text-[#A8A29E] text-sm mb-6">Enter passcode</p>
        <div className="flex gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < code.length ? "bg-[#C9A84C] border-[#C9A84C]" : "border-[#A8A29E]/40"
              } ${codeError ? "border-red-500 bg-red-500/30" : ""}`}
            />
          ))}
        </div>
        {codeError && <p className="text-red-400 text-sm mb-3">Incorrect</p>}
        <div className="grid grid-cols-3 gap-3 max-w-[240px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", ""].map((d, i) =>
            d === "" ? <div key={i} /> : (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                className="w-16 h-16 rounded-lg border border-[#2D2D2D] bg-[#2D2D2D] text-[#F5F0EB] text-xl hover:border-[#C9A84C]/40 transition-all active:scale-95"
              >
                {d}
              </button>
            ),
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <p className="text-[#A8A29E] animate-pulse">Loading players...</p>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#F5F0EB]">
      <header className="border-b border-[#2D2D2D] px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-[#C9A84C]">Manual Playoff Bracket</h1>
          <p className="text-xs text-[#A8A29E] mt-1">One-time playoff resolution — select winners to award points</p>
        </div>
        <Trophy className="w-6 h-6 text-[#C9A84C]" />
      </header>

      {statusMsg && (
        <div className="mx-4 md:mx-6 mt-4 p-3 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-sm text-[#C9A84C] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {statusMsg}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-8">
        {/* ── Step 1: Seed Setup ───────────────────────────── */}
        {!bracketStarted && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg text-[#F5F0EB]">Set Up Seeds</h2>
              <span className="text-xs text-[#A8A29E]">
                Seeds 1-7 = Tier A standings, Seed 8 = Albright's team (Tier B)
              </span>
            </div>

            <div className="space-y-2">
              {seeds.map((seed) => (
                <div
                  key={seed.seed}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[#2D2D2D] bg-[#2D2D2D]/50"
                >
                  <span className="font-mono text-[#C9A84C] font-bold w-8 text-center">
                    #{seed.seed}
                  </span>

                  {/* Player 1 */}
                  <PlayerSlot
                    player={seed.player1}
                    onPick={() => { setPickingFor({ seed: seed.seed, slot: "player1" }); setSearchQuery(""); }}
                    onClear={() => clearPlayer(seed.seed, "player1")}
                  />

                  <span className="text-[#A8A29E] text-xs">&</span>

                  {/* Player 2 */}
                  <PlayerSlot
                    player={seed.player2}
                    onPick={() => { setPickingFor({ seed: seed.seed, slot: "player2" }); setSearchQuery(""); }}
                    onClear={() => clearPlayer(seed.seed, "player2")}
                  />
                </div>
              ))}
            </div>

            {allSeedsFilled && (
              <button
                onClick={generateBracket}
                className="w-full py-3 border border-[#C9A84C] text-[#C9A84C] font-serif text-lg hover:bg-[#C9A84C] hover:text-[#1A1A1A] transition-colors"
              >
                Generate Bracket
              </button>
            )}
          </section>
        )}

        {/* ── Player Picker Modal ─────────────────────────── */}
        {pickingFor && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center">
            <div className="bg-[#2D2D2D] w-full max-w-md max-h-[70vh] rounded-t-xl md:rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#1A1A1A] flex items-center gap-3">
                <Search className="w-4 h-4 text-[#A8A29E]" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent text-[#F5F0EB] outline-none placeholder-[#A8A29E]/50"
                />
                <button
                  onClick={() => { setPickingFor(null); setSearchQuery(""); }}
                  className="text-xs text-[#A8A29E] hover:text-[#F5F0EB]"
                >
                  Cancel
                </button>
              </div>
              <div className="overflow-y-auto max-h-[50vh] p-2">
                {filteredPlayers.length === 0 ? (
                  <p className="text-center text-[#A8A29E] text-sm py-6">No players found</p>
                ) : (
                  filteredPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectPlayer(p)}
                      className="w-full text-left px-3 py-2.5 rounded hover:bg-[#1A1A1A] text-sm text-[#F5F0EB] transition-colors"
                    >
                      {p.display}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Bracket ─────────────────────────────── */}
        {bracketStarted && (
          <section className="space-y-6">
            <RoundSection
              title="Quarterfinals"
              subtitle="Winner gets 5 pts each"
              matches={bracket.filter((m) => m.round === "QF")}
              onSelectWinner={selectWinner}
            />
            <RoundSection
              title="Semifinals"
              subtitle="Winner gets 5 pts each"
              matches={bracket.filter((m) => m.round === "SF")}
              onSelectWinner={selectWinner}
            />
            <RoundSection
              title="Final"
              subtitle="Winner gets 10 pts each"
              matches={bracket.filter((m) => m.round === "F")}
              onSelectWinner={selectWinner}
            />

            {/* Champion banner */}
            {bracket.find((m) => m.id === "f1")?.winner && (
              <div className="text-center py-8 space-y-3 border border-[#C9A84C]/30 rounded-lg bg-[#C9A84C]/5">
                <Trophy className="w-12 h-12 text-[#C9A84C] mx-auto" />
                <h3 className="font-serif text-3xl text-[#C9A84C]">Champions</h3>
                <p className="text-xl text-[#F5F0EB]">
                  {bracket.find((m) => m.id === "f1")!.winner!.player1?.display}
                  {" & "}
                  {bracket.find((m) => m.id === "f1")!.winner!.player2?.display}
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────

const PlayerSlot = ({
  player,
  onPick,
  onClear,
}: {
  player: DbPlayer | null;
  onPick: () => void;
  onClear: () => void;
}) => {
  if (player) {
    return (
      <button
        onClick={onClear}
        className="flex-1 text-left px-3 py-2 rounded border border-[#C9A84C]/30 bg-[#C9A84C]/5 text-sm text-[#F5F0EB] hover:border-red-400/50 hover:bg-red-400/5 transition-colors group"
      >
        <span className="group-hover:line-through">{player.display}</span>
        <span className="text-[10px] text-[#A8A29E] ml-2 group-hover:text-red-400">tap to change</span>
      </button>
    );
  }
  return (
    <button
      onClick={onPick}
      className="flex-1 px-3 py-2 rounded border border-dashed border-[#A8A29E]/30 text-sm text-[#A8A29E] hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-colors"
    >
      Select player...
    </button>
  );
};

const RoundSection = ({
  title,
  subtitle,
  matches,
  onSelectWinner,
}: {
  title: string;
  subtitle: string;
  matches: BracketMatch[];
  onSelectWinner: (matchId: string, winner: SeedPair) => void;
}) => (
  <div className="space-y-3">
    <div>
      <h3 className="font-serif text-lg text-[#F5F0EB]">{title}</h3>
      <p className="text-xs text-[#A8A29E]">{subtitle}</p>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} onSelectWinner={onSelectWinner} />
      ))}
    </div>
  </div>
);

const MatchCard = ({
  match,
  onSelectWinner,
}: {
  match: BracketMatch;
  onSelectWinner: (matchId: string, winner: SeedPair) => void;
}) => {
  const ready = match.pair1?.player1 && match.pair2?.player1;
  const done = match.winner !== null;

  return (
    <div
      className={`rounded-lg border p-4 space-y-2 ${
        done
          ? "border-[#C9A84C]/40 bg-[#C9A84C]/5"
          : "border-[#2D2D2D] bg-[#2D2D2D]/50"
      }`}
    >
      {/* Pair 1 */}
      <PairRow
        pair={match.pair1}
        isWinner={done && match.winner?.seed === match.pair1?.seed}
        canSelect={ready && !done}
        onSelect={() => match.pair1 && onSelectWinner(match.id, match.pair1)}
      />

      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-[#2D2D2D]" />
        <span className="text-[10px] text-[#A8A29E] uppercase">vs</span>
        <div className="flex-1 border-t border-[#2D2D2D]" />
      </div>

      {/* Pair 2 */}
      <PairRow
        pair={match.pair2}
        isWinner={done && match.winner?.seed === match.pair2?.seed}
        canSelect={ready && !done}
        onSelect={() => match.pair2 && onSelectWinner(match.id, match.pair2)}
      />

      {done && match.pointsAwarded && (
        <div className="flex items-center gap-1 text-[10px] text-[#C9A84C]">
          <Check className="w-3 h-3" />
          Points awarded
        </div>
      )}
    </div>
  );
};

const PairRow = ({
  pair,
  isWinner,
  canSelect,
  onSelect,
}: {
  pair: SeedPair | null;
  isWinner: boolean;
  canSelect: boolean;
  onSelect: () => void;
}) => {
  if (!pair?.player1 || !pair?.player2) {
    return <div className="py-2 text-sm text-[#A8A29E] italic">Waiting...</div>;
  }

  return (
    <button
      onClick={canSelect ? onSelect : undefined}
      disabled={!canSelect}
      className={`w-full text-left py-2 px-3 rounded flex items-center justify-between transition-colors ${
        isWinner
          ? "bg-[#C9A84C]/10 text-[#C9A84C]"
          : canSelect
          ? "hover:bg-[#1A1A1A] text-[#F5F0EB] cursor-pointer"
          : "text-[#F5F0EB]/60 cursor-default"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-[#C9A84C]/60">#{pair.seed}</span>
        <span className="text-sm">
          {pair.player1.display} & {pair.player2.display}
        </span>
        {isWinner && <Trophy className="w-3.5 h-3.5 text-[#C9A84C]" />}
      </span>
      {canSelect && <ChevronRight className="w-4 h-4 text-[#A8A29E]" />}
    </button>
  );
};

export default ManualPlayoffs;
