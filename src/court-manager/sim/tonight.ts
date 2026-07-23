// Pre-session ritual (COURT-MANAGER.md §15) — run before every session night
// with that week's ACTUAL numbers.
//
//   npx tsx src/court-manager/sim/tonight.ts
//
// Tonight (Wed Mississauga): roster 36 = 12A / 14B / 10C players; typically
// 20-26 check in. This drives the REAL paths end to end for every plausible
// check-in shape: pair generation → 4-round schedule → validation → a late
// pair joining at the boundary → a removal → full results → seeding with the
// eligibility floor → the bracket path the hook takes for that seed count.

import type { Pair, Player, RoundGame, Tier } from "../types";
import { generatePairs } from "../checkin";
import { generateRoundSchedule, regenerateFromRound } from "../scheduler/rounds";
import { validateRoundSchedule } from "../scheduler/validate";
import type { CompletedRRGame } from "../playoffs";
import { seedWednesdayTop8, wednesdayBracket } from "../playoffs";

let failures = 0;
let checks = 0;
function assert(cond: boolean, label: string): void {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  ✗ ${label}`);
  }
}

// Tonight's real tier distribution, scaled to each check-in count.
const ROSTER = { A: 12, B: 14, C: 10 };

function makeCheckedIn(count: number, seed: number): Player[] {
  const players: Player[] = [];
  (Object.keys(ROSTER) as Tier[]).forEach((tier) => {
    const share = Math.round((ROSTER[tier] / 36) * count);
    for (let i = 1; i <= share; i++) {
      players.push({
        id: `${tier}${i}`,
        name: `${tier}${i}`,
        tier,
        isVip: false,
        isCoach: tier === "B" && i === 1, // one coach, like tonight
        checkedIn: true,
        checkInTime: 1_700_000_000_000 + i * 1000 + seed,
      });
    }
  });
  return players;
}

function playRandom(rounds: RoundGame[][], upTo: number, seed: number): CompletedRRGame[] {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
  const out: CompletedRRGame[] = [];
  for (let r = 0; r < upTo && r < rounds.length; r++) {
    for (const g of rounds[r]) {
      out.push({ pairIds: g.pairIds, winnerPairId: g.pairIds[rand() < 0.5 ? 0 : 1] });
    }
  }
  return out;
}

for (const checkedIn of [20, 21, 22, 23, 24, 25, 26]) {
  console.log(`\n=== Tonight shape: ${checkedIn} checked in (roster mix 12A/14B/10C) ===`);
  const players = makeCheckedIn(checkedIn, checkedIn * 7);
  const gen = generatePairs(players, checkedIn);
  const tierCount = (t: Tier) => gen.pairs.filter((p) => p.tier === t).length;
  console.log(
    `  pairs: ${gen.pairs.length} (${tierCount("A")}A/${tierCount("B")}B/${tierCount("C")}C), waitlist: ${Object.values(gen.unpaired).flat().length}`,
  );
  assert(gen.pairs.length >= 4, "enough pairs to start");

  const config = { rounds: 4, sameTierRounds: 2, courts: 2, seed: checkedIn };
  const schedule = generateRoundSchedule(gen.pairs, config);
  const odd = gen.pairs.length % 2 === 1;
  const violations = validateRoundSchedule(gen.pairs, schedule, { maxSpread: odd ? 1 : 0 });
  violations.forEach((v) => console.error(`  validator: ${v.message}`));
  assert(violations.length === 0, `schedule validates clean (${gen.pairs.length} pairs${odd ? ", byes" : ""})`);
  assert(schedule.rounds.every((r) => r.length > 0), "no empty rounds");

  // Late arrival at the round-2 boundary: two same-tier players → one new pair.
  const latePair: Pair = { id: "LATE", playerIds: ["LATEa", "LATEb"], tier: "B" };
  const withLate = [...gen.pairs, latePair];
  const afterLate = regenerateFromRound(withLate, schedule.rounds.slice(0, 2), byesThrough(schedule.byes, 2), config);
  assert(
    JSON.stringify(afterLate.rounds.slice(0, 2)) === JSON.stringify(schedule.rounds.slice(0, 2)),
    "late join: completed rounds untouched",
  );
  const lateViolations = validateRoundSchedule(withLate, afterLate, {
    maxSpread: 1,
    spreadExempt: ["LATE"],
  });
  lateViolations.forEach((v) => console.error(`  validator(late): ${v.message}`));
  assert(lateViolations.length === 0, "late join validates clean");

  // Removal at the round-2 boundary.
  const removed = gen.pairs[Math.floor(gen.pairs.length / 2)];
  const remaining = gen.pairs.filter((p) => p.id !== removed.id);
  const afterRemoval = regenerateFromRound(remaining, schedule.rounds.slice(0, 2), byesThrough(schedule.byes, 2), config);
  const removalViolations = validateRoundSchedule(gen.pairs, afterRemoval, {
    maxSpread: 1,
    spreadExempt: [removed.id],
  });
  removalViolations.forEach((v) => console.error(`  validator(removal): ${v.message}`));
  assert(removalViolations.length === 0, "removal validates clean");
  assert(
    afterRemoval.rounds.slice(2).flat().every((g) => !g.pairIds.includes(removed.id)),
    "removed pair has no future games",
  );

  // Full night → seeding with the 2-game floor → the bracket path the hook takes.
  const games = playRandom(schedule.rounds, 4, checkedIn * 13);
  const { seeds, notes } = seedWednesdayTop8(players, gen.pairs, games);
  assert(seeds.length >= 4, `enough eligible seeds for a playoff (got ${seeds.length})`);
  try {
    if (seeds.length >= 8) {
      const bracket = wednesdayBracket(seeds.slice(0, 8));
      assert(bracket.length === 2, "top-8 bracket: two semis");
    } else {
      // Hook fallback: single final, seeds 1&4 vs 2&3 — must not throw.
      assert(seeds.length >= 4, "fallback final has 4 seeds");
    }
  } catch (e) {
    assert(false, `bracket construction threw: ${(e as Error).message}`);
  }
  const floorNote = notes.find((n) => n.includes("Not eligible"));
  if (floorNote) console.log(`  note: ${floorNote}`);

  // Jump-after-3 variant (the decision point lands on "jump"): seeding at 3 games.
  const games3 = playRandom(schedule.rounds, 3, checkedIn * 17);
  const jump = seedWednesdayTop8(players, gen.pairs, games3);
  assert(jump.seeds.length >= 4, `jump-to-playoffs after round 3 still seeds (got ${jump.seeds.length})`);
}

function byesThrough(byes: Record<number, string[]>, round: number): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const [r, ids] of Object.entries(byes)) if (Number(r) <= round) out[Number(r)] = ids;
  return out;
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error("\nNOT SAFE FOR TONIGHT — fix before the session.");
  process.exit(1);
}
console.log("GREEN — tonight's shapes are safe. Run the full suite too: npx tsx src/court-manager/sim/run.ts\n");
