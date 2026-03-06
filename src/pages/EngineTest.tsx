import { useState, useCallback, useEffect, useRef } from "react";
import { useGameState } from "@/hooks/useGameState";
import type { SkillTier } from "@/types/courtManager";

/**
 * Live Engine Test — runs the REAL useGameState hook through a full 3-court session.
 *
 * Route: /manage/test
 *
 * This page programmatically:
 *  1. Adds 36 players across A/B/C tiers
 *  2. Sets 3-court mode
 *  3. Generates the full schedule
 *  4. Validates tier isolation, court routing, equity
 *  5. Completes all games
 *  6. Adds a walk-in mid-session
 *  7. Removes a player mid-session
 *  8. Starts playoffs and validates seeding
 *  9. Runs playoff bracket to champion
 *
 * Outputs pass/fail results for every check.
 */

interface TestResult {
  section: string;
  name: string;
  passed: boolean;
  detail?: string;
}

const PLAYERS: { name: string; tier: SkillTier }[] = [
  // 12 A-tier
  ...["Benson","David","Albright","Kayode","Chizea","Timi","Folarin","Elvis","Yinka","Ossai","Segun","Dayo"]
    .map(n => ({ name: n, tier: "A" as SkillTier })),
  // 10 B-tier
  ...["Amaka","Tofunmi","Funmi","Deborah","Idris","Donnell","Kwame","Kolade","Jerome","Duke"]
    .map(n => ({ name: n, tier: "B" as SkillTier })),
  // 14 C-tier
  ...["Ese","Ngozi","Shana","Temitope","Bola","Emmanuel","Fiyin","Jaidan","Marcus","Aisha","Kemi","Tunde","Kola","Priya"]
    .map(n => ({ name: n, tier: "C" as SkillTier })),
];

const EngineTest = () => {
  const gs = useGameState({ simulate: true });
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [done, setDone] = useState(false);
  const stepRef = useRef(0);
  const stallCountRef = useRef(0);
  const maxStallTicks = 20;

  const addResult = useCallback((section: string, name: string, passed: boolean, detail?: string) => {
    setResults(prev => [...prev, { section, name, passed, detail }]);
  }, []);

  const assert = useCallback((section: string, cond: boolean, passMsg: string, failMsg: string) => {
    addResult(section, cond ? passMsg : failMsg, cond, cond ? undefined : failMsg);
  }, [addResult]);

  // Phase 1: Add all players and set config
  const runPhase1 = useCallback(() => {
    setPhase("Phase 1: Adding 36 players and configuring 3-court mode");
    gs.setSessionConfig({ courtCount: 3, durationMinutes: 85 });

    for (const p of PLAYERS) {
      gs.addPlayer(p.name, p.tier);
    }

    // Check in all players
    setTimeout(() => {
      const roster = gs.state.roster;
      for (const p of roster) {
        if (!p.checkedIn) gs.toggleCheckIn(p.id);
      }
      stepRef.current = 1;
    }, 200);
  }, [gs]);

  // Phase 2: Generate schedule
  const runPhase2 = useCallback(async () => {
    setPhase("Phase 2: Generating schedule");
    const checked = gs.state.roster.filter(p => p.checkedIn);

    assert("setup", checked.length === 36, `36 players checked in (got ${checked.length})`, `Only ${checked.length} checked in`);
    assert("setup", gs.state.sessionConfig.courtCount === 3, "Court count = 3", `Court count = ${gs.state.sessionConfig.courtCount}`);

    // Set VIP fixed pairs (Benson+Albright, David+Ade — Ade not in roster, so just Benson+Albright)
    await gs.generateFullSchedule([{ player1Name: "Benson", player2Name: "Albright" }]);
    stepRef.current = 2;
  }, [gs, assert]);

  // Phase 3: Validate schedule
  const runPhase3 = useCallback(() => {
    setPhase("Phase 3: Validating schedule");
    const { matches, pairs } = gs.state;

    assert("schedule", matches.length > 0, `Schedule generated: ${matches.length} games`, "No games generated");
    assert("schedule", pairs.length > 0, `${pairs.length} pairs created`, "No pairs created");

    // Check Benson + Albright are paired
    const bensonPair = pairs.find(p =>
      (p.player1.name === "Benson" && p.player2.name === "Albright") ||
      (p.player1.name === "Albright" && p.player2.name === "Benson")
    );
    assert("schedule", !!bensonPair, "Benson & Albright are paired (VIP pick)", "VIP pair not found");

    // 3-COURT TIER ISOLATION
    const crossMatches = matches.filter(m => m.skillLevel === "cross");
    assert("isolation", crossMatches.length === 0, `Zero cross-tier matches (${crossMatches.length})`, `${crossMatches.length} cross-tier matches!`);

    const bvA = matches.filter(m => m.matchupLabel === "B vs A");
    assert("isolation", bvA.length === 0, "No B vs A matches", `${bvA.length} B vs A`);

    const bvC = matches.filter(m => m.matchupLabel === "B vs C");
    assert("isolation", bvC.length === 0, "No B vs C matches", `${bvC.length} B vs C`);

    // Court pool correctness
    const aPool = matches.filter(m => m.courtPool === "A");
    const bPool = matches.filter(m => m.courtPool === "B");
    const cPool = matches.filter(m => m.courtPool === "C");
    assert("isolation", aPool.length > 0, `A-pool: ${aPool.length} games`, "A-pool empty");
    assert("isolation", bPool.length > 0, `B-pool: ${bPool.length} games`, "B-pool empty");
    assert("isolation", cPool.length > 0, `C-pool: ${cPool.length} games`, "C-pool empty");

    assert("isolation", aPool.every(m => m.pair1.skillLevel === "A" && m.pair2.skillLevel === "A"),
      "A-pool = only A vs A", "A-pool has non-A matches");
    assert("isolation", bPool.every(m => m.pair1.skillLevel === "B" && m.pair2.skillLevel === "B"),
      "B-pool = only B vs B", "B-pool has non-B matches");
    assert("isolation", cPool.every(m => m.pair1.skillLevel === "C" && m.pair2.skillLevel === "C"),
      "C-pool = only C vs C", "C-pool has non-C matches");

    // COURT ROUTING — initial assignment
    const court1 = matches.find(m => m.court === 1 && m.status === "playing");
    const court2 = matches.find(m => m.court === 2 && m.status === "playing");
    const court3 = matches.find(m => m.court === 3 && m.status === "playing");
    assert("routing", !!court1 && court1.courtPool === "C", "Court 1 = C-pool", court1 ? `Court 1 = ${court1.courtPool}` : "No Court 1");
    assert("routing", !!court2 && court2.courtPool === "B", "Court 2 = B-pool", court2 ? `Court 2 = ${court2.courtPool}` : "No Court 2");
    assert("routing", !!court3 && court3.courtPool === "A", "Court 3 = A-pool", court3 ? `Court 3 = ${court3.courtPool}` : "No Court 3");

    // EQUITY
    const pgc = new Map<string, number>();
    pairs.forEach(p => pgc.set(p.id, 0));
    matches.forEach(m => {
      pgc.set(m.pair1.id, (pgc.get(m.pair1.id) || 0) + 1);
      pgc.set(m.pair2.id, (pgc.get(m.pair2.id) || 0) + 1);
    });
    const counts = Array.from(pgc.values());
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const zeroPairs = pairs.filter(p => (pgc.get(p.id) || 0) === 0);
    assert("equity", zeroPairs.length === 0, "No pairs with 0 games", `${zeroPairs.length} pairs have 0 games`);
    assert("equity", max - min <= 2, `Equity gap: ${max - min} (min=${min}, max=${max})`, `Gap ${max - min} too large`);

    // NO PLAYER CONFLICTS (same slot)
    const courtCount = 3;
    let conflicts = 0;
    for (let i = 0; i < matches.length; i += courtCount) {
      const slot = matches.slice(i, i + courtCount);
      const ids = new Set<string>();
      for (const m of slot) {
        for (const id of [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id]) {
          if (ids.has(id)) conflicts++;
          ids.add(id);
        }
      }
    }
    assert("conflicts", conflicts === 0, "No player on 2 courts in same slot", `${conflicts} conflicts`);

    stepRef.current = 3;
  }, [gs, assert]);

  // Phase 4: Start session and complete games
  const runPhase4 = useCallback(() => {
    setPhase("Phase 4: Starting session and completing games");
    gs.startSession();
    stepRef.current = 4;
  }, [gs]);

  // Phase 5: Complete all games one by one (with stall detection)
  const runPhase5 = useCallback(() => {
    const { matches } = gs.state;
    const playing = matches.filter(m => m.status === "playing");

    if (playing.length > 0) {
      stallCountRef.current = 0;
      setPhase(`Phase 5: Completing games (${playing.length} playing, ${matches.filter(m => m.status === "pending").length} pending)`);
      const m = playing[0];
      const winnerId = Math.random() < 0.5 ? m.pair1.id : m.pair2.id;
      gs.completeMatch(m.id, winnerId);
      return;
    }

    const pending = matches.filter(m => m.status === "pending");
    if (pending.length === 0) {
      const completed = matches.filter(m => m.status === "completed").length;
      assert("games", completed > 0, `All games completed: ${completed}`, "No games completed");
      stallCountRef.current = 0;
      stepRef.current = 5;
      return;
    }

    // Stall detection: pending matches exist but nothing is playing
    stallCountRef.current++;
    setPhase(`Phase 5: Waiting for auto-advance (stall tick ${stallCountRef.current}/${maxStallTicks})`);
    if (stallCountRef.current >= maxStallTicks) {
      // Force-start the first pending match on an available court
      const busyCourts = new Set(matches.filter(m => m.status === "playing").map(m => m.court));
      const freeCourt = [1, 2, 3].find(c => !busyCourts.has(c)) || 1;
      const p = pending[0];
      gs.startMatch(p.id, freeCourt);
      stallCountRef.current = 0;
    }
  }, [gs, assert]);

  // Phase 6: Add walk-in mid-session (use addPlayerMidSession directly — no pre-add)
  const runPhase6 = useCallback(() => {
    setPhase("Phase 6: Adding walk-in pair (Zara + Lola, C-tier)");

    // First call adds Zara as a solo (unpaired) player
    gs.addPlayerMidSession("Zara", "C");

    setTimeout(() => {
      // Second call adds Lola and auto-pairs with Zara
      const result = gs.addPlayerMidSession("Lola", "C");
      assert("walkin", result.success, `Walk-in added: ${result.affected} games`, `Walk-in failed`);

      // Wait for state to propagate, then validate
      const checkWalkin = (retries: number) => {
        setTimeout(() => {
          const walkInPair = gs.state.pairs.find(p =>
            (p.player1.name === "Zara" || p.player2.name === "Zara") &&
            (p.player1.name === "Lola" || p.player2.name === "Lola")
          );

          if (!walkInPair && retries > 0) {
            checkWalkin(retries - 1);
            return;
          }

          assert("walkin", !!walkInPair, "Walk-in pair exists", "Walk-in pair not found");

          if (walkInPair) {
            const walkInMatches = gs.state.matches.filter(m =>
              m.pair1.id === walkInPair.id || m.pair2.id === walkInPair.id
            );
            assert("walkin", walkInMatches.length > 0, `Walk-in got ${walkInMatches.length} games`, "Walk-in got 0 games");

            const walkInCross = walkInMatches.filter(m => m.skillLevel === "cross");
            assert("walkin", walkInCross.length === 0, "Walk-in: zero cross-tier (3-court)", `${walkInCross.length} cross-tier`);

            const walkInBadPool = walkInMatches.filter(m => m.courtPool !== "C");
            assert("walkin", walkInBadPool.length === 0, "Walk-in: all C-pool", `${walkInBadPool.length} wrong pool`);
          }

          stepRef.current = 6;
        }, 500);
      };
      checkWalkin(3);
    }, 500);
  }, [gs, assert]);

  // Phase 7: Remove a player mid-session
  const runPhase7 = useCallback(() => {
    setPhase("Phase 7: Removing player (Marcus, C-tier)");
    const marcus = gs.state.roster.find(p => p.name === "Marcus");
    if (!marcus) {
      addResult("remove", "Marcus not found in roster", false, "Cannot test removal");
      stepRef.current = 7;
      return;
    }

    const result = gs.removePlayerMidSession(marcus.id);
    assert("remove", result.success, `Marcus removed, ${result.affected} games affected`, "Removal failed");

    setTimeout(() => {
      // Check no ghost matches
      const ghostMatches = gs.state.matches.filter(m =>
        m.status !== "completed" && (
          m.pair1.player1.name === "Marcus" || m.pair1.player2.name === "Marcus" ||
          m.pair2.player1.name === "Marcus" || m.pair2.player2.name === "Marcus"
        )
      );
      assert("remove", ghostMatches.length === 0, "No ghost matches with Marcus", `${ghostMatches.length} ghost matches`);
      stepRef.current = 7;
    }, 300);
  }, [gs, assert, addResult]);

  // Phase 8: Complete remaining games then start playoffs (with stall detection)
  const runPhase8 = useCallback(() => {
    const { matches } = gs.state;
    const playing = matches.filter(m => m.status === "playing");
    const pending = matches.filter(m => m.status === "pending");

    if (playing.length > 0) {
      stallCountRef.current = 0;
      setPhase(`Phase 8: Completing remaining games (${playing.length} playing, ${pending.length} pending)`);
      const m = playing[0];
      gs.completeMatch(m.id, Math.random() < 0.5 ? m.pair1.id : m.pair2.id);
      return;
    }

    if (pending.length > 0) {
      stallCountRef.current++;
      setPhase(`Phase 8: Waiting for auto-advance (stall tick ${stallCountRef.current}/${maxStallTicks})`);
      if (stallCountRef.current >= maxStallTicks) {
        const busyCourts = new Set(matches.filter(m => m.status === "playing").map(m => m.court));
        const freeCourt = [1, 2, 3].find(c => !busyCourts.has(c)) || 1;
        gs.startMatch(pending[0].id, freeCourt);
        stallCountRef.current = 0;
      }
      return;
    }

    setPhase("Phase 8: All games done, starting playoffs");
    stallCountRef.current = 0;
    stepRef.current = 8;
  }, [gs]);

  // Phase 9: Start playoffs and validate seeding
  const runPhase9 = useCallback(() => {
    setPhase("Phase 9: Starting playoffs — validating A-tier first seeding");
    gs.startPlayoffs();

    setTimeout(() => {
      const { playoffMatches } = gs.state;
      assert("playoffs", gs.state.playoffsStarted, "Playoffs started", "Playoffs not started");
      assert("playoffs", playoffMatches.length >= 2, `${playoffMatches.length} QF matches`, "Not enough playoff matches");

      // Check seeding: all A-tier pairs should come before B-tier
      // We can infer from the pairs in the playoff matches
      const playoffPairIds = new Set<string>();
      for (const pm of playoffMatches) {
        if (pm.pair1) playoffPairIds.add(pm.pair1.id);
        if (pm.pair2) playoffPairIds.add(pm.pair2.id);
      }

      const aPairsInPlayoffs = gs.state.pairs.filter(p => p.skillLevel === "A" && playoffPairIds.has(p.id));
      const bPairsInPlayoffs = gs.state.pairs.filter(p => p.skillLevel === "B" && playoffPairIds.has(p.id));
      const cPairsInPlayoffs = gs.state.pairs.filter(p => p.skillLevel === "C" && playoffPairIds.has(p.id));

      assert("playoffs", cPairsInPlayoffs.length === 0, "No C-tier in playoffs", `${cPairsInPlayoffs.length} C-tier pairs`);
      assert("playoffs", aPairsInPlayoffs.length > 0, `${aPairsInPlayoffs.length} A-tier in playoffs`, "No A-tier in playoffs");

      const totalInPlayoffs = aPairsInPlayoffs.length + bPairsInPlayoffs.length;
      assert("playoffs", totalInPlayoffs <= 8, `${totalInPlayoffs} pairs in playoffs (<= 8)`, `${totalInPlayoffs} pairs exceeds 8`);

      // B-pairs should only fill remaining spots after all A-pairs
      const totalAPairs = gs.state.pairs.filter(p => p.skillLevel === "A").length;
      if (totalAPairs >= 8) {
        assert("playoffs", bPairsInPlayoffs.length === 0, "8+ A-pairs: no B in playoffs", `${bPairsInPlayoffs.length} B-pairs snuck in`);
      } else {
        const expectedBSpots = Math.min(8 - totalAPairs, gs.state.pairs.filter(p => p.skillLevel === "B").length);
        assert("playoffs", bPairsInPlayoffs.length <= expectedBSpots,
          `B-tier fills ${bPairsInPlayoffs.length} spots (max ${expectedBSpots})`,
          `B-tier has ${bPairsInPlayoffs.length} spots but expected max ${expectedBSpots}`);
      }

      addResult("playoffs", `Seeding: ${aPairsInPlayoffs.length}A + ${bPairsInPlayoffs.length}B + ${cPairsInPlayoffs.length}C`, true,
        `A=${aPairsInPlayoffs.length}, B=${bPairsInPlayoffs.length}`);

      stepRef.current = 9;
    }, 500);
  }, [gs, assert, addResult]);

  // Phase 10: Run playoff bracket
  const runPhase10 = useCallback(() => {
    const { playoffMatches } = gs.state;
    const playing = playoffMatches.filter(m => m.status === "playing");
    const pending = playoffMatches.filter(m => m.status === "pending");

    if (playing.length > 0) {
      setPhase(`Phase 10: Playoff round (${playing.length} playing)`);
      const m = playing[0];
      if (m.pair1 && m.pair2) {
        const winnerId = Math.random() < 0.5 ? m.pair1.id : m.pair2.id;
        gs.completePlayoffMatch(m.id, winnerId);
      }
      return;
    }

    if (pending.length > 0) {
      // Start next pending match
      const pm = pending[0];
      if (pm.pair1 && pm.pair2) {
        gs.startPlayoffMatch(pm.id, 1);
      }
      return;
    }

    // All done — find champion
    const finalMatch = playoffMatches.filter(m => m.status === "completed").sort((a, b) => b.round - a.round)[0];
    if (finalMatch?.winner) {
      assert("bracket", true, `Champion: ${finalMatch.winner.player1.name} & ${finalMatch.winner.player2.name}`, "");
    } else {
      assert("bracket", false, "", "No champion determined");
    }

    const rounds = Math.max(...playoffMatches.map(m => m.round));
    assert("bracket", rounds >= 2, `${rounds} playoff rounds`, `Only ${rounds} round`);

    stepRef.current = 10;
  }, [gs, assert]);

  // Main loop
  useEffect(() => {
    if (!running || done) return;

    const interval = setInterval(() => {
      const step = stepRef.current;
      try {
        if (step === 0) runPhase1();
        else if (step === 1) runPhase2();
        else if (step === 2) {
          // Wait for schedule to generate (check if matches exist)
          if (gs.state.matches.length > 0) runPhase3();
        }
        else if (step === 3) runPhase4();
        else if (step === 4) runPhase5();
        else if (step === 5) runPhase6();
        else if (step === 6) runPhase7();
        else if (step === 7) runPhase8();
        else if (step === 8) runPhase9();
        else if (step === 9) runPhase10();
        else if (step === 10) {
          setDone(true);
          setPhase("COMPLETE");
        }
      } catch (err) {
        addResult("error", `Exception: ${(err as Error).message}`, false);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [running, done, gs.state, runPhase1, runPhase2, runPhase3, runPhase4, runPhase5, runPhase6, runPhase7, runPhase8, runPhase9, runPhase10, addResult]);

  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#F5F0EB] p-6 font-mono">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-[#C9A84C] mb-2">Engine Test — Live</h1>
        <p className="text-[#A8A29E] mb-6 text-sm">
          Runs the real useGameState hook through a full 36-player 3-court session.
          Tests tier isolation, court routing, equity, walk-in, removal, and playoffs.
        </p>

        {!running && !done && (
          <button
            onClick={() => setRunning(true)}
            className="px-8 py-3 bg-[#C9A84C] text-[#1A1A1A] font-bold text-lg rounded-none hover:bg-[#C9A84C]/80 transition-colors"
          >
            Run Full Test
          </button>
        )}

        {(running || done) && (
          <>
            <div className="mb-4 flex items-center gap-4">
              <div className={`px-4 py-2 text-sm font-bold ${done ? (failCount === 0 ? "bg-green-800" : "bg-red-800") : "bg-amber-800"}`}>
                {done ? (failCount === 0 ? "ALL PASSED" : `${failCount} FAILED`) : "RUNNING..."}
              </div>
              <span className="text-[#A8A29E] text-sm">{passCount} passed, {failCount} failed</span>
            </div>

            {phase && (
              <div className="mb-4 text-[#C9A84C] text-sm font-bold">
                {phase}
              </div>
            )}

            <div className="space-y-1 max-h-[65vh] overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className={`flex items-start gap-2 text-sm py-0.5 ${r.passed ? "text-green-400" : "text-red-400"}`}>
                  <span className="shrink-0 w-12">{r.passed ? "[PASS]" : "[FAIL]"}</span>
                  <span className="text-[#A8A29E] shrink-0 w-20">[{r.section}]</span>
                  <span>{r.name}</span>
                </div>
              ))}
            </div>

            {done && (
              <div className="mt-6 border-t border-[#3A3A3A] pt-4">
                <div className="text-lg font-bold">
                  {failCount === 0
                    ? <span className="text-green-400">ALL {passCount} TESTS PASSED</span>
                    : <span className="text-red-400">{failCount} FAILED / {passCount + failCount} TOTAL</span>
                  }
                </div>
                <button
                  onClick={() => { setResults([]); setDone(false); setRunning(false); stepRef.current = 0; gs.resetSession(); }}
                  className="mt-4 px-6 py-2 border border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C]/10 text-sm"
                >
                  Reset & Run Again
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EngineTest;
