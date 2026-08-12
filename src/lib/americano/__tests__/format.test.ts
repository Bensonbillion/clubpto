// STEP F — configurable match format.
//
// The engine is format-blind: selection, variety, the wave property, the
// chain, SOS and the coin all consume a differential. This suite pins the one
// place that knows the difference, and — most importantly — proves that best
// of 3 still means exactly what it always meant.

import { describe, expect, it } from "vitest";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoSession, MatchFormat,
} from "@/types/americano";
import {
  DEFAULT_FORMAT, entryOptions, formatLabel, isFormatLocked, matchFormatOf,
  playoffFormat, resultDiff, resultNotation, setDefaultFormat, setPoolFormat,
  setsToWin, stampPlayoffFormat, validTargetPoints,
} from "../format";
import { computeRecords, computeStandings } from "../standings";
import { generateNextMatch, matchesPlayed } from "../generator";
import { applyResult, ensureLive } from "../live";
import { pendingFlips } from "../flips";
import { migrateAmericanoSession } from "../migrate";

const BO3: MatchFormat = { kind: "bestOf", sets: 3 };
const BO5: MatchFormat = { kind: "bestOf", sets: 5 };
const G7: MatchFormat = { kind: "singleGame", targetPoints: 7 };

const mkPlayers = (n: number, prefix = "p"): AmericanoPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    playerId: `${prefix}${String(i).padStart(2, "0")}`,
    displayName: `${prefix}${i}`,
    tier: (i < n / 3 ? "A" : i < (2 * n) / 3 ? "B" : "C") as "A" | "B" | "C",
    status: "present" as const, joinedAtMatchIndex: null, catchUpUsed: false,
  }));

const mkPool = (players: AmericanoPlayer[], target: number, format: MatchFormat): AmericanoPool => ({
  id: "court-2", label: "Court 2", playerIds: players.map((p) => p.playerId),
  targetMatches: target, playoffMode: "top8", status: "round_robin",
  matches: [], matchFormat: format,
});

const mkSession = (pools: AmericanoPool[], players: AmericanoPlayer[]): AmericanoSession => ({
  id: "night-f", date: "2026-08-12", sessionName: "format",
  players, pools, defaultMatchFormat: pools[0].matchFormat,
  isPractice: true, status: "active",
});

/* ── the differential ────────────────────────────────────────────── */

describe("differential is format-defined (STEP F)", () => {
  it("BEST OF 3 REDUCES TO THE ORIGINAL RULE — the backward-compatibility proof", () => {
    // This is the whole reason nothing else in the chain had to change: at
    // best of 3, games-won-minus-games-lost IS the old +2 / +1 table.
    expect(setsToWin(3)).toBe(2);
    expect(resultDiff(BO3, { winner: "A", setsLost: 0 })).toEqual({ win: +2, loss: -2 });
    expect(resultDiff(BO3, { winner: "A", setsLost: 1 })).toEqual({ win: +1, loss: -1 });
  });

  it("best of 5 spans ±3 / ±2 / ±1", () => {
    expect(setsToWin(5)).toBe(3);
    expect(resultDiff(BO5, { winner: "A", setsLost: 0 })).toEqual({ win: +3, loss: -3 });
    expect(resultDiff(BO5, { winner: "A", setsLost: 1 })).toEqual({ win: +2, loss: -2 });
    expect(resultDiff(BO5, { winner: "B", setsLost: 2 })).toEqual({ win: +1, loss: -1 });
  });

  it("a single game to T is ±(T − the loser's score)", () => {
    expect(resultDiff(G7, { winner: "A", loserPoints: 0 })).toEqual({ win: +7, loss: -7 });
    expect(resultDiff(G7, { winner: "A", loserPoints: 4 })).toEqual({ win: +3, loss: -3 });
    expect(resultDiff(G7, { winner: "B", loserPoints: 6 })).toEqual({ win: +1, loss: -1 });
    expect(resultDiff({ kind: "singleGame", targetPoints: 11 }, { winner: "A", loserPoints: 9 }))
      .toEqual({ win: +2, loss: -2 });
  });
});

/* ── entry and notation, generated from the format ───────────────── */

describe("the entry row is generated, never hard-coded (STEP F)", () => {
  it("two buttons at best of 3, three at best of 5, T at a game to T", () => {
    expect(entryOptions(BO3).map((o) => o.label)).toEqual(["2–0", "2–1"]);
    expect(entryOptions(BO5).map((o) => o.label)).toEqual(["3–0", "3–1", "3–2"]);
    expect(entryOptions(G7)).toHaveLength(7);
    expect(entryOptions(G7).map((o) => o.label)).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
    // Every button records a well-formed result for its format.
    for (const f of [BO3, BO5, G7]) {
      for (const opt of entryOptions(f)) {
        const d = resultDiff(f, { winner: "A", ...opt.value });
        expect(d.win).toBeGreaterThan(0);
        expect(d.loss).toBe(-d.win);
      }
    }
  });

  it("the log renders each result in its own notation", () => {
    expect(resultNotation(BO3, { winner: "A", setsLost: 1 })).toBe("2–1");
    expect(resultNotation(BO5, { winner: "A", setsLost: 2 })).toBe("3–2");
    expect(resultNotation(G7, { winner: "B", loserPoints: 4 })).toBe("7–4");
    expect(formatLabel(BO5)).toBe("Best of 5");
    expect(formatLabel(G7)).toBe("Game to 7");
    expect(validTargetPoints()[0]).toBe(4);
    expect(validTargetPoints().at(-1)).toBe(15);
  });
});

/* ── the lock ────────────────────────────────────────────────────── */

describe("format locks on the first recorded result (STEP F)", () => {
  const build = () => {
    const players = mkPlayers(8);
    return mkSession([mkPool(players, 2, G7)], players);
  };

  it("is mutable while the pool has no results, and carries the session default", () => {
    let s = build();
    expect(isFormatLocked(s.pools[0])).toBe(false);
    s = setPoolFormat(s, "court-2", BO3);
    expect(s.pools[0].matchFormat).toEqual(BO3);
    s = setDefaultFormat(s, BO5);
    expect(s.defaultMatchFormat).toEqual(BO5);
    expect(s.pools[0].matchFormat).toEqual(BO5); // unlocked pools follow
  });

  it("rejects a change once a result exists — and a VOID does not unlock it", () => {
    let s = build();
    s = ensureLive(s, 0);
    const live = s.pools[0].matches.find((m) => m.status === "active")!;
    s = applyResult(s, live.id, { winner: "A", loserPoints: 3 }, 60_000);
    expect(isFormatLocked(s.pools[0])).toBe(true);
    expect(setPoolFormat(s, "court-2", BO3)).toBe(s); // identity — rejected

    // Voided-only history is STILL locked: the honest remedy is void, change,
    // replay — not a night with two meanings of "+2".
    const voided: AmericanoSession = {
      ...s,
      pools: s.pools.map((p) => ({
        ...p, matches: p.matches.map((m) => ({ ...m, status: "voided" as const })),
      })),
    };
    expect(isFormatLocked(voided.pools[0])).toBe(true);
    expect(setPoolFormat(voided, "court-2", BO3)).toBe(voided);
    // The session default cannot reach in and change it either.
    expect(setDefaultFormat(voided, BO3).pools[0].matchFormat).toEqual(G7);
  });

  it("refuses formats we cannot play", () => {
    const s = build();
    expect(setPoolFormat(s, "court-2", { kind: "singleGame", targetPoints: 3 })).toBe(s);
    expect(setPoolFormat(s, "court-2", { kind: "singleGame", targetPoints: 16 })).toBe(s);
    expect(setPoolFormat(s, "court-2", { kind: "bestOf", sets: 4 as 3 })).toBe(s);
    expect(setPoolFormat(s, "nope", BO3)).toBe(s);
  });
});

/* ── mixed formats ───────────────────────────────────────────────── */

describe("two courts, two formats, one night (STEP F)", () => {
  it("each pool computes its own standings on its own differential", () => {
    const a = mkPlayers(4, "a");
    const b = mkPlayers(4, "b");
    const poolA: AmericanoPool = {
      ...mkPool(a, 1, BO3), id: "court-2",
      matches: [{
        id: "court-2-m1", poolId: "court-2", matchIndex: 1,
        teamA: [a[0].playerId, a[1].playerId], teamB: [a[2].playerId, a[3].playerId],
        result: { winner: "A", setsLost: 0 }, status: "completed",
        phase: "round_robin", startedAt: 0, completedAt: 1,
      }],
    };
    const poolB: AmericanoPool = {
      ...mkPool(b, 1, G7), id: "court-1", label: "Court 1",
      matches: [{
        id: "court-1-m1", poolId: "court-1", matchIndex: 1,
        teamA: [b[0].playerId, b[1].playerId], teamB: [b[2].playerId, b[3].playerId],
        result: { winner: "A", loserPoints: 2 }, status: "completed",
        phase: "round_robin", startedAt: 0, completedAt: 1,
      }],
    };
    const players = [...a, ...b];

    // Best of 3, 2–0 → ±2. Game to 7, 7–2 → ±5. Independently.
    expect(computeRecords(poolA).get(a[0].playerId)!.gameDiff).toBe(+2);
    expect(computeRecords(poolA).get(a[2].playerId)!.gameDiff).toBe(-2);
    expect(computeRecords(poolB).get(b[0].playerId)!.gameDiff).toBe(+5);
    expect(computeRecords(poolB).get(b[2].playerId)!.gameDiff).toBe(-5);

    const rowsA = computeStandings(poolA, players);
    const rowsB = computeStandings(poolB, players);
    expect(rowsA.find((r) => r.playerId === a[0].playerId)!.gameDiff).toBe(+2);
    expect(rowsB.find((r) => r.playerId === b[0].playerId)!.gameDiff).toBe(+5);
    // Neither pool's format leaked into the other.
    expect(matchFormatOf(poolA, poolA.matches[0])).toEqual(BO3);
    expect(matchFormatOf(poolB, poolB.matches[0])).toEqual(G7);
  });
});

/* ── the playoff hook (lib now, UI in Step 7) ────────────────────── */

describe("playoff format override (STEP F, consumed by Step 7)", () => {
  it("defaults to the pool's format and stamps only a real override", () => {
    const players = mkPlayers(8);
    const pool = mkPool(players, 2, G7);
    expect(playoffFormat(pool)).toEqual(G7);
    expect(playoffFormat(pool, BO5)).toEqual(BO5);
    expect(playoffFormat(pool, { kind: "singleGame", targetPoints: 99 })).toEqual(G7); // invalid ignored

    const match: AmericanoMatch = {
      id: "court-2-sf1", poolId: "court-2", matchIndex: 99,
      teamA: ["a", "b"], teamB: ["c", "d"], result: null, status: "active",
      phase: "playoff_sf1", startedAt: 0, completedAt: null,
    };
    expect(stampPlayoffFormat(match, pool)).toBe(match);          // no stamp needed
    const stamped = stampPlayoffFormat(match, pool, BO5);
    expect(stamped.format).toEqual(BO5);
    // A stamped bracket match renders in ITS format, not the pool's.
    expect(matchFormatOf(pool, stamped)).toEqual(BO5);
    expect(resultNotation(matchFormatOf(pool, stamped), { winner: "A", setsLost: 2 })).toBe("3–2");
  });
});

/* ── migration ───────────────────────────────────────────────────── */

describe("legacy results migrate BEHAVIOURALLY unchanged (STEP F)", () => {
  it("'2-0'/'2-1' become setsLost 0/1 with identical diffs and standings", () => {
    const players = mkPlayers(8);
    const legacyMatches = [
      { id: "court-2-m1", poolId: "court-2", matchIndex: 1,
        teamA: ["p00", "p01"], teamB: ["p02", "p03"],
        result: { winner: "A", score: "2-0" }, status: "completed",
        phase: "round_robin", startedAt: 0, completedAt: 1 },
      { id: "court-2-m2", poolId: "court-2", matchIndex: 2,
        teamA: ["p04", "p05"], teamB: ["p06", "p07"],
        result: { winner: "B", score: "2-1" }, status: "completed",
        phase: "round_robin", startedAt: 2, completedAt: 3 },
    ];
    const legacy = {
      id: "night-old", date: "2026-08-12", sessionName: "", players,
      pools: [
        { id: "court-2", label: "Court 2", playerIds: players.map((p) => p.playerId),
          targetMatches: 2, playoffMode: "top8", status: "round_robin", matches: legacyMatches },
        { id: "court-1", label: "Court 1", playerIds: [], targetMatches: 4,
          playoffMode: "undecided", status: "setup", matches: [] },
      ],
      isPractice: true, status: "active",
    };
    const healed = migrateAmericanoSession(legacy, "2026-08-12")!;
    const pool = healed.pools[0];

    // Shape converted, format defaulted to what these matches were played in.
    expect(pool.matchFormat).toEqual(DEFAULT_FORMAT);
    expect(healed.defaultMatchFormat).toEqual(DEFAULT_FORMAT);
    expect(pool.matches[0].result).toEqual({ winner: "A", setsLost: 0 });
    expect(pool.matches[1].result).toEqual({ winner: "B", setsLost: 1 });

    // BEHAVIOUR unchanged: the same diffs the hard-coded table used to give.
    const recs = computeRecords(pool);
    expect(recs.get("p00")!.gameDiff).toBe(+2);
    expect(recs.get("p02")!.gameDiff).toBe(-2);
    expect(recs.get("p06")!.gameDiff).toBe(+1);
    expect(recs.get("p04")!.gameDiff).toBe(-1);
    expect(JSON.parse(JSON.stringify(healed))).toEqual(healed);
  });
});

/* ── a full single-game night ────────────────────────────────────── */

describe("a full 16 @ 3 night played as a single game to 7 (STEP F)", () => {
  it("diff is T − the loser's score throughout, and the night converges", () => {
    const players = mkPlayers(16);
    let s = mkSession([mkPool(players, 3, G7)], players);
    let clock = 0;
    const expected = new Map<string, number>();

    for (let step = 0; step < 40; step++) {
      s = ensureLive(s, clock);
      const live = s.pools[0].matches.find((m) => m.status === "active");
      if (!live) break;
      // Refresh at every step, exactly as liveloop does.
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);

      const loserPoints = step % 7; // walks the whole 0..6 alphabet
      const winner = step % 2 ? "A" : "B";
      const margin = 7 - loserPoints;
      for (const id of winner === "A" ? live.teamA : live.teamB) {
        expected.set(id, (expected.get(id) ?? 0) + margin);
      }
      for (const id of winner === "A" ? live.teamB : live.teamA) {
        expected.set(id, (expected.get(id) ?? 0) - margin);
      }
      s = applyResult(s, live.id, { winner, loserPoints }, clock + 60_000);
      clock += 60_000;
    }

    const pool = s.pools[0];
    expect(pool.matches).toHaveLength(12);           // 16 @ 3, exact as ever
    for (const p of players) expect(matchesPlayed(pool, p.playerId)).toBe(3);
    expect(generateNextMatch(pool, s.players)).toEqual({ blocked: "all_at_target" });

    // Every player's differential is the sum of ±(7 − loser's score).
    const rows = computeStandings(pool, s.players);
    for (const row of rows) {
      expect(row.gameDiff, `diff for ${row.playerId}`).toBe(expected.get(row.playerId) ?? 0);
    }
    // The chain still orders on those numbers.
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      const ok = a.wins > b.wins ||
        (a.wins === b.wins && (a.losses < b.losses ||
          (a.losses === b.losses && a.gameDiff >= b.gameDiff)));
      expect(ok, `rows ${i + 1}/${i + 2} chain order`).toBe(true);
    }
    // A 0–7 alphabet separates far more finely than 1–2, so coins are rarer.
    expect(pendingFlips(pool, s.players).length).toBeLessThanOrEqual(4);
  });
});
