// Court Manager v2 — headless simulation suite (COURT-MANAGER.md §14).
//
// Run:  npx tsx src/court-manager/sim/run.ts
//
// This is the weekly ritual runner: it exercises the pure-function scheduler,
// validator, formats, and pace engine against real session shapes. A session
// week without a green run here is a session running on hope.

import type { Pair, RoundGame, Tier } from "../types";
import { generatePairs, pairLatecomers, publicCountSummary, publicRoster, resolveVipPicks } from "../checkin";
import { generateRoundSchedule, regenerateFromRound } from "../scheduler/rounds";
import { validateRoundSchedule } from "../scheduler/validate";
import { addLpfPair, createLpfCourt, nextLpfSlot, removeLpfPair } from "../scheduler/lpf";
import { avgGameMs, createPaceState, recordGameDuration } from "../pace";
import {
  addWsoPair,
  createWsoState,
  recordWsoWinner,
  reorderWsoQueue,
  undoWsoResult,
  wsoFinalChallenge,
  wsoStandings,
} from "../wso";
import type { CompletedRRGame } from "../playoffs";
import { coinFlipWinner, courtBracket, seedOpen, seedWednesdayTop8, sortSeeding, wednesdayBracket, pairStandings } from "../playoffs";
import { pausedOverlapMs } from "../pace";
import type { Envelope, RemoteSync } from "../persistence";
import { createSessionStore, memoryStorage } from "../persistence";
import {
  applySubRotation,
  correctResult,
  createSubRotation,
  proposeSubRotation,
  tickSubRotation,
} from "../edge";
import type { GameResult, Player } from "../types";

let failures = 0;
let checks = 0;

function assert(cond: boolean, label: string): void {
  checks++;
  if (cond) return;
  failures++;
  console.error(`  ✗ ${label}`);
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function makePairs(counts: { A: number; B: number; C: number }): Pair[] {
  const pairs: Pair[] = [];
  (Object.keys(counts) as Tier[]).forEach((tier) => {
    for (let i = 1; i <= counts[tier]; i++) {
      pairs.push({ id: `${tier}${i}`, playerIds: [`${tier}${i}a`, `${tier}${i}b`], tier });
    }
  });
  return pairs;
}

function countGames(rounds: RoundGame[][]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const round of rounds) {
    for (const g of round) {
      g.pairIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    }
  }
  return counts;
}

function mixFor(rounds: RoundGame[][], pairs: Pair[], pairId: string): Record<Tier, number> {
  const byId = new Map(pairs.map((p) => [p.id, p]));
  const mix: Record<Tier, number> = { A: 0, B: 0, C: 0 };
  for (const round of rounds) {
    for (const g of round) {
      if (!g.pairIds.includes(pairId)) continue;
      const opp = byId.get(g.pairIds[0] === pairId ? g.pairIds[1] : g.pairIds[0]);
      if (opp) mix[opp.tier]++;
    }
  }
  return mix;
}

// ---------------------------------------------------------------------------
section("Wednesday canonical: 12 pairs (4A/4B/4C), 4 rounds, 2 courts (§6)");
{
  const pairs = makePairs({ A: 4, B: 4, C: 4 });
  const schedule = generateRoundSchedule(pairs, { rounds: 4, sameTierRounds: 2, courts: 2, seed: 42 });
  const violations = validateRoundSchedule(pairs, schedule, { maxSpread: 0 });
  violations.forEach((v) => console.error(`  validator: ${v.message}`));
  assert(violations.length === 0, "validator clean");
  assert(schedule.rounds.length === 4, "4 rounds generated");
  assert(schedule.rounds.every((r) => r.length === 6), "6 games per round");

  const counts = countGames(schedule.rounds);
  assert([...counts.values()].every((c) => c === 4), "every pair gets exactly 4 games");
  assert(!schedule.rounds.flat().some((g) => g.isRematch), "zero rematches in base 4 rounds");

  for (let r = 0; r < 2; r++) {
    const pure = schedule.rounds[r].every((g) => g.type === "AA" || g.type === "BB" || g.type === "CC");
    assert(pure, `round ${r + 1} is pure same-tier`);
  }
  for (const p of pairs) {
    const mix = mixFor(schedule.rounds, pairs, p.id);
    if (p.tier === "A") assert(mix.A === 3 && mix.B === 1 && mix.C === 0, `${p.id} plays 3vA+1vB (got ${mix.A}vA ${mix.B}vB ${mix.C}vC)`);
    if (p.tier === "B") assert(mix.A === 1 && mix.B === 2 && mix.C === 1, `${p.id} plays 2vB+1vA+1vC (got ${mix.A}vA ${mix.B}vB ${mix.C}vC)`);
    if (p.tier === "C") assert(mix.A === 0 && mix.B === 1 && mix.C === 3, `${p.id} plays 3vC+1vB (got ${mix.A}vA ${mix.B}vB ${mix.C}vC)`);
  }

  // Determinism: same seed, same schedule.
  const again = generateRoundSchedule(pairs, { rounds: 4, sameTierRounds: 2, courts: 2, seed: 42 });
  assert(JSON.stringify(again) === JSON.stringify(schedule), "same seed reproduces the schedule");
}

// ---------------------------------------------------------------------------
section("Wednesday odd: 13 pairs (5A/4B/4C) — rotating byes, disclosed (§6)");
{
  const pairs = makePairs({ A: 5, B: 4, C: 4 });
  const schedule = generateRoundSchedule(pairs, { rounds: 4, sameTierRounds: 2, courts: 2, seed: 7 });
  const violations = validateRoundSchedule(pairs, schedule, { maxSpread: 1 });
  violations.forEach((v) => console.error(`  validator: ${v.message}`));
  assert(violations.length === 0, "validator clean (spread ≤ 1)");

  const byeIds = Object.values(schedule.byes).flat();
  assert(byeIds.length === 4, "one bye per round");
  assert(new Set(byeIds).size === 4, "byes rotate — no pair sits twice");

  const counts = countGames(schedule.rounds);
  const values = pairs.map((p) => counts.get(p.id) ?? 0);
  assert(values.every((c) => c === 3 || c === 4), "final counts are 4-and-3, nothing worse");
  assert(schedule.disclosures.some((d) => d.includes("13 pairs")), "odd-pair disclosure surfaced upfront");
}

// ---------------------------------------------------------------------------
section("Wednesday late arrival at round boundary (§6, §11)");
{
  const initial = makePairs({ A: 4, B: 4, C: 3 }); // 11 pairs — byes in early rounds
  const config = { rounds: 4, sameTierRounds: 2, courts: 2, seed: 11 };
  const before = generateRoundSchedule(initial, config);
  const completed = before.rounds.slice(0, 2);
  const completedByes: Record<number, string[]> = {};
  for (const [r, ids] of Object.entries(before.byes)) {
    if (Number(r) <= 2) completedByes[Number(r)] = ids;
  }

  const latePair: Pair = { id: "C4", playerIds: ["C4a", "C4b"], tier: "C" };
  const allPairs = [...initial, latePair];
  const after = regenerateFromRound(allPairs, completed, completedByes, config);

  assert(
    JSON.stringify(after.rounds.slice(0, 2)) === JSON.stringify(completed),
    "completed rounds untouched — completed data is sacred",
  );
  const lateGames = after.rounds.flat().filter((g) => g.pairIds.includes("C4"));
  assert(lateGames.length === 2 && lateGames.every((g) => g.round >= 3), "late pair plays rounds 3-4 only (finishes on 2)");

  const violations = validateRoundSchedule(allPairs, after, { maxSpread: 1, spreadExempt: ["C4"] });
  violations.forEach((v) => console.error(`  validator: ${v.message}`));
  assert(violations.length === 0, "validator clean after boundary join");
}

// ---------------------------------------------------------------------------
section("Wednesday mid-session removal at boundary (§11)");
{
  const pairs = makePairs({ A: 4, B: 4, C: 4 });
  const config = { rounds: 4, sameTierRounds: 2, courts: 2, seed: 42 };
  const before = generateRoundSchedule(pairs, config);
  const completed = before.rounds.slice(0, 2);

  const removedId = "B2";
  const remaining = pairs.filter((p) => p.id !== removedId);
  const after = regenerateFromRound(remaining, completed, {}, config);

  assert(
    JSON.stringify(after.rounds.slice(0, 2)) === JSON.stringify(completed),
    "completed rounds preserved after removal",
  );
  const futureGamesWithRemoved = after.rounds
    .slice(2)
    .flat()
    .filter((g) => g.pairIds.includes(removedId));
  assert(futureGamesWithRemoved.length === 0, "removed pair has no future games");

  // Validate against the FULL roster (the removed pair's completed games are
  // real history and its opponents' counts must include them), with the removed
  // pair exempt from the spread check. 11 remaining pairs → byes in rounds 3-4.
  const violations = validateRoundSchedule(pairs, after, { maxSpread: 1, spreadExempt: [removedId] });
  violations.forEach((v) => console.error(`  validator: ${v.message}`));
  assert(violations.length === 0, "validator clean after removal");
}

// ---------------------------------------------------------------------------
section("Sunday LPF court: 6 pairs, 9 slots (§7)");
{
  const court = createLpfCourt(2, ["B1", "B2", "B3", "B4", "B5", "B6"]);
  for (let slot = 0; slot < 9; slot++) nextLpfSlot(court);

  const played = court.slotLog.filter(Boolean).length;
  assert(played === 9, `all 9 slots filled (got ${played})`);

  const counts = Object.values(court.states).map((s) => s.gamesPlayed);
  assert(Math.max(...counts) - Math.min(...counts) <= 1, `counts never differ by more than 1 (got ${counts.join(",")})`);

  // No back-to-back: a pair never plays two consecutive slots.
  let backToBack = false;
  for (let i = 1; i < court.slotLog.length; i++) {
    const prev = court.slotLog[i - 1];
    const cur = court.slotLog[i];
    if (prev && cur && (cur.includes(prev[0]) || cur.includes(prev[1]))) backToBack = true;
  }
  assert(!backToBack, "no pair plays back-to-back slots");

  // Max sit-out 3 slots for ≤6 pairs.
  const maxGap = Math.max(...Object.values(court.states).map((s) => s.slotsSinceLastGame));
  assert(maxGap <= 3, `max sit-out ≤ 3 slots (got ${maxGap})`);
}

section("Sunday LPF: late pair joins with max priority (§7, §11)");
{
  const court = createLpfCourt(1, ["C1", "C2", "C3", "C4", "C5"]);
  for (let slot = 0; slot < 4; slot++) nextLpfSlot(court);
  addLpfPair(court, "C6");
  let firstGameOffset: number | null = null;
  for (let slot = 0; slot < 4; slot++) {
    const g = nextLpfSlot(court);
    if (firstGameOffset === null && g && g.includes("C6")) firstGameOffset = slot + 1;
  }
  assert(firstGameOffset !== null && firstGameOffset <= 2, `late pair plays within 1-2 slots (got ${firstGameOffset ?? "never"})`);
}

section("Sunday LPF: removal voids future only (§11)");
{
  const court = createLpfCourt(3, ["A1", "A2", "A3", "A4", "A5"]);
  for (let slot = 0; slot < 3; slot++) nextLpfSlot(court);
  const playedBefore = court.slotLog.filter(Boolean).length;
  removeLpfPair(court, "A1");
  for (let slot = 0; slot < 4; slot++) nextLpfSlot(court);
  assert(court.slotLog.filter(Boolean).length >= playedBefore, "history preserved");
  const afterRemoval = court.slotLog.slice(3).filter(Boolean);
  assert(afterRemoval.every((g) => !(g as readonly [string, string]).includes("A1")), "removed pair never scheduled again");
  const counts = Object.values(court.states).map((s) => s.gamesPlayed);
  assert(Math.max(...counts) - Math.min(...counts) <= 1, "equity holds for remaining pairs");
}

section("Sunday LPF: 7 pairs → sit-out tolerance 4 (§7)");
{
  const court = createLpfCourt(2, ["B1", "B2", "B3", "B4", "B5", "B6", "B7"]);
  for (let slot = 0; slot < 10; slot++) nextLpfSlot(court);
  const counts = Object.values(court.states).map((s) => s.gamesPlayed);
  assert(Math.max(...counts) - Math.min(...counts) <= 1, "counts within 1 with 7 pairs");
  const maxGap = Math.max(...Object.values(court.states).map((s) => s.slotsSinceLastGame));
  assert(maxGap <= 4, `max sit-out ≤ 4 slots with 7+ pairs (got ${maxGap})`);
}

section("Coach flag: widened rest on LPF courts (§5)");
{
  const coachPair = "B1";
  const court = createLpfCourt(2, ["B1", "B2", "B3", "B4", "B5", "B6"]);
  const opts = { restGapFor: (id: string) => (id === coachPair ? 3 : 1) };
  for (let slot = 0; slot < 12; slot++) nextLpfSlot(court, opts);
  // Coach's games must be ≥3 slots apart.
  const coachSlots = court.slotLog
    .map((g, i) => (g && g.includes(coachPair) ? i : -1))
    .filter((i) => i >= 0);
  let ok = true;
  for (let i = 1; i < coachSlots.length; i++) {
    if (coachSlots[i] - coachSlots[i - 1] < 3) ok = false;
  }
  assert(ok, `coach games ≥3 slots apart (slots: ${coachSlots.join(",")})`);
  assert(coachSlots.length >= 2, "coach still gets games");
}

// ---------------------------------------------------------------------------
section("Pace engine: measured reality replaces assumption (§8)");
{
  const nineMin = 9 * 60_000;
  let pace = createPaceState(nineMin);
  const t0 = 1_700_000_000_000;
  // 3 samples: still assumed.
  for (let i = 0; i < 3; i++) pace = recordGameDuration(pace, t0, t0 + 9.4 * 60_000);
  assert(!avgGameMs(pace).usingMeasured, "3 samples → still using assumed average");
  assert(avgGameMs(pace).value === nineMin, "assumed value used below threshold");
  // 4th sample flips to measured.
  pace = recordGameDuration(pace, t0, t0 + 9.4 * 60_000);
  const m = avgGameMs(pace);
  assert(m.usingMeasured, "4 samples → measured average");
  assert(Math.abs(m.value - 9.4 * 60_000) < 1000, "measured average ≈ 9.4 min");
  // Nonsense durations ignored.
  const before = pace.samples.length;
  pace = recordGameDuration(pace, t0, t0 + 45 * 60_000);
  pace = recordGameDuration(pace, t0, t0 + 30_000);
  assert(pace.samples.length === before, "insane durations rejected");
}

// ---------------------------------------------------------------------------
section("Stress: 60 random Wednesday shapes stay structurally valid");
{
  let allClean = true;
  for (let seed = 100; seed < 160; seed++) {
    const a = 3 + (seed % 4); // 3-6
    const b = 3 + ((seed * 7) % 4);
    const c = 3 + ((seed * 13) % 4);
    const pairs = makePairs({ A: a, B: b, C: c });
    const schedule = generateRoundSchedule(pairs, { rounds: 4, sameTierRounds: 2, courts: 2, seed });
    const odd = pairs.length % 2 === 1;
    const violations = validateRoundSchedule(pairs, schedule, { maxSpread: odd ? 1 : 0 });
    if (violations.length > 0) {
      allClean = false;
      console.error(`  seed ${seed} (${a}A/${b}B/${c}C):`);
      violations.slice(0, 3).forEach((v) => console.error(`    ${v.message}`));
    }
  }
  assert(allClean, "all 60 random shapes validate clean");
}

// ---------------------------------------------------------------------------
section("Late arrivals: pairLatecomers + regenerate future rounds (§11)");
{
  // Start: 4A/4B/4C = 12 pairs, 4 rounds. Play round 1, then two B latecomers
  // + two C latecomers check in. They must pair within tier and appear only in
  // the regenerated future rounds — existing pairs and round 1 untouched.
  const pairs = makePairs({ A: 4, B: 4, C: 4 });
  const config = { rounds: 4, sameTierRounds: 2, courts: 2, seed: 3 };
  const schedule = generateRoundSchedule(pairs, config);

  const alreadyPaired = new Set(pairs.flatMap((p) => p.playerIds));
  const latePlayers = [
    { id: "LB1", name: "LB1", tier: "B" as Tier, isVip: false, isCoach: false, checkedIn: true, checkInTime: 1 },
    { id: "LB2", name: "LB2", tier: "B" as Tier, isVip: false, isCoach: false, checkedIn: true, checkInTime: 2 },
    { id: "LC1", name: "LC1", tier: "C" as Tier, isVip: false, isCoach: false, checkedIn: true, checkInTime: 3 },
    { id: "LC2", name: "LC2", tier: "C" as Tier, isVip: false, isCoach: false, checkedIn: true, checkInTime: 4 },
    { id: "LA1", name: "LA1", tier: "A" as Tier, isVip: false, isCoach: false, checkedIn: true, checkInTime: 5 },
  ];
  const { pairs: newPairs, leftover } = pairLatecomers(latePlayers, alreadyPaired);
  assert(newPairs.length === 2, `two full late pairs formed (B+B, C+C) — got ${newPairs.length}`);
  assert(leftover.A.length === 1, "the lone A latecomer waits for a same-tier partner");
  assert(
    newPairs.every((p) => {
      const [a, b] = p.playerIds.map((id) => latePlayers.find((x) => x.id === id));
      return a && b && a.tier === b.tier;
    }),
    "late pairs are within tier",
  );

  // Regenerate future rounds (keep round 1) with the late pairs added.
  const allPairs = [...pairs, ...newPairs];
  const completedByes: Record<number, string[]> = {};
  for (const [r, ids] of Object.entries(schedule.byes)) if (Number(r) <= 1) completedByes[Number(r)] = ids;
  const after = regenerateFromRound(allPairs, schedule.rounds.slice(0, 1), completedByes, config);

  assert(
    JSON.stringify(after.rounds[0]) === JSON.stringify(schedule.rounds[0]),
    "round 1 (already played) is untouched by the late join",
  );
  const lateIds = new Set(newPairs.map((p) => p.id));
  const lateGames = after.rounds.slice(1).flat().filter((g) => lateIds.has(g.pairIds[0]) || lateIds.has(g.pairIds[1]));
  assert(lateGames.length > 0, "late pairs are scheduled in the regenerated future rounds");
  assert(
    lateGames.every((g) => g.round >= 2),
    "late pairs never appear in round 1 (they joined after it)",
  );
  const violations = validateRoundSchedule(allPairs, after, {
    maxSpread: 1,
    spreadExempt: [...lateIds],
  });
  violations.forEach((v) => console.error(`  validator: ${v.message}`));
  assert(violations.length === 0, "late-join schedule validates clean");
}

// ---------------------------------------------------------------------------
section("WSO: winner stays, loser to back, ON DECK steps up (§7)");
{
  const t = 1_700_000_000_000;
  let s = createWsoState(["P1", "P2", "P3", "P4", "P5"], t);
  assert(s.currentGame?.pairIds.join(",") === "P1,P2", "first two pairs open");
  assert(s.queue.join(",") === "P3,P4,P5", "rest form the queue, P3 on deck");

  s = recordWsoWinner(s, "P1", t + 1);
  assert(s.currentGame?.pairIds.join(",") === "P1,P3", "winner stays, on-deck steps up");
  assert(s.queue.join(",") === "P4,P5,P2", "loser to the back");
  assert(s.stats.P1.wins === 1 && s.stats.P1.streak === 1, "winner stats update");
  assert(s.stats.P2.losses === 1 && s.stats.P2.streak === 0, "loser streak resets");

  s = recordWsoWinner(s, "P1", t + 2);
  s = recordWsoWinner(s, "P1", t + 3);
  assert(s.stats.P1.streak === 3 && s.stats.P1.longestStreak === 3, "streak tracks");

  const beforeUndo = JSON.stringify({ q: s.queue, g: s.currentGame?.pairIds, w: s.stats.P1.wins });
  s = recordWsoWinner(s, "P5", t + 4);
  assert(s.stats.P1.streak === 0, "defender's streak breaks on loss");
  s = undoWsoResult(s);
  const afterUndo = JSON.stringify({ q: s.queue, g: s.currentGame?.pairIds, w: s.stats.P1.wins });
  assert(beforeUndo === afterUndo, "undo restores queue, game, and stats exactly");

  s = reorderWsoQueue(s, [...s.queue].reverse());
  assert(s.queue.length === 3, "queue reorder keeps members");
  let threw = false;
  try {
    reorderWsoQueue(s, ["P9", "P8", "P7"]);
  } catch {
    threw = true;
  }
  assert(threw, "reorder with different members rejected");

  s = addWsoPair(s, "P6");
  assert(s.queue[s.queue.length - 1] === "P6", "late pair appends to queue");

  const fc = wsoFinalChallenge(s);
  assert(fc !== null && fc.a === "P1", "Final Challenge: top-by-wins defends");
}

section("WSO: optional streak cap rotates the defender (§7 open decision)");
{
  const t = 1_700_000_000_000;
  let s = createWsoState(["P1", "P2", "P3", "P4", "P5"], t, 3);
  s = recordWsoWinner(s, "P1", t + 1);
  s = recordWsoWinner(s, "P1", t + 2);
  assert(s.currentGame?.pairIds.includes("P1") === true, "defender stays below the cap");
  s = recordWsoWinner(s, "P1", t + 3); // 3 straight → rotate
  assert(s.currentGame?.pairIds.includes("P1") === false, "at 3 straight the defender rotates out");
  assert(s.stats.P1.streak === 3 && s.stats.P1.longestStreak === 3, "streak preserved on the stats board");
  assert(s.queue.includes("P1"), "capped defender rejoins the queue");
}

// ---------------------------------------------------------------------------
section("Seeding chain: Win% first, never raw win totals (§10)");
{
  const pairs: import("../types").Pair[] = [
    { id: "PA", playerIds: ["pa1", "pa2"], tier: "B" },
    { id: "PB", playerIds: ["pb1", "pb2"], tier: "B" },
  ];
  // Historical bug shape: 7W-13L must NOT outseed 4W-0L.
  const games: CompletedRRGame[] = [];
  const opp: import("../types").Pair = { id: "OPP", playerIds: ["o1", "o2"], tier: "B" };
  for (let i = 0; i < 7; i++) games.push({ pairIds: ["PA", "OPP"], winnerPairId: "PA" });
  for (let i = 0; i < 13; i++) games.push({ pairIds: ["PA", "OPP"], winnerPairId: "OPP" });
  for (let i = 0; i < 4; i++) games.push({ pairIds: ["PB", "OPP"], winnerPairId: "PB" });

  const rows = pairStandings([...pairs, opp], games);
  const sorted = sortSeeding(rows.filter((r) => r.id !== "OPP"), () => 0);
  assert(sorted[0].id === "PB", "4W-0L (100%) seeds above 7W-13L (35%)");
}

section("Seeding chain: H2H breaks Win% ties and is displayed (§10)");
{
  const pairs: import("../types").Pair[] = [
    { id: "X", playerIds: ["x1", "x2"], tier: "A" },
    { id: "Y", playerIds: ["y1", "y2"], tier: "A" },
    { id: "Z", playerIds: ["z1", "z2"], tier: "A" },
  ];
  const games: CompletedRRGame[] = [
    { pairIds: ["X", "Y"], winnerPairId: "X" },
    { pairIds: ["Y", "Z"], winnerPairId: "Y" },
    { pairIds: ["X", "Z"], winnerPairId: "Z" }, // X and Y both 1-1
  ];
  const h2h = (a: string, b: string) => {
    for (const g of games) {
      if (g.pairIds.includes(a) && g.pairIds.includes(b)) return g.winnerPairId === a ? 1 : -1;
    }
    return 0;
  };
  const sorted = sortSeeding(pairStandings(pairs, games), h2h);
  const xi = sorted.findIndex((r) => r.id === "X");
  const yi = sorted.findIndex((r) => r.id === "Y");
  assert(xi < yi, "X seeds above Y (beat them head-to-head at equal Win%)");
  assert(sorted[xi].tiebreakApplied === "wins head-to-head", `applied tiebreaker recorded (got "${sorted[xi].tiebreakApplied}")`);
}

section("Wednesday top-8 player bracket + C-beat-B override (§10)");
{
  // 3 A pairs (6 players) so B fills the last two seeds — the override only
  // exists when a beaten B player still holds a seed.
  const players: Player[] = [];
  const pairs: import("../types").Pair[] = [];
  const tierCounts = { A: 3, B: 4, C: 4 } as const;
  (["A", "B", "C"] as const).forEach((tier) => {
    for (let i = 1; i <= tierCounts[tier]; i++) {
      const pid = `${tier}${i}`;
      pairs.push({ id: pid, playerIds: [`${pid}a`, `${pid}b`], tier });
      for (const suffix of ["a", "b"]) {
        players.push({
          id: `${pid}${suffix}`,
          name: `${pid}${suffix}`,
          tier,
          isVip: false,
          isCoach: false,
          checkedIn: true,
        });
      }
    }
  });
  // Every seeded pair needs >= 2 games (eligibility floor). B1 is the only
  // eligible B pair (1-1) → B1's players take seeds 7-8. C1 (2-0, beat B1
  // head-to-head) takes those spots.
  const games: CompletedRRGame[] = [
    { pairIds: ["A1", "A2"], winnerPairId: "A1" },
    { pairIds: ["A3", "A1"], winnerPairId: "A3" },
    { pairIds: ["A2", "A3"], winnerPairId: "A2" },
    { pairIds: ["B1", "B2"], winnerPairId: "B1" },
    { pairIds: ["C1", "B1"], winnerPairId: "C1" }, // the override game
    { pairIds: ["C1", "C4"], winnerPairId: "C1" }, // C1 clears the 2-game floor
    { pairIds: ["C2", "C3"], winnerPairId: "C2" },
  ];
  const { seeds, notes } = seedWednesdayTop8(players, pairs, games);
  assert(seeds.length === 8, "8 seeds selected");
  assert(seeds.slice(0, 6).every((s) => s.tier === "A"), "all A players seed first");
  const b1Seeded = seeds.some((s) => s.id.startsWith("B1"));
  const c1Seeded = seeds.filter((s) => s.id.startsWith("C1")).length;
  assert(!b1Seeded && c1Seeded === 2, "C1's players (beat B1 head-to-head) take B1's seats");
  assert(notes.some((n) => n.includes("head-to-head")), "override is disclosed");

  const bracket = wednesdayBracket(seeds);
  assert(bracket.length === 2, "two simultaneous semis");
  assert(bracket[0].a.seedLabel === "1 & 8" && bracket[0].b.seedLabel === "4 & 5", "semi 1 is 1&8 vs 4&5");
  assert(bracket[1].a.seedLabel === "2 & 7" && bracket[1].b.seedLabel === "3 & 6", "semi 2 is 2&7 vs 3&6");
}

section("Sunday per-court brackets (§11)");
{
  const mk = (id: string): import("../types").Pair => ({ id, playerIds: [`${id}a`, `${id}b`], tier: "B" });
  const pairs = ["P1", "P2", "P3", "P4", "P5", "P6"].map(mk);
  const games: CompletedRRGame[] = [
    { pairIds: ["P1", "P2"], winnerPairId: "P1" },
    { pairIds: ["P3", "P4"], winnerPairId: "P3" },
    { pairIds: ["P5", "P6"], winnerPairId: "P5" },
    { pairIds: ["P1", "P3"], winnerPairId: "P1" },
    { pairIds: ["P2", "P5"], winnerPairId: "P2" },
    { pairIds: ["P4", "P6"], winnerPairId: "P4" },
  ];
  const full = courtBracket(2, pairs, games);
  assert(full.kind === "semis" && full.matches.length === 2, "≥4 eligible pairs → two semis");
  assert(full.matches[0].a.seedLabel === "1" && full.matches[0].b.seedLabel === "4", "#1 vs #4");

  const small = courtBracket(1, pairs.slice(0, 3), games);
  assert(small.kind === "straight_final" && small.matches.length === 1, "<4 pairs → straight final");

  const open = seedOpen(pairs, games, 1);
  assert(open.length === 4, "open 1-court seeds top 4, pure Win%");
}

section("Eligibility floor: <2 games can't seed; admin override works (§11)");
{
  const mk = (id: string): import("../types").Pair => ({ id, playerIds: [`${id}a`, `${id}b`], tier: "B" });
  const pairs = ["L1", "P1", "P2", "P3", "P4"].map(mk);
  // L1 arrived late: 1-0 (100%). Everyone else has 2+ games.
  const games: CompletedRRGame[] = [
    { pairIds: ["P1", "P2"], winnerPairId: "P1" },
    { pairIds: ["P3", "P4"], winnerPairId: "P3" },
    { pairIds: ["P1", "P3"], winnerPairId: "P1" },
    { pairIds: ["P2", "P4"], winnerPairId: "P2" },
    { pairIds: ["L1", "P4"], winnerPairId: "L1" },
  ];
  const bracket = courtBracket(1, pairs, games);
  const seeded = bracket.matches.flatMap((m) => [...m.a.ids, ...m.b.ids]);
  assert(!seeded.includes("L1"), "1-0 late pair does not seed over 2-1 pairs");
  assert(seeded.includes("P1"), "full-night pairs seed normally");

  const overridden = courtBracket(1, pairs, games, 0);
  const seededAll = overridden.matches.flatMap((m) => [...m.a.ids, ...m.b.ids]);
  assert(seededAll.includes("L1"), "admin override (minGames 0) lets the late pair in");
}

section("Strength of schedule breaks Win% ties from winner-only data (§11)");
{
  const mk = (id: string): import("../types").Pair => ({ id, playerIds: [`${id}a`, `${id}b`], tier: "B" });
  const pairs = ["HARD", "EASY", "S1", "S2", "W1", "W2"].map(mk);
  // HARD went 1-1 against strong opponents; EASY went 1-1 against weak ones.
  // They never met (no H2H). Strong pairs also beat weak pairs.
  const games: CompletedRRGame[] = [
    { pairIds: ["HARD", "S1"], winnerPairId: "HARD" },
    { pairIds: ["HARD", "S2"], winnerPairId: "S2" },
    { pairIds: ["EASY", "W1"], winnerPairId: "EASY" },
    { pairIds: ["EASY", "W2"], winnerPairId: "W2" },
    { pairIds: ["S1", "W1"], winnerPairId: "S1" },
    { pairIds: ["S2", "W2"], winnerPairId: "S2" },
  ];
  const rows = pairStandings(pairs, games);
  const sorted = sortSeeding(rows.filter((r) => r.id === "HARD" || r.id === "EASY"), () => 0);
  assert(sorted[0].id === "HARD", "harder road seeds higher at equal Win%");
  assert(sorted[0].tiebreakApplied === "wins on strength of schedule", `SOS annotation shown (got "${sorted[0].tiebreakApplied}")`);
}

section("Coin flip: deterministic, visible, antisymmetric (§11)");
{
  assert(coinFlipWinner("pairX", "pairY") === coinFlipWinner("pairY", "pairX"), "same two ids always flip the same way");
  const mk = (id: string): import("../types").Pair => ({ id, playerIds: [`${id}a`, `${id}b`], tier: "B" });
  const pairs = ["T1", "T2"].map(mk);
  // Perfect mirror: 1-1 each vs each other — H2H nets to zero, SOS identical.
  const games: CompletedRRGame[] = [
    { pairIds: ["T1", "T2"], winnerPairId: "T1" },
    { pairIds: ["T1", "T2"], winnerPairId: "T2" },
  ];
  const rows = pairStandings(pairs, games);
  const a = sortSeeding(rows, () => 0);
  const b = sortSeeding(rows, () => 0);
  assert(a[0].id === b[0].id, "re-sorting never re-flips the coin");
  assert(a[0].tiebreakApplied === "wins the coin flip", `coin flip annotation shown (got "${a[0].tiebreakApplied}")`);
}

section("Pause: frozen time excluded from measured durations (§8)");
{
  const t = 1_700_000_000_000;
  const min = 60_000;
  // 12-minute game with a 5-minute pause inside → 7 effective minutes.
  const overlap = pausedOverlapMs(t, t + 12 * min, [{ start: t + 2 * min, end: t + 7 * min }]);
  assert(overlap === 5 * min, `pause overlap measured (got ${overlap / min} min)`);
  // Still-active pause counts up to completion.
  const active = pausedOverlapMs(t, t + 10 * min, [{ start: t + 8 * min, end: null }]);
  assert(active === 2 * min, "open pause counts to completion time");
  // Pause outside the game window doesn't count.
  const outside = pausedOverlapMs(t, t + 5 * min, [{ start: t + 6 * min, end: t + 9 * min }]);
  assert(outside === 0, "non-overlapping pause ignored");
}

// ---------------------------------------------------------------------------
await (async () => {
  section("Persistence: localStorage-first, remote in background (§12)");

  type S = { n: number };
  const flakyRemote = (failures: { push: boolean }) => {
    let stored: Envelope<S> | null = null;
    const remote: RemoteSync<S> = {
      async push(env) {
        if (failures.push) throw new Error("wifi down");
        stored = env;
      },
      async pull() {
        return stored;
      },
    };
    return { remote, get stored() { return stored; } };
  };

  // Local write survives a dead network; status shows pending/error, flush recovers.
  const fail = { push: true };
  const r1 = flakyRemote(fail);
  const storage1 = memoryStorage();
  const store1 = createSessionStore<S>({
    storageKey: "cm2_test",
    schemaVersion: 1,
    storage: storage1,
    remote: r1.remote,
    defaults: () => ({ n: 0 }),
  });
  store1.save({ n: 42 }, 1000);
  assert(storage1.getItem("cm2_test") !== null, "state written to local storage synchronously");
  await new Promise((r) => setTimeout(r, 10));
  assert(store1.syncStatus() !== "synced", `network down → status shows unsynced (got ${store1.syncStatus()})`);
  const resumed = await store1.load();
  assert(resumed.source === "local" && resumed.state.n === 42, "refresh mid-session resumes from LOCAL, not remote");

  fail.push = false;
  await store1.flush();
  assert(store1.syncStatus() === "synced", "flush after reconnect clears pending");
  assert(r1.stored?.state.n === 42, "remote caught up in background");

  // No local session → pull remote; nothing anywhere → defaults.
  const r2 = flakyRemote({ push: false });
  await r2.remote.push({ schemaVersion: 1, savedAt: 5, state: { n: 7 } });
  const store2 = createSessionStore<S>({
    storageKey: "cm2_test",
    schemaVersion: 1,
    storage: memoryStorage(),
    remote: r2.remote,
    defaults: () => ({ n: 0 }),
  });
  const fromRemote = await store2.load();
  assert(fromRemote.source === "remote" && fromRemote.state.n === 7, "no local session → recovered from remote");

  const store3 = createSessionStore<S>({
    storageKey: "cm2_test",
    schemaVersion: 1,
    storage: memoryStorage(),
    remote: null,
    defaults: () => ({ n: 0 }),
  });
  const fromDefaults = await store3.load();
  assert(fromDefaults.source === "defaults", "defaults only as the last resort");

  // Schema bump invalidates stale local state instead of loading garbage.
  const storage4 = memoryStorage();
  storage4.setItem("cm2_test", JSON.stringify({ schemaVersion: 1, savedAt: 1, state: { n: 9 } }));
  const store4 = createSessionStore<S>({
    storageKey: "cm2_test",
    schemaVersion: 2,
    storage: storage4,
    remote: null,
    defaults: () => ({ n: 0 }),
  });
  assert((await store4.load()).source === "defaults", "old-schema local state is not resumed");
})();

// ---------------------------------------------------------------------------
section("Sub rotation: proposes after 2 games, never auto-confirms (§11)");
{
  let rot = createSubRotation("sub1");
  const stats = [
    { playerId: "p1", gamesPlayed: 3 },
    { playerId: "p2", gamesPlayed: 3 },
    { playerId: "p3", gamesPlayed: 2 },
  ];
  assert(proposeSubRotation(rot, stats) === null, "no proposal before the sub has sat 2 games");
  rot = tickSubRotation(rot);
  assert(proposeSubRotation(rot, stats) === null, "still no proposal after 1 game");
  rot = tickSubRotation(rot);
  const proposal = proposeSubRotation(rot, stats);
  assert(proposal !== null && proposal.inPlayerId === "sub1", "proposal due after 2 games");
  assert(proposal?.outPlayerId === "p1", "picks most-games / fewest-sits candidate");

  // The proposal is inert until a human applies it — state unchanged.
  assert(rot.subPlayerId === "sub1", "proposing changes nothing (no auto-confirm)");

  // Human picks a different player: p2 out, becomes the new sub.
  rot = applySubRotation(rot, "p2");
  assert(rot.subPlayerId === "p2" && rot.gamesSinceRotation === 0, "replaced player becomes the new sub");
  assert(rot.timesSubbedOut.p2 === 1, "sit count recorded");

  rot = tickSubRotation(tickSubRotation(rot));
  const second = proposeSubRotation(rot, stats);
  assert(second?.outPlayerId === "p1", "fewest-sits tiebreak avoids re-benching p2");
}

section("Result correction: flip recalculates standings (§9)");
{
  const results: GameResult[] = [
    { gameId: "g1", winnerPairId: "X", loserPairId: "Y", startedAt: 0, completedAt: 1 },
    { gameId: "g2", winnerPairId: "Y", loserPairId: "Z", startedAt: 0, completedAt: 1 },
  ];
  const corrected = correctResult(results, "g1", "Y");
  assert(corrected[0].winnerPairId === "Y" && corrected[0].loserPairId === "X", "flip swaps winner and loser");
  assert(corrected[1] === results[1], "other results untouched");
  let rejected = false;
  try {
    correctResult(results, "g1", "Z");
  } catch {
    rejected = true;
  }
  assert(rejected, "can't award a game to a pair that didn't play it");

  const pairsXYZ: import("../types").Pair[] = [
    { id: "X", playerIds: ["x1", "x2"], tier: "B" },
    { id: "Y", playerIds: ["y1", "y2"], tier: "B" },
    { id: "Z", playerIds: ["z1", "z2"], tier: "B" },
  ];
  const asRR = (rs: GameResult[]): CompletedRRGame[] =>
    rs.map((r) => ({ pairIds: [r.winnerPairId, r.loserPairId], winnerPairId: r.winnerPairId }));
  const beforeRows = pairStandings(pairsXYZ, asRR(results));
  const afterRows = pairStandings(pairsXYZ, asRR(corrected));
  const wins = (rows: typeof beforeRows, id: string) => rows.find((r) => r.id === id)?.wins ?? -1;
  assert(wins(beforeRows, "X") === 1 && wins(afterRows, "X") === 0, "standings derive from corrected results");
  assert(wins(afterRows, "Y") === 2, "corrected winner credited everywhere downstream");
}

// ---------------------------------------------------------------------------
section("Secrecy layer: player-facing views cannot leak tiers or VIP (§18)");
{
  const mkPlayer = (id: string, name: string, tier: Tier, extra: Partial<Player> = {}): Player => ({
    id,
    name,
    tier,
    isVip: false,
    isCoach: false,
    checkedIn: true,
    ...extra,
  });
  const roster = [
    mkPlayer("p1", "Zoe", "A", { isVip: true, vipPartnerId: "p3" }),
    mkPlayer("p2", "Alex", "C", { checkedIn: false }),
    mkPlayer("p3", "Marta", "A"),
    mkPlayer("p4", "Ben", "B", { isCoach: true }),
  ];

  const view = publicRoster(roster);
  assert(view.map((r) => r.name).join(",") === "Alex,Ben,Marta,Zoe", "names alphabetical");
  const leaked = view.some((r) => {
    const keys = Object.keys(r).sort().join(",");
    return keys !== "checkedIn,name,playerId";
  });
  assert(!leaked, "roster entries carry ONLY playerId/name/checkedIn — no tier, no VIP, no coach");

  const summary = publicCountSummary(roster);
  assert(summary.checkedIn === 3 && summary.total === 4, "count summary is totals only");
  assert(Object.keys(summary).sort().join(",") === "checkedIn,total", "no tier breakdown in the summary");
}

section("VIP resolution: mutual lock, pending, check-in-order conflicts (§5, rule 15)");
{
  const mk = (id: string, tier: Tier, extra: Partial<Player> = {}): Player => ({
    id,
    name: id,
    tier,
    isVip: false,
    isCoach: false,
    checkedIn: true,
    ...extra,
  });

  // Mutual picks lock instantly.
  const mutual = resolveVipPicks([
    mk("v1", "B", { isVip: true, vipPartnerId: "v2", checkInTime: 10 }),
    mk("v2", "B", { isVip: true, vipPartnerId: "v1", checkInTime: 20 }),
  ]);
  assert(mutual.locks.length === 1 && mutual.locks[0].vipLocked === true, "mutual VIP picks lock as one pair");

  // Absent partner → pending, not paired, not rejected.
  const held = resolveVipPicks([
    mk("v1", "A", { isVip: true, vipPartnerId: "px", checkInTime: 5 }),
    mk("px", "A", { checkedIn: false }),
  ]);
  assert(held.locks.length === 0 && held.pending.length === 1, "VIP holds pending until partner arrives");

  // Conflict: two VIPs pick the same partner — earlier check-in wins.
  const conflict = resolveVipPicks([
    mk("late", "B", { isVip: true, vipPartnerId: "target", checkInTime: 50 }),
    mk("early", "B", { isVip: true, vipPartnerId: "target", checkInTime: 10 }),
    mk("target", "B"),
  ]);
  assert(
    conflict.locks.length === 1 && conflict.locks[0].playerIds.includes("early"),
    "conflict resolves by check-in order",
  );
  assert(conflict.rejected.length === 1 && conflict.rejected[0].vipId === "late", "later VIP falls back, disclosed to admin");

  // Cross-tier picks are invalid.
  const crossTier = resolveVipPicks([
    mk("v1", "A", { isVip: true, vipPartnerId: "c1", checkInTime: 1 }),
    mk("c1", "C"),
  ]);
  assert(crossTier.locks.length === 0 && crossTier.rejected[0].reason.includes("tier"), "VIP picks are same-tier only");
}

section("Pair generation: within tier, VIP locks preserved, odd players surfaced (§5)");
{
  const players: Player[] = [];
  const add = (id: string, tier: Tier, extra: Partial<Player> = {}) =>
    players.push({ id, name: id, tier, isVip: false, isCoach: false, checkedIn: true, ...extra });
  // A: 4 (two are mutual VIPs) · B: 5 (odd) · C: 4, one VIP holding for an absent partner.
  add("a1", "A", { isVip: true, vipPartnerId: "a2", checkInTime: 1 });
  add("a2", "A", { isVip: true, vipPartnerId: "a1", checkInTime: 2 });
  add("a3", "A");
  add("a4", "A");
  for (let i = 1; i <= 5; i++) add(`b${i}`, "B");
  add("c1", "C", { isVip: true, vipPartnerId: "c9", checkInTime: 3 });
  add("c9", "C", { checkedIn: false });
  add("c2", "C");
  add("c3", "C");
  add("c4", "C");

  const gen = generatePairs(players, 7);
  assert(gen.pairs.every((p) => {
    const [x, y] = p.playerIds.map((id) => players.find((pl) => pl.id === id));
    return x && y && x.tier === y.tier && x.tier === p.tier;
  }), "every pair is same-tier");
  assert(gen.pairs.some((p) => p.vipLocked && p.playerIds.includes("a1") && p.playerIds.includes("a2")), "VIP lock preserved in generation");
  assert(gen.unpaired.B.length === 1, "odd B player surfaced as sub/waitlist candidate");
  assert(gen.unpaired.C.includes("c1"), "VIP holding for absent partner goes to the waitlist, not auto-paired");
  const paired = new Set(gen.pairs.flatMap((p) => p.playerIds));
  assert(!paired.has("c9"), "players who haven't checked in are never paired");
  const cPaired = ["c2", "c3", "c4"].filter((id) => paired.has(id)).length;
  assert(cPaired === 2 && gen.unpaired.C.length === 2, "remaining odd C player joins the waitlist too");
}

// ---------------------------------------------------------------------------
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`\n${failures} FAILURES — do not run a session on this build.`);
  process.exit(1);
}
console.log("GREEN — scheduler core is safe to build on.\n");
