// STEP 2 — the simulation suite (docs/PTO_AMERICANO_DESIGN.md §11).
// A tiny driver plays whole pools through generateNextMatch with a seeded,
// deterministic result model. Four scenarios prove the night before any UI
// exists. Pure throughout: injected clock, zero randomness.

import { describe, expect, it } from "vitest";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoScore, AmericanoTier,
} from "@/types/americano";
import { validTargets, courtMatchesNeeded } from "../config";
import {
  generateNextMatch, matchesPlayed, pairKey, partnershipsTonight, waveSpread,
  type GeneratedMatch,
} from "../generator";
import { computeStandings, earlyCutSummary, playoffEligible, strengthOfSchedule } from "../standings";

/* ── driver ──────────────────────────────────────────────────────── */

const MATCH_MS = 9 * 60_000;

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const TIER_STRENGTH: Record<AmericanoTier, number> = { A: 40, B: 20, C: 0 };

function mkPlayers(n: number, prefix = "p"): AmericanoPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    playerId: `${prefix}${String(i).padStart(2, "0")}`,
    displayName: `${prefix}${i}`,
    tier: (i < n / 3 ? "A" : i < (2 * n) / 3 ? "B" : "C") as AmericanoTier,
    status: "present" as const,
    joinedAtMatchIndex: null,
    catchUpUsed: false,
  }));
}

function mkPool(players: AmericanoPlayer[], target: number): AmericanoPool {
  return {
    id: "pool-2",
    label: "Court 2",
    playerIds: players.map((p) => p.playerId),
    targetMatches: target,
    playoffMode: "top8",
    status: "round_robin",
    matches: [],
  };
}

interface Night {
  pool: AmericanoPool;
  players: AmericanoPlayer[];
  clock: number;
  metas: GeneratedMatch["meta"][];
  maxSpreadSeen: number;
}

function start(players: AmericanoPlayer[], target: number): Night {
  return { pool: mkPool(players, target), players, clock: 0, metas: [], maxSpreadSeen: 0 };
}

// The result model's deterministic "seed". Outcomes come from a
// strength-weighted draw hashed per matchup — deterministic, but decorrelated
// the way real nights are (a pure threshold model collapses everyone into
// identical records, which no real night does).
const RESULT_SALT = "#1";

function strengthOf(n: Night, id: string): number {
  const p = n.players.find((x) => x.playerId === id)!;
  return TIER_STRENGTH[p.tier] + (hash(id + RESULT_SALT) % 19) + 5;
}

/** Generate + play one match. Returns false when the generator says stop. */
function playOne(n: Night): boolean {
  const gen = generateNextMatch(n.pool, n.players);
  if ("blocked" in gen) return false;
  n.metas.push(gen.meta);
  for (const id of gen.meta.catchUpPlayerIds) {
    const p = n.players.find((x) => x.playerId === id)!;
    p.catchUpUsed = true;
  }
  const teamA = gen.match.teamA, teamB = gen.match.teamB;
  const a = teamA.reduce((s, id) => s + strengthOf(n, id), 0);
  const b = teamB.reduce((s, id) => s + strengthOf(n, id), 0);
  const key = teamA.join() + "|" + teamB.join() + RESULT_SALT;
  const winner = hash(key) % (a + b) < a ? "A" : "B";
  const margin = winner === "A" ? a - b : b - a;
  const score: AmericanoScore =
    (hash(key + "s") % 24) < 8 + Math.max(-6, Math.min(12, margin)) ? "2-0" : "2-1";
  const match: AmericanoMatch = {
    id: `m${n.pool.matches.length + 1}`,
    poolId: n.pool.id,
    matchIndex: n.pool.matches.length + 1,
    teamA, teamB,
    result: { winner, score },
    status: "completed",
    phase: "round_robin",
    startedAt: n.clock,
    completedAt: n.clock + MATCH_MS,
  };
  n.clock += MATCH_MS;
  n.pool.matches.push(match);
  n.maxSpreadSeen = Math.max(n.maxSpreadSeen, waveSpread(n.pool, n.players));
  return true;
}

function playAll(n: Night, cap = 200): void {
  for (let i = 0; i < cap; i++) if (!playOne(n)) break;
}

const presentIds = (n: Night) =>
  n.players.filter((p) => p.status === "present").map((p) => p.playerId);

/* ── Scenario 1: NORMAL ──────────────────────────────────────────── */

describe("Scenario 1 — normal night", () => {
  it("16 players @ target 3: exact counts, clean constraints, ordered standings", () => {
    const n = start(mkPlayers(16), 3);
    playAll(n);

    for (const id of presentIds(n)) expect(matchesPlayed(n.pool, id)).toBe(3);
    expect(n.pool.matches.length).toBe(courtMatchesNeeded(16, 3));
    expect(n.maxSpreadSeen).toBeLessThanOrEqual(1);

    // Zero repeated partnerships while an unused configuration existed.
    for (const meta of n.metas) expect(meta.fallbackLevel).toBe(0);
    const partnerships = n.pool.matches.flatMap((m) => [
      pairKey(m.teamA[0], m.teamA[1]),
      pairKey(m.teamB[0], m.teamB[1]),
    ]);
    expect(new Set(partnerships).size).toBe(partnerships.length);

    // Zero back-to-backs (pool ≥ 8, no late arrivals) and no warnings.
    for (const meta of n.metas) expect(meta.warnings).toEqual([]);
    for (let i = 1; i < n.pool.matches.length; i++) {
      const prev = new Set([...n.pool.matches[i - 1].teamA, ...n.pool.matches[i - 1].teamB]);
      for (const id of [...n.pool.matches[i].teamA, ...n.pool.matches[i].teamB]) {
        expect(prev.has(id)).toBe(false);
      }
    }

    // VARIETY (§3, amended): zero repeated foursomes while alternatives
    // existed, and the room actually remixes — every player meets at least 5
    // distinct others, pool average at least 7.
    const foursomes = n.pool.matches.map((m) => [...m.teamA, ...m.teamB].sort().join("|"));
    expect(new Set(foursomes).size).toBe(foursomes.length);
    const met = new Map<string, Set<string>>();
    for (const m of n.pool.matches) {
      const four = [...m.teamA, ...m.teamB];
      for (const x of four) {
        if (!met.has(x)) met.set(x, new Set());
        for (const y of four) if (y !== x) met.get(x)!.add(y);
      }
    }
    const encounterCounts = [...met.values()].map((s) => s.size);
    expect(Math.min(...encounterCounts)).toBeGreaterThanOrEqual(5);
    const avgEncounters = encounterCounts.reduce((a, b) => a + b, 0) / encounterCounts.length;
    expect(avgEncounters).toBeGreaterThanOrEqual(7);

    // Standings fully ordered by the chain; every row W+L = matches.
    const table = computeStandings(n.pool, n.players);
    expect(table.length).toBe(16);
    for (const row of table) expect(row.wins + row.losses).toBe(row.matchesPlayed);
    for (let i = 0; i < table.length - 1; i++) {
      const a = table[i], b = table[i + 1];
      const chainOk =
        a.wins > b.wins ||
        (a.wins === b.wins && (a.losses < b.losses ||
          (a.losses === b.losses && a.gameDiff >= b.gameDiff)));
      expect(chainOk, `rows ${i + 1}/${i + 2} chain order`).toBe(true);
    }
    // COIN FLIPS (§4, amended): SOS resolves ties BEFORE any flip fires — a
    // flag may rise only between rows tied on W-L-diff AND SOS. Whatever
    // still flips resolves the way the UI will: one visible flip at a time.
    const flagged = table.filter((r) => r.requiresCoinFlip);
    for (const row of flagged) {
      const peer = table.find(
        (r) => r.playerId !== row.playerId && r.wins === row.wins &&
          r.losses === row.losses && r.gameDiff === row.gameDiff &&
          strengthOfSchedule(n.pool, r.playerId) === strengthOfSchedule(n.pool, row.playerId),
      );
      expect(peer, `flagged row ${row.playerId} is a true W-L-diff-SOS twin`).toBeDefined();
    }
    expect(table.some((r) => r.tiebreakApplied === "sos")).toBe(true); // SOS is doing real work
    if (flagged.length > 0) {
      const resolutions: Record<string, string> = {};
      let resolved = table;
      for (let step = 0; step < 32; step++) {
        const idx = resolved.findIndex(
          (r, i) => i < resolved.length - 1 && r.requiresCoinFlip && resolved[i + 1].requiresCoinFlip &&
            resolutions[pairKey(r.playerId, resolved[i + 1].playerId)] === undefined,
        );
        if (idx === -1) break;
        const a = resolved[idx].playerId, b = resolved[idx + 1].playerId;
        resolutions[pairKey(a, b)] = hash(pairKey(a, b)) % 2 === 0 ? a : b;
        resolved = computeStandings(n.pool, n.players, resolutions);
      }
      expect(resolved.some((r) => r.requiresCoinFlip)).toBe(false);
      expect(resolved.filter((r) => r.tiebreakApplied === "coinflip").length).toBeGreaterThan(0);
    }

    // Human-readable printout (the DONE-WHEN artifact).
    const name = (id: string) => n.players.find((p) => p.playerId === id)!.displayName;
    const lines = n.pool.matches.map((m) =>
      `  #${String(m.matchIndex).padStart(2)} ${name(m.teamA[0])}+${name(m.teamA[1])} vs ${name(m.teamB[0])}+${name(m.teamB[1])} → ${m.result!.winner} ${m.result!.score}`);
    const standingsLines = table.map((r) =>
      `  ${String(r.rank).padStart(2)}. ${name(r.playerId)}  ${r.wins}W-${r.losses}L  diff ${r.gameDiff >= 0 ? "+" : ""}${r.gameDiff}  sos ${strengthOfSchedule(n.pool, r.playerId)}${r.tiebreakApplied ? `  (${r.tiebreakApplied})` : ""}${r.requiresCoinFlip ? "  [flip]" : ""}`);
    const encounterLine = `encounters: min ${Math.min(...encounterCounts)}, avg ${avgEncounters.toFixed(1)} of 15 possible · flips flagged: ${flagged.length}`;
    console.log(`SCENARIO 1 — 16 players @ 3 each (12 court matches)\n${lines.join("\n")}\nFINAL STANDINGS (${encounterLine})\n${standingsLines.join("\n")}`);
  });

  it("12 players @ target 4: same guarantees", () => {
    const n = start(mkPlayers(12, "q"), 4);
    playAll(n);
    for (const id of presentIds(n)) expect(matchesPlayed(n.pool, id)).toBe(4);
    expect(n.pool.matches.length).toBe(courtMatchesNeeded(12, 4));
    expect(n.maxSpreadSeen).toBeLessThanOrEqual(1);
    // Falling back (1+3/2+4) is the system WORKING when 1+4/2+3 would repeat;
    // the invariant is that no partnership ever actually repeats.
    const partnerships = n.pool.matches.flatMap((m) => [
      pairKey(m.teamA[0], m.teamA[1]),
      pairKey(m.teamB[0], m.teamB[1]),
    ]);
    expect(new Set(partnerships).size).toBe(partnerships.length);
    const foursomes = n.pool.matches.map((m) => [...m.teamA, ...m.teamB].sort().join("|"));
    expect(new Set(foursomes).size).toBe(foursomes.length); // remixing here too
  });
});

/* ── Scenario 2: VARIABLE SPLIT ──────────────────────────────────── */

describe("Scenario 2 — variable split (14 players)", () => {
  it("rejects target 3, runs the night at 4, lands everyone on exactly 4", () => {
    expect(validTargets(14)).not.toContain(3);
    expect(validTargets(14)).toContain(4);
    const n = start(mkPlayers(14, "v"), 4);
    playAll(n);
    for (const id of presentIds(n)) expect(matchesPlayed(n.pool, id)).toBe(4);
    expect(n.pool.matches.length).toBe(14);
  });
});

/* ── Scenario 3: EARLY CUT ───────────────────────────────────────── */

describe("Scenario 3 — early playoff cut", () => {
  it("mid-wave cut: summary matches reality, W–L chain seeds fairly", () => {
    const n = start(mkPlayers(16, "e"), 3);
    for (let i = 0; i < 10; i++) expect(playOne(n)).toBe(true);

    // 40 slots → 8 players at 3, 8 at 2.
    const cut = earlyCutSummary(n.pool, n.players);
    expect(cut.atTarget).toBe(8);
    expect(cut.below.length).toBe(8);
    for (const b of cut.below) {
      expect(matchesPlayed(n.pool, b.playerId)).toBe(b.matches);
      expect(b.matches).toBe(2);
    }

    const table = computeStandings(n.pool, n.players);
    // 2W-0L (2 matches) outranks 2W-1L (3 matches) whenever both exist.
    const twoOh = table.filter((r) => r.wins === 2 && r.losses === 0);
    const twoOne = table.filter((r) => r.wins === 2 && r.losses === 1);
    expect(twoOh.length).toBeGreaterThan(0); // this seed produces the case
    if (twoOne.length > 0) {
      const worst = Math.max(...twoOh.map((r) => r.rank));
      const best = Math.min(...twoOne.map((r) => r.rank));
      expect(worst).toBeLessThan(best);
      const boundary = table.find((r) => r.rank === worst);
      expect(boundary?.tiebreakApplied).toBe("losses");
    }
    // Everyone present-from-start is bracket-eligible at the cut.
    for (const row of table) expect(playoffEligible(row, table)).toBe(true);
  });
});

/* ── Scenario 4: MESSY NIGHT ─────────────────────────────────────── */

describe("Scenario 4 — messy night", () => {
  it("not-here swap, late arrival with one catch-up, departure fill, void", () => {
    const n = start(mkPlayers(16, "z"), 3);

    // Match 1: a selected player is marked not_arrived before the start.
    const gen1 = generateNextMatch(n.pool, n.players);
    expect("blocked" in gen1).toBe(false);
    const proposed = (gen1 as GeneratedMatch).meta.quartet;
    const absentId = proposed[1];
    n.players.find((p) => p.playerId === absentId)!.status = "not_arrived";
    const gen2 = generateNextMatch(n.pool, n.players);
    expect("blocked" in gen2).toBe(false);
    const regenerated = (gen2 as GeneratedMatch).meta.quartet;
    expect(regenerated).not.toContain(absentId);
    // The replacement comes from the same least-played (zero-match) queue.
    expect(regenerated.filter((id) => proposed.includes(id)).length).toBeGreaterThanOrEqual(3);

    // They appear in no match while absent.
    while (n.pool.matches.filter((m) => m.status === "completed").length < 6) {
      expect(playOne(n)).toBe(true);
    }
    for (const m of n.pool.matches) {
      expect([...m.teamA, ...m.teamB]).not.toContain(absentId);
    }

    // After match 6 they walk in: front of the queue, selected within 2 gens.
    const arrival = n.players.find((p) => p.playerId === absentId)!;
    arrival.status = "present";
    arrival.joinedAtMatchIndex = n.pool.matches.filter((m) => m.status === "completed").length;
    let seenWithin = -1;
    for (let g = 1; g <= 2; g++) {
      const gen = generateNextMatch(n.pool, n.players);
      expect("blocked" in gen).toBe(false);
      if ((gen as GeneratedMatch).meta.quartet.includes(absentId)) { seenWithin = g; break; }
      playOne(n);
    }
    expect(seenWithin).toBeGreaterThan(0);
    playOne(n); // the arrival's first match

    // Exactly one permitted back-to-back; catchUpUsed flips; a second refused.
    const catchUpGen = generateNextMatch(n.pool, n.players);
    expect("blocked" in catchUpGen).toBe(false);
    expect((catchUpGen as GeneratedMatch).meta.quartet).toContain(absentId);
    expect((catchUpGen as GeneratedMatch).meta.catchUpPlayerIds).toContain(absentId);
    playOne(n);
    expect(arrival.catchUpUsed).toBe(true);
    const afterCatchUp = generateNextMatch(n.pool, n.players);
    if (!("blocked" in afterCatchUp)) {
      expect((afterCatchUp as GeneratedMatch).meta.quartet).not.toContain(absentId);
    }

    // After match 9: a departure; the fill rule finishes the night.
    while (n.pool.matches.filter((m) => m.status === "completed").length < 9) {
      expect(playOne(n)).toBe(true);
    }
    const leaver = n.players.find(
      (p) => p.status === "present" && p.playerId !== absentId && matchesPlayed(n.pool, p.playerId) < 3,
    )!;
    const leaverRecordBefore = matchesPlayed(n.pool, leaver.playerId);
    leaver.status = "left";
    playAll(n);

    const counts = presentIds(n).map((id) => matchesPlayed(n.pool, id));
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(3);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);            // never target+2
    expect(counts.filter((c) => c === 4).length).toBeLessThanOrEqual(3); // a couple over

    // The leaver's earned record is preserved.
    const table = computeStandings(n.pool, n.players);
    const leaverRow = table.find((r) => r.playerId === leaver.playerId);
    expect(leaverRow?.matchesPlayed).toBe(leaverRecordBefore);

    // Standings coherent: two win-rows per completed match.
    const completed = n.pool.matches.filter((m) => m.status === "completed").length;
    expect(table.reduce((s, r) => s + r.wins, 0)).toBe(completed * 2);

    // Late arrival's eligibility follows the (leader − 1) floor.
    const arrivalRow = table.find((r) => r.playerId === absentId)!;
    const leaderMatches = Math.max(...table.map((r) => r.matchesPlayed));
    expect(playoffEligible(arrivalRow, table)).toBe(arrivalRow.matchesPlayed >= leaderMatches - 1);

    // VOID a completed mid-night match: it counts for nothing anywhere.
    const victim = n.pool.matches.find((m) => m.status === "completed" && m.matchIndex === 5)!;
    const affected = [...victim.teamA, ...victim.teamB];
    const before = affected.map((id) => matchesPlayed(n.pool, id));
    const beforeWins = computeStandings(n.pool, n.players);
    victim.status = "voided";
    const after = affected.map((id) => matchesPlayed(n.pool, id));
    for (let i = 0; i < affected.length; i++) expect(after[i]).toBe(before[i] - 1);
    const afterWins = computeStandings(n.pool, n.players);
    const winnersOfVictim = victim.result!.winner === "A" ? victim.teamA : victim.teamB;
    for (const id of winnersOfVictim) {
      const b = beforeWins.find((r) => r.playerId === id)!;
      const a = afterWins.find((r) => r.playerId === id)!;
      expect(a.wins).toBe(b.wins - 1);
    }
    expect(partnershipsTonight(n.pool).has(pairKey(victim.teamA[0], victim.teamA[1]))).toBe(false);
  });
});

/* ── SOS unit test (§4, amended) ─────────────────────────────────── */

describe("Strength of schedule", () => {
  it("orders a W-L-diff tie by opponents' win totals, annotated 'sos'", () => {
    const P = (id: string): AmericanoPlayer => ({
      playerId: id, displayName: id, tier: "B", status: "present",
      joinedAtMatchIndex: null, catchUpUsed: false,
    });
    const players = ["t1", "t2", "x1", "x2", "o1", "o2", "o3", "o4", "o5", "o6"].map(P);
    let seq = 0;
    const M = (teamA: [string, string], teamB: [string, string], winner: "A" | "B", score: AmericanoScore): AmericanoMatch => ({
      id: `s${++seq}`, poolId: "px", matchIndex: seq, teamA, teamB,
      result: { winner, score }, status: "completed", phase: "round_robin",
      startedAt: seq * 10, completedAt: seq * 10 + 5,
    });
    const pool: AmericanoPool = {
      id: "px", label: "Court 2", playerIds: players.map((p) => p.playerId),
      targetMatches: 3, playoffMode: "top8", status: "round_robin",
      matches: [
        M(["t1", "x1"], ["o1", "o2"], "A", "2-1"),   // t1: 1W-0L +1, faced o1,o2
        M(["t2", "x2"], ["o3", "o4"], "A", "2-1"),   // t2: 1W-0L +1, faced o3,o4
        M(["o1", "o2"], ["o5", "o6"], "A", "2-1"),   // o1,o2 bank a win each → t1's SOS 2
        M(["x1", "x2"], ["o5", "o6"], "B", "2-0"),   // keeps x1/x2 off the 1W-0L line
      ],
    };
    const table = computeStandings(pool, players);
    const t1 = table.find((r) => r.playerId === "t1")!;
    const t2 = table.find((r) => r.playerId === "t2")!;
    expect(t1.wins).toBe(1); expect(t2.wins).toBe(1);
    expect(t1.losses).toBe(0); expect(t2.losses).toBe(0);
    expect(t1.gameDiff).toBe(1); expect(t2.gameDiff).toBe(1);
    expect(strengthOfSchedule(pool, "t1")).toBe(2);
    expect(strengthOfSchedule(pool, "t2")).toBe(0);
    expect(t1.rank).toBeLessThan(t2.rank);          // harder road ranks higher
    expect(t1.tiebreakApplied).toBe("sos");
    expect(t1.requiresCoinFlip).toBe(false);
    expect(t2.requiresCoinFlip).toBe(false);
  });
});
