// STEP 4 — the non-negotiable, proven in simulation: refresh at ANY moment
// restores exactly. Drives full nights through the REAL production
// transitions (live.ts — the same reducers the hook commits), simulating a
// refresh at every step: JSON round-trip → ensureLive → deep-equal.

import { describe, expect, it } from "vitest";
import { DEFAULT_FORMAT } from "../format";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoSession, AmericanoTier,
} from "@/types/americano";
import { generateNextMatch, matchesPlayed } from "../generator";
import {
  applyCorrection, applyResult, applyVoid, ensureLive, type GenerationEvent,
} from "../live";

const mkPlayers = (n: number, prefix = "p"): AmericanoPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    playerId: `${prefix}${String(i).padStart(2, "0")}`,
    displayName: `${prefix}${i}`,
    tier: (i < n / 3 ? "A" : i < (2 * n) / 3 ? "B" : "C") as AmericanoTier,
    status: "present" as const,
    joinedAtMatchIndex: null,
    catchUpUsed: false,
  }));

const mkSession = (pools: AmericanoPool[], players: AmericanoPlayer[]): AmericanoSession => ({
  id: "night-loop", date: "2026-08-12", sessionName: "liveloop",
  players, pools, defaultMatchFormat: DEFAULT_FORMAT, isPractice: true, status: "active",
});

const court2 = (players: AmericanoPlayer[], target: number): AmericanoPool => ({
  id: "court-2", label: "Court 2", playerIds: players.map((p) => p.playerId),
  targetMatches: target, playoffMode: "top8", status: "round_robin", matches: [], matchFormat: DEFAULT_FORMAT,
});

const pool2 = (s: AmericanoSession) => s.pools.find((p) => p.id === "court-2")!;
const active2 = (s: AmericanoSession) =>
  pool2(s).matches.filter((m) => m.status === "active");
const seated = (m: AmericanoMatch) => [...m.teamA, ...m.teamB];

/** A refresh RIGHT NOW: what storage persisted, resumed through the same
    ensureLive the hook runs on load. Must restore the exact state — and must
    not generate (the resume of a rolling court is idempotent). */
const refresh = (s: AmericanoSession, now: number): AmericanoSession =>
  ensureLive(JSON.parse(JSON.stringify(s)), now, () => {
    throw new Error("resume must never regenerate an already-live state");
  });

describe("liveloop (STEP 4): the production path, refresh-simulated at every step", () => {
  it("runs a full 16@3 night; a blocked pool is untouched throughout", () => {
    const c2Players = mkPlayers(16);
    // Court 1 has only three present — below_four_present all night long.
    const c1Players = mkPlayers(3, "r").map((p) => ({ ...p, tier: "C" as const }));
    const c1: AmericanoPool = {
      id: "court-1", label: "Court 1", playerIds: c1Players.map((p) => p.playerId),
      targetMatches: 4, playoffMode: "undecided", status: "round_robin", matches: [], matchFormat: DEFAULT_FORMAT,
    };
    let state = mkSession([court2(c2Players, 3), c1], [...c2Players, ...c1Players]);
    let clock = 1_000_000;
    const events: GenerationEvent[] = [];

    let steps = 0;
    for (; steps < 40; steps++) {
      state = ensureLive(state, clock, (e) => events.push(e));
      expect(state.pools.find((p) => p.id === "court-1")!.matches).toEqual([]);
      const live = active2(state);
      if (live.length === 0) break; // all_at_target — the night is done
      expect(live.length).toBe(1);

      expect(refresh(state, clock + 12_345)).toEqual(state);

      if (steps === 6) {
        // Mid-night correction: flip an earlier winner. Nothing breaks —
        // counts are result-blind and the refresh invariant still holds.
        state = applyCorrection(state, "court-2-m2", { winner: "B", setsLost: 0 });
        expect(pool2(state).matches.find((m) => m.id === "court-2-m2")!.result)
          .toEqual({ winner: "B", setsLost: 0 });
        expect(refresh(state, clock)).toEqual(state);
      }

      state = applyResult(
        state, live[0].id,
        { winner: steps % 2 ? "A" : "B", setsLost: steps % 3 ? 1 : 0 },
        clock + 7 * 60_000,
      );
      clock += 8 * 60_000;
    }

    const c2 = pool2(state);
    expect(c2.matches).toHaveLength(12); // 16 @ 3 = 12 matches, exact
    expect(c2.matches.every((m) => m.status === "completed")).toBe(true);
    for (const p of c2Players) expect(matchesPlayed(c2, p.playerId)).toBe(3);
    expect(generateNextMatch(c2, state.players)).toEqual({ blocked: "all_at_target" });
    // Deterministic ids in strict sequence — StrictMode-safe by construction.
    expect(events.map((e) => e.matchId)).toEqual(
      Array.from({ length: 12 }, (_, i) => `court-2-m${i + 1}`),
    );
    expect(refresh(state, clock)).toEqual(state); // refresh after the night too
  });

  it("catch-up: granted once (consumed, no warning), then refused (relaxation warning)", () => {
    // Hand-authored 8-present pool, target 3. pLate joined late and JUST
    // played match 4; they are the only count-1 player, so the least-played
    // constraint forces them straight back on court — a back-to-back.
    const base = (catchUpUsed: boolean) => {
      const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
      const players: AmericanoPlayer[] = [
        ...ids.map((id) => ({
          playerId: id, displayName: id, tier: "B" as const, status: "present" as const,
          joinedAtMatchIndex: null, catchUpUsed: false,
        })),
        { playerId: "pLate", displayName: "pLate", tier: "B", status: "present",
          joinedAtMatchIndex: 3, catchUpUsed },
      ];
      const done = (i: number, four: string[]): AmericanoMatch => ({
        id: `court-2-m${i}`, poolId: "court-2", matchIndex: i,
        teamA: [four[0], four[1]], teamB: [four[2], four[3]],
        result: { winner: "A", setsLost: 0 }, status: "completed",
        phase: "round_robin", startedAt: i * 100, completedAt: i * 100 + 50,
      });
      const pool: AmericanoPool = {
        id: "court-2", label: "Court 2", playerIds: [...ids, "pLate"],
        targetMatches: 3, playoffMode: "top8", status: "round_robin", matchFormat: DEFAULT_FORMAT,
        matches: [
          done(1, ["p1", "p2", "p3", "p4"]),
          done(2, ["p5", "p6", "p7", "p1"]),
          done(3, ["p2", "p3", "p4", "p5"]),
          done(4, ["p6", "p7", "pLate", "p1"]), // pLate's first — the last match
        ],
      };
      return mkSession([pool], players);
    };

    // GRANT: the one catch-up is spent, silently (an exemption, not a relaxation).
    const grantEvents: GenerationEvent[] = [];
    const granted = ensureLive(base(false), 9_000, (e) => grantEvents.push(e));
    const grantMatch = active2(granted)[0];
    expect(seated(grantMatch)).toContain("pLate");
    expect(granted.players.find((p) => p.playerId === "pLate")!.catchUpUsed).toBe(true);
    expect(grantEvents).toHaveLength(1);
    expect(grantEvents[0].warnings).toEqual([]);
    expect(refresh(granted, 9_999)).toEqual(granted);

    // REFUSAL: catch-up already used. The counts still force pLate on court,
    // but now it is a surfaced forced back-to-back, not a grant.
    const refuseEvents: GenerationEvent[] = [];
    const refused = ensureLive(base(true), 9_000, (e) => refuseEvents.push(e));
    expect(seated(active2(refused)[0])).toContain("pLate");
    expect(refuseEvents[0].warnings.some((w) => w.includes("Back-to-back relaxed"))).toBe(true);
    expect(refused.players.find((p) => p.playerId === "pLate")!.catchUpUsed).toBe(true);
  });

  it("void: ids never collide, and the affected players are back on court immediately", () => {
    const players = mkPlayers(16);
    let state = mkSession([court2(players, 3)], players);
    let clock = 0;
    for (let i = 0; i < 4; i++) {
      state = ensureLive(state, clock);
      state = applyResult(state, active2(state)[0].id, { winner: "A", setsLost: 0 }, clock + 60_000);
      clock += 60_000;
    }
    state = ensureLive(state, clock); // court-2-m5 goes on court

    const m2 = pool2(state).matches.find((m) => m.id === "court-2-m2")!;
    const affected = seated(m2);
    state = applyVoid(state, "court-2-m2");
    // The void erases their counted match instantly…
    for (const id of affected) expect(matchesPlayed(pool2(state), id)).toBe(0);
    // …but never interrupts the match already on court: ensureLive is a no-op.
    expect(ensureLive(state, clock)).toBe(state);
    expect(refresh(state, clock)).toEqual(state);

    // The court frees; the next generation seats every affected player who
    // is not already on court (they now hold the strict-minimum counts).
    state = applyResult(state, "court-2-m5", { winner: "B", setsLost: 1 }, clock + 60_000);
    const events: GenerationEvent[] = [];
    state = ensureLive(state, clock + 120_000, (e) => events.push(e));
    expect(events[0].matchId).toBe("court-2-m6"); // length-based index → no collision
    const m5 = pool2(state).matches.find((m) => m.id === "court-2-m5")!;
    const m6 = pool2(state).matches.find((m) => m.id === "court-2-m6")!;
    const backOnCourt = new Set([...seated(m5), ...seated(m6)]);
    for (const id of affected) expect(backOnCourt.has(id)).toBe(true);

    const ids = pool2(state).matches.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(pool2(state).matches.find((m) => m.id === "court-2-m2")!.status).toBe("voided");
    expect(refresh(state, clock + 130_000)).toEqual(state);
  });
});
