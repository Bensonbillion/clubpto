// STEP 5 — people logistics through the PRODUCTION reducers, refresh-simulated
// like liveloop: not-here discards (no trace), rejoin + the single catch-up,
// left + the fill rule, below-four reachable and reversible.

import { describe, expect, it } from "vitest";
import { DEFAULT_FORMAT } from "../format";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoSession, AmericanoTier,
} from "@/types/americano";
import { generateNextMatch, matchesPlayed, partnershipsTonight } from "../generator";
import { applyResult, ensureLive, type GenerationEvent } from "../live";
import { poolPace } from "../pace";
import {
  canMarkNotHere, markArrived, markLeft, markNotHere, restoreLeft,
} from "../people";

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
  id: "night-people", date: "2026-08-12", sessionName: "people",
  players, pools, defaultMatchFormat: DEFAULT_FORMAT, isPractice: true, status: "active",
});

const court2 = (players: AmericanoPlayer[], target: number): AmericanoPool => ({
  id: "court-2", label: "Court 2", playerIds: players.map((p) => p.playerId),
  targetMatches: target, playoffMode: "top8", status: "round_robin", matches: [], matchFormat: DEFAULT_FORMAT,
});

const pool2 = (s: AmericanoSession) => s.pools.find((p) => p.id === "court-2")!;
const active2 = (s: AmericanoSession) =>
  pool2(s).matches.find((m) => m.status === "active");
const seated = (m: AmericanoMatch) => [...m.teamA, ...m.teamB];
const player = (s: AmericanoSession, id: string) =>
  s.players.find((p) => p.playerId === id)!;

/** Refresh RIGHT NOW: persisted JSON, resumed through the hook's ensureLive. */
const refresh = (s: AmericanoSession, now: number): AmericanoSession =>
  ensureLive(JSON.parse(JSON.stringify(s)), now, () => {
    throw new Error("resume must never regenerate an already-live state");
  });

describe("not-here (STEP 5)", () => {
  it("discards the unplayed active match with NO trace and regenerates without them", () => {
    const players = mkPlayers(16);
    let state = mkSession([court2(players, 3)], players);
    let clock = 0;
    // Three completed + the fourth on court. The first four matches consume
    // disjoint never-played quartets, so every m4 player has zero completed.
    for (let i = 0; i < 3; i++) {
      state = ensureLive(state, clock);
      state = applyResult(state, active2(state)!.id, { winner: "A", setsLost: 0 }, clock + 60_000);
      clock += 60_000;
    }
    state = ensureLive(state, clock);
    const m4 = active2(state)!;
    const victim = m4.teamA[0];
    const partnersBefore = partnershipsTonight(pool2(state));

    state = markNotHere(state, victim);
    expect(player(state, victim).status).toBe("not_arrived");
    // The match never happened: three rows remain, none of them m4's quartet.
    expect(pool2(state).matches).toHaveLength(3);
    expect(pool2(state).matches.every((m) => m.status === "completed")).toBe(true);

    // Regeneration is instant, excludes them, and REUSES the freed index —
    // the id sequence has no hole and no collision.
    state = ensureLive(state, clock + 1_000);
    const m4b = active2(state)!;
    expect(m4b.id).toBe("court-2-m4");
    expect(seated(m4b)).not.toContain(victim);
    const ids = pool2(state).matches.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Co-occurrence memory holds nothing from the discarded quartet: only the
    // completed partnerships plus the regenerated match's two pairs.
    const partnersAfter = partnershipsTonight(pool2(state));
    expect(partnersAfter.size).toBe(partnersBefore.size); // 3 completed + 1 active, both times
    expect(refresh(state, clock + 2_000)).toEqual(state);
  });

  it("is rejected for any status but present — not_arrived and left are not re-markable", () => {
    const players = mkPlayers(16);
    const base = mkSession([court2(players, 3)], players);
    const noShow = players[0].playerId;
    const departed = players[1].playerId;
    const withStatuses: AmericanoSession = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === noShow ? { ...p, status: "not_arrived" as const }
        : p.playerId === departed ? { ...p, status: "left" as const }
        : p,
      ),
    };
    // Neither has history, so ONLY the status guard can reject them — a left
    // player must never slide sideways into not_arrived (left is terminal
    // except through restoreLeft), and re-marking a no-show is a no-op.
    expect(canMarkNotHere(withStatuses, noShow)).toBe(false);
    expect(canMarkNotHere(withStatuses, departed)).toBe(false);
    expect(markNotHere(withStatuses, noShow)).toBe(withStatuses);
    expect(markNotHere(withStatuses, departed)).toBe(withStatuses);
    // And the ordinary present case still passes the guard.
    expect(canMarkNotHere(withStatuses, players[2].playerId)).toBe(true);
  });

  it("is rejected for a player with a completed match — and for a voided one (they were here)", () => {
    const players = mkPlayers(16);
    let state = mkSession([court2(players, 3)], players);
    state = ensureLive(state, 0);
    const m1 = active2(state)!;
    const played = m1.teamA[0];
    state = applyResult(state, m1.id, { winner: "A", setsLost: 0 }, 60_000);

    expect(canMarkNotHere(state, played)).toBe(false);
    expect(markNotHere(state, played)).toBe(state); // identity — rejected

    // A voided appearance is still presence-history.
    const voided: AmericanoSession = {
      ...state,
      pools: state.pools.map((p) => ({
        ...p,
        matches: p.matches.map((m) => (m.id === m1.id ? { ...m, status: "voided" as const } : m)),
      })),
    };
    expect(canMarkNotHere(voided, played)).toBe(false);
    expect(markNotHere(voided, played)).toBe(voided);
  });
});

describe("rejoin + the single catch-up through markArrived (STEP 5)", () => {
  // Hand-authored 8-player pool, target 3, deterministic all the way to
  // all_at_target: the rejoiner is granted EXACTLY one back-to-back
  // (consumed silently), then refused (surfaced relaxation), and the night
  // still converges.
  const build = () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const players: AmericanoPlayer[] = [
      ...ids.map((id) => ({
        playerId: id, displayName: id, tier: "B" as const, status: "present" as const,
        joinedAtMatchIndex: null, catchUpUsed: false,
      })),
      { playerId: "p8", displayName: "p8", tier: "B", status: "not_arrived",
        joinedAtMatchIndex: null, catchUpUsed: false },
    ];
    const done = (i: number, four: string[]): AmericanoMatch => ({
      id: `court-2-m${i}`, poolId: "court-2", matchIndex: i,
      teamA: [four[0], four[1]], teamB: [four[2], four[3]],
      result: { winner: "A", setsLost: 0 }, status: "completed",
      phase: "round_robin", startedAt: i * 100, completedAt: i * 100 + 50,
    });
    const pool: AmericanoPool = {
      id: "court-2", label: "Court 2", playerIds: [...ids, "p8"],
      targetMatches: 3, playoffMode: "top8", status: "round_robin", matchFormat: DEFAULT_FORMAT,
      matches: [
        done(1, ["p1", "p2", "p3", "p4"]),
        done(2, ["p5", "p6", "p7", "p1"]),
        done(3, ["p2", "p3", "p4", "p5"]),
      ],
    };
    return mkSession([pool], players);
  };

  it("rejoins to the front of the queue, one back-to-back granted then refused, night completes", () => {
    let state = build();
    const clock = 10_000;
    const events: GenerationEvent[] = [];
    const collect = (e: GenerationEvent) => events.push(e);

    // Rejoin after three completed matches → joinedAtMatchIndex = 3.
    state = markArrived(state, "p8");
    expect(player(state, "p8")).toMatchObject({
      status: "present", joinedAtMatchIndex: 3, catchUpUsed: false,
    });
    // The status change itself survives persistence byte-for-byte. (No
    // refresh() here — this state has no active match yet, so a resume
    // legitimately generates one.)
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);

    // Selected within two generations — in fact immediately (Infinity wait).
    state = ensureLive(state, clock, collect);
    expect(seated(active2(state)!)).toContain("p8");
    expect(events[0].warnings).toEqual([]);
    state = applyResult(state, active2(state)!.id, { winner: "A", setsLost: 1 }, clock + 60_000);

    // Straight back on court: the single catch-up is GRANTED and consumed —
    // an exemption, not a relaxation, so no warning surfaces.
    state = ensureLive(state, clock + 61_000, collect);
    expect(seated(active2(state)!)).toContain("p8");
    expect(events[1].warnings).toEqual([]);
    expect(player(state, "p8").catchUpUsed).toBe(true);
    expect(refresh(state, clock + 62_000)).toEqual(state);
    state = applyResult(state, active2(state)!.id, { winner: "B", setsLost: 0 }, clock + 120_000);

    // Forced on court a third consecutive time by the counts — but the
    // catch-up is spent, so this one is REFUSED as a grant and surfaced as a
    // forced back-to-back instead.
    state = ensureLive(state, clock + 121_000, collect);
    expect(seated(active2(state)!)).toContain("p8");
    expect(events[2].warnings.some((w) => w.includes("Back-to-back relaxed"))).toBe(true);
    expect(player(state, "p8").catchUpUsed).toBe(true); // never granted twice
    state = applyResult(state, active2(state)!.id, { winner: "A", setsLost: 0 }, clock + 180_000);

    // 8 @ 3 = 6 matches exactly: the night is complete, everyone at target.
    expect(generateNextMatch(pool2(state), state.players)).toEqual({ blocked: "all_at_target" });
    for (const p of state.players) expect(matchesPlayed(pool2(state), p.playerId)).toBe(3);
    expect(refresh(state, clock + 181_000)).toEqual(state);
  });

  it("a discarded match REFUNDS the catch-up it spent — and the rejoiner keeps their seat", () => {
    // "It never happened" has to reach the player records too. Without the
    // refund the exemption is burned by a match nobody played, and the
    // generator's back-to-back penalty then pushes the rejoiner out of the
    // very quartet they were owed.
    let state = build();
    state = markArrived(state, "p8");
    state = ensureLive(state, 1_000);
    state = applyResult(state, active2(state)!.id, { winner: "A", setsLost: 1 }, 60_000);

    // The catch-up seating: p8 straight back on court, exemption spent.
    state = ensureLive(state, 61_000);
    const granted = active2(state)!;
    expect(seated(granted)).toContain("p8");
    expect(granted.catchUpGranted).toEqual(["p8"]);
    expect(player(state, "p8").catchUpUsed).toBe(true);

    // A seat-mate leaves before a ball is struck → the match is discarded.
    const mate = seated(granted).find((id) => id !== "p8")!;
    const discarded = markLeft(state, mate);
    expect(pool2(discarded).matches.some((m) => m.id === granted.id)).toBe(false);
    expect(player(discarded, "p8").catchUpUsed).toBe(false); // handed back

    // The re-called quartet still seats p8, silently — no forced-relaxation
    // warning, because the exemption is genuinely unspent.
    const events: GenerationEvent[] = [];
    const rolled = ensureLive(discarded, 62_000, (e) => events.push(e));
    expect(seated(active2(rolled)!)).toContain("p8");
    expect(events[0].warnings).toEqual([]);
    expect(player(rolled, "p8").catchUpUsed).toBe(true); // spent on THIS one
    expect(refresh(rolled, 63_000)).toEqual(rolled);

    // Contrast: once the granted match is PLAYED, nothing is refunded.
    const played = applyResult(state, granted.id, { winner: "A", setsLost: 0 }, 120_000);
    expect(player(played, "p8").catchUpUsed).toBe(true);
  });

  it("rejoin before any completed match is simply on time-ish (joinedAtMatchIndex null)", () => {
    const players = mkPlayers(16);
    players[3] = { ...players[3], status: "not_arrived" };
    let state = mkSession([court2(players, 3)], players);
    state = markArrived(state, players[3].playerId);
    expect(player(state, players[3].playerId)).toMatchObject({
      status: "present", joinedAtMatchIndex: null,
    });
  });
});

describe("left + the fill rule (STEP 5)", () => {
  it("a leaver ON COURT discards the unplayed match and the court re-calls without them", () => {
    const players = mkPlayers(16);
    let state = mkSession([court2(players, 3)], players);
    // One completed match, then a fresh one on court — the leaver has history
    // AND is mid-match, which is the case markNotHere cannot cover.
    state = ensureLive(state, 0);
    state = applyResult(state, active2(state)!.id, { winner: "A", setsLost: 0 }, 60_000);
    state = ensureLive(state, 61_000);
    const onCourt = active2(state)!;
    const leaver = onCourt.teamA[0];

    state = markLeft(state, leaver);
    expect(player(state, leaver).status).toBe("left");
    // The unplayed match never happened: only the completed row remains.
    expect(pool2(state).matches).toHaveLength(1);
    expect(pool2(state).matches[0].status).toBe("completed");
    expect(active2(state)).toBeUndefined();

    // The court re-calls immediately, without them, reusing the freed index.
    state = ensureLive(state, 62_000);
    const recalled = active2(state)!;
    expect(recalled.id).toBe("court-2-m2");
    expect(seated(recalled)).not.toContain(leaver);
    expect(pool2(state).matches).toHaveLength(2);
    expect(refresh(state, 63_000)).toEqual(state);
  });


  it("record intact, nobody at target+2 while anyone sits below target, night completes", () => {
    const players = mkPlayers(16);
    let state = mkSession([court2(players, 3)], players);
    let clock = 0;
    for (let i = 0; i < 4; i++) {
      state = ensureLive(state, clock);
      state = applyResult(state, active2(state)!.id, { winner: "A", setsLost: 0 }, clock + 60_000);
      clock += 60_000;
    }
    // A player with one completed match who is NOT on court leaves.
    const onCourt = new Set(seated(ensureLive(state, clock).pools[0].matches.at(-1)!));
    const leaver = pool2(state).matches[0].teamA.find((id) => !onCourt.has(id))!;
    state = markLeft(state, leaver);
    expect(player(state, leaver).status).toBe("left");
    expect(matchesPlayed(pool2(state), leaver)).toBe(1); // record untouched

    for (let guard = 0; guard < 40; guard++) {
      state = ensureLive(state, clock);
      const live = active2(state);
      if (!live) break;
      // The fill guard, held at every step: nobody reaches target+2, and
      // nobody is at target+1 while a below-target player sits off court.
      const counts = state.players
        .filter((p) => p.status === "present")
        .map((p) => matchesPlayed(pool2(state), p.playerId));
      expect(Math.max(...counts)).toBeLessThanOrEqual(4);
      expect(refresh(state, clock + 1)).toEqual(state);
      state = applyResult(state, live.id, { winner: guard % 2 ? "A" : "B", setsLost: 1 }, clock + 60_000);
      clock += 60_000;
    }

    expect(generateNextMatch(pool2(state), state.players)).toEqual({ blocked: "all_at_target" });
    expect(matchesPlayed(pool2(state), leaver)).toBe(1); // still frozen
    const final = state.players
      .filter((p) => p.status === "present")
      .map((p) => matchesPlayed(pool2(state), p.playerId));
    expect(Math.min(...final)).toBe(3);
    expect(Math.max(...final)).toBe(4); // 15 @ 3 is not divisible by 4 — fills happened
  });

  it("left is terminal until the admin restores; restore resumes a below-four pool", () => {
    const players = mkPlayers(16);
    let state = mkSession([court2(players, 3)], players);
    state = ensureLive(state, 0);
    state = applyResult(state, active2(state)!.id, { winner: "A", setsLost: 0 }, 60_000);

    // Everyone but three leaves (the active match discards as they go).
    for (const p of players.slice(0, 13)) state = markLeft(state, p.playerId);
    expect(active2(state)).toBeUndefined();
    expect(ensureLive(state, 61_000)).toBe(state); // blocked, untouched
    expect(generateNextMatch(pool2(state), state.players))
      .toEqual({ blocked: "below_four_present" });

    // No zombie transitions.
    const left = players[0].playerId;
    expect(markArrived(state, left)).toBe(state); // left ≠ not_arrived
    expect(markLeft(state, left)).toBe(state);

    // Restore one → present with history intact → the pool resumes.
    state = restoreLeft(state, left);
    expect(player(state, left).status).toBe("present");
    state = ensureLive(state, 62_000);
    expect(active2(state)).toBeDefined();
    expect(refresh(state, 63_000)).toEqual(state);
  });
});

describe("pace honesty once people move (STEP 5 regression)", () => {
  // Before Step 5 the total was courtMatchesNeeded(membership, target), which
  // counts players who left or never arrived: a court whose no-shows stay away
  // sits forever at "match 7 of 12" and keeps projecting an end that will
  // never come — and §6 reads that projection for the early-playoff call.
  it("counts only the matches still owed to the people actually here", () => {
    const players = mkPlayers(16);
    let state = mkSession([court2(players, 3)], players);
    let clock = 0;
    expect(poolPace(pool2(state), state.players, clock).total).toBe(12); // 16@3

    // Run far enough that some players have finished their three.
    let done = 0;
    while (state.players.filter((p) => matchesPlayed(pool2(state), p.playerId) >= 3).length < 4) {
      state = ensureLive(state, clock);
      state = applyResult(state, active2(state)!.id, { winner: "A", setsLost: 0 }, clock + 60_000);
      clock += 60_000;
      done++;
    }
    expect(poolPace(pool2(state), state.players, clock)).toMatchObject({ done, total: 12 });

    // Everyone still short of target goes home. The court is finished — and
    // the header must say so instead of promising the matches they owed.
    for (const p of state.players) {
      if (matchesPlayed(pool2(state), p.playerId) < 3) state = markLeft(state, p.playerId);
    }
    expect(generateNextMatch(pool2(state), state.players)).toEqual({ blocked: "all_at_target" });
    const pace = poolPace(pool2(state), state.players, clock);
    expect(pace).toMatchObject({ done, total: done });
    expect(pace.projectedEndMs).toBeNull(); // no phantom "RR ends ~" at the end

    // And the counter the UI derives lands on "match N of N", not N+1 of 12.
    expect(Math.min(pace.done + 1, pace.total)).toBe(done);
  });

  it("the opposite case: banked matches are not double-counted when players leave", () => {
    // The four who PLAYED match 1 leave; twelve untouched players remain, so
    // the naive present-count answer (courtMatchesNeeded(12,3) = 9) would
    // clamp the header to "match 9 of 9" while matches are still being called.
    const players = mkPlayers(16);
    let state = mkSession([court2(players, 3)], players);
    state = ensureLive(state, 0);
    const first = active2(state)!;
    state = applyResult(state, first.id, { winner: "A", setsLost: 0 }, 60_000);
    for (const id of seated(first)) state = markLeft(state, id);

    const pace = poolPace(pool2(state), state.players, 60_000);
    expect(pace.done).toBe(1);
    expect(pace.total).toBe(10); // 1 banked + 12 players × 3 ÷ 4 = 1 + 9

    // Play it out: the projection was right, not merely plausible.
    let clock = 60_000, ran = 1;
    for (let guard = 0; guard < 30; guard++) {
      state = ensureLive(state, clock);
      const live = active2(state);
      if (!live) break;
      state = applyResult(state, live.id, { winner: "A", setsLost: 1 }, clock + 60_000);
      clock += 60_000;
      ran++;
    }
    expect(ran).toBe(10);
  });
});

describe("full night with one of each event, refresh-simulated at every step (STEP 5)", () => {
  it("16@3 with a not-here, a rejoin, and a leaver still converges cleanly", () => {
    const players = mkPlayers(16);
    let state = mkSession([court2(players, 3)], players);
    let clock = 1_000_000;
    let notHereId: string | null = null;
    let leaverId: string | null = null;

    for (let steps = 0; steps < 40; steps++) {
      state = ensureLive(state, clock);
      const live = active2(state);
      if (!live) break;
      expect(refresh(state, clock + 5)).toEqual(state);

      if (steps === 0) {
        // Before any result: someone in the opening match never showed.
        notHereId = live.teamB[1];
        state = markNotHere(state, notHereId);
        expect(pool2(state).matches).toHaveLength(0); // no trace
        expect(refresh(ensureLive(state, clock + 6), clock + 7))
          .toEqual(ensureLive(state, clock + 6));
        continue; // regenerate and re-enter the loop
      }
      if (steps === 5 && notHereId) {
        state = markArrived(state, notHereId);
        expect(player(state, notHereId).joinedAtMatchIndex).not.toBeNull();
      }
      if (steps === 7) {
        leaverId = state.players.find(
          (p) => p.status === "present" &&
            matchesPlayed(pool2(state), p.playerId) > 0 &&
            !seated(live).includes(p.playerId),
        )!.playerId;
        state = markLeft(state, leaverId);
      }

      state = applyResult(state, active2(state)!.id, { winner: steps % 2 ? "A" : "B", setsLost: 0 }, clock + 60_000);
      clock += 60_000;
    }

    expect(generateNextMatch(pool2(state), state.players)).toEqual({ blocked: "all_at_target" });
    const ids = pool2(state).matches.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of state.players) {
      const n = matchesPlayed(pool2(state), p.playerId);
      if (p.playerId === leaverId) expect(n).toBeGreaterThanOrEqual(1);
      else if (p.status === "present") expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(4);
    }
    expect(refresh(state, clock)).toEqual(state);
  });
});
