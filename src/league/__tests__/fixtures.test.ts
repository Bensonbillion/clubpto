// The fixture generator is the one genuinely hard part of the admin console,
// and an unfair card is worse than no card: the players notice immediately.
// These tests assert the five objectives directly rather than pinning a
// particular schedule, so the generator can be re-tuned without rewriting
// them.

import { describe, expect, it } from "vitest";
import {
  capacityPreview,
  generateFixtures,
  type Fixture,
  type GenerationResult,
} from "../fixtures";

const COURTS = ["Court 4", "Court 5", "Court 6"];

const names = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `P${i + 1}`);

const ok = (result: GenerationResult) => {
  if (result.error) throw new Error(`expected success, got: ${result.error}`);
  return result;
};

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

const partnershipCounts = (fixtures: Fixture[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const f of fixtures) {
    for (const team of [f.teamA, f.teamB]) {
      const key = pairKey(team[0], team[1]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
};

/** Which rounds each player sat out, derived from the card itself. */
const byeRounds = (
  fixtures: Fixture[],
  players: string[],
  rounds: number,
): Map<string, number[]> => {
  const played = new Map<string, Set<number>>(
    players.map((p) => [p, new Set<number>()]),
  );
  for (const f of fixtures) {
    for (const p of [...f.teamA, ...f.teamB]) played.get(p)!.add(f.round);
  }
  const out = new Map<string, number[]>();
  for (const p of players) {
    const sat: number[] = [];
    for (let r = 1; r <= rounds; r++) if (!played.get(p)!.has(r)) sat.push(r);
    out.set(p, sat);
  }
  return out;
};

describe("generateFixtures — refusals", () => {
  it("refuses a division of three rather than crashing", () => {
    const result = generateFixtures({
      division: "W",
      players: names(3),
      courts: ["Court 6"],
      rounds: 6,
    });
    expect(result.error).toContain("at least 4");
    expect(result.fixtures).toHaveLength(0);
    // The message is shown to a human on a court, so it must name the problem.
    expect(result.error).toContain("W");
  });

  it("refuses when the courts allocated need more players than turned up", () => {
    const result = generateFixtures({
      division: "M1",
      players: names(5),
      courts: ["Court 4", "Court 5"],
      rounds: 6,
    });
    expect(result.error).toContain("fewer courts");
    expect(result.fixtures).toHaveLength(0);
  });

  it("refuses duplicate names, because Matches stores names not IDs", () => {
    const result = generateFixtures({
      division: "M2",
      players: ["Ben", "Ben", "Omar", "Kalid"],
      courts: ["Court 5"],
      rounds: 4,
    });
    expect(result.error).toContain("same name");
    expect(result.fixtures).toHaveLength(0);
  });

  it("refuses zero courts and zero rounds", () => {
    expect(
      generateFixtures({
        division: "M1",
        players: names(6),
        courts: [],
        rounds: 6,
      }).error,
    ).toBeTruthy();
    expect(
      generateFixtures({
        division: "M1",
        players: names(6),
        courts: ["Court 4"],
        rounds: 0,
      }).error,
    ).toBeTruthy();
  });
});

describe("generateFixtures — the five objectives, N = 4..12", () => {
  // One court is the real configuration here: three courts split across
  // three divisions. Two courts is checked separately below.
  for (let n = 4; n <= 12; n++) {
    const rounds = 6;
    it(`N=${n}, 1 court, ${rounds} rounds`, () => {
      const players = names(n);
      const { fixtures, stats } = ok(
        generateFixtures({
          division: "M1",
          players,
          courts: ["Court 4"],
          rounds,
          seed: 7,
        }),
      );

      expect(fixtures).toHaveLength(rounds);

      // Nobody is in two places at once, and every match has four players.
      for (const f of fixtures) {
        const four = [...f.teamA, ...f.teamB];
        expect(new Set(four).size).toBe(4);
        for (const p of four) expect(players).toContain(p);
      }

      // Objective 5: match counts within one.
      const counts = Object.values(stats.matchesPerPlayer);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);

      // Objective 2: byes within one.
      const byes = Object.values(stats.byes);
      expect(Math.max(...byes) - Math.min(...byes)).toBeLessThanOrEqual(1);

      // Matches and byes account for every round, for every player.
      for (const p of players) {
        expect(stats.matchesPerPlayer[p] + stats.byes[p]).toBe(rounds);
      }

      // Objective 1: no pairing is used twice while another is unused.
      const used = partnershipCounts(fixtures);
      const possiblePairs = (n * (n - 1)) / 2;
      const needed = fixtures.length * 2;
      if (needed <= possiblePairs) {
        for (const [, count] of used) expect(count).toBe(1);
      } else {
        // Forced repeats: every distinct pair must be spent first.
        expect(used.size).toBe(possiblePairs);
        const maxUse = Math.max(...used.values());
        expect(maxUse).toBeLessThanOrEqual(Math.ceil(needed / possiblePairs));
      }
    });
  }
});

describe("generateFixtures — the acceptance case", () => {
  // Criterion 4: a division of five on one court over six rounds.
  it("five players, one court, six rounds: byes spread, pairings spent in full", () => {
    const players = names(5);
    const rounds = 6;
    const { fixtures, stats } = ok(
      generateFixtures({
        division: "M1",
        players,
        courts: ["Court 4"],
        rounds,
        seed: 3,
      }),
    );

    // Six rounds, one sitting out each round, five players: one person sits
    // twice and everyone else once.
    const byes = players.map((p) => stats.byes[p]);
    expect(byes.reduce((a, b) => a + b, 0)).toBe(6);
    expect(Math.max(...byes)).toBe(2);
    expect(Math.min(...byes)).toBe(1);

    // Twelve partnerships are needed and only ten pairs exist, so the
    // literal reading of "no repeated partnership" is arithmetically
    // impossible. What we hold it to is spending all ten first.
    const used = partnershipCounts(fixtures);
    expect(used.size).toBe(10);
    expect(Math.max(...used.values())).toBe(2);

    expect(
      stats.warnings.some((w) => w.includes("only 10 possible pairs")),
    ).toBe(true);
  });

  it("four players cycle the three distinct pairings before repeating", () => {
    const players = names(4);
    const { fixtures } = ok(
      generateFixtures({
        division: "W",
        players,
        courts: ["Court 6"],
        rounds: 3,
        seed: 11,
      }),
    );
    // Three rounds, three ways to split four people: each used once, which
    // spends all six pairs exactly once.
    const used = partnershipCounts(fixtures);
    expect(used.size).toBe(6);
    for (const [, count] of used) expect(count).toBe(1);
  });

  it("four players over six rounds uses each pairing exactly twice", () => {
    const { fixtures } = ok(
      generateFixtures({
        division: "W",
        players: names(4),
        courts: ["Court 6"],
        rounds: 6,
        seed: 11,
      }),
    );
    const used = partnershipCounts(fixtures);
    expect(used.size).toBe(6);
    for (const [, count] of used) expect(count).toBe(2);
  });
});

describe("generateFixtures — byes", () => {
  it("avoids back to back byes when the roster allows it", () => {
    // Eight players, one court: four sit out each round, so each player
    // plays every other round at most. Back to back byes are avoidable.
    const players = names(8);
    const rounds = 6;
    const { fixtures } = ok(
      generateFixtures({
        division: "M2",
        players,
        courts: ["Court 4"],
        rounds,
        seed: 5,
      }),
    );
    const sat = byeRounds(fixtures, players, rounds);
    for (const [player, roundsSatOut] of sat) {
      for (let i = 1; i < roundsSatOut.length; i++) {
        expect(
          roundsSatOut[i] - roundsSatOut[i - 1],
          `${player} sat out rounds ${roundsSatOut.join(", ")}`,
        ).toBeGreaterThan(1);
      }
    }
  });

  it("nobody sits twice before everyone has sat once", () => {
    const players = names(7);
    const rounds = 6;
    const { fixtures } = ok(
      generateFixtures({
        division: "M1",
        players,
        courts: ["Court 4"],
        rounds,
        seed: 2,
      }),
    );
    const sat = byeRounds(fixtures, players, rounds);
    // The round at which each player takes their first bye.
    const firstBye = players.map((p) => sat.get(p)![0] ?? Infinity);
    const secondBye = players.map((p) => sat.get(p)![1] ?? Infinity);
    const lastFirst = Math.max(...firstBye.filter((r) => r !== Infinity));
    for (const second of secondBye) {
      if (second !== Infinity) expect(second).toBeGreaterThan(lastFirst - 1);
    }
  });
});

describe("generateFixtures — multiple courts", () => {
  it("fills both courts every round and keeps players in one place", () => {
    const players = names(9);
    const rounds = 6;
    const { fixtures, stats } = ok(
      generateFixtures({
        division: "M2",
        players,
        courts: ["Court 4", "Court 5"],
        rounds,
        seed: 13,
      }),
    );
    expect(fixtures).toHaveLength(rounds * 2);

    for (let r = 1; r <= rounds; r++) {
      const inRound = fixtures.filter((f) => f.round === r);
      expect(inRound).toHaveLength(2);
      expect(new Set(inRound.map((f) => f.court)).size).toBe(2);
      const seated = inRound.flatMap((f) => [...f.teamA, ...f.teamB]);
      expect(new Set(seated).size).toBe(8); // nobody on two courts at once
    }

    const counts = Object.values(stats.matchesPerPlayer);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("uses only the courts it was given", () => {
    const { fixtures } = ok(
      generateFixtures({
        division: "M1",
        players: names(8),
        courts: ["Court 6"],
        rounds: 4,
        seed: 1,
      }),
    );
    expect(new Set(fixtures.map((f) => f.court))).toEqual(new Set(["Court 6"]));
  });
});

describe("generateFixtures — determinism and regeneration", () => {
  it("same seed, same card", () => {
    const opts = {
      division: "M1",
      players: names(7),
      courts: ["Court 4"],
      rounds: 6,
      seed: 42,
    };
    expect(ok(generateFixtures(opts)).fixtures).toEqual(
      ok(generateFixtures(opts)).fixtures,
    );
  });

  it("a new seed gives a different card", () => {
    const base = {
      division: "M1",
      players: names(7),
      courts: ["Court 4"],
      rounds: 6,
    };
    const a = ok(generateFixtures({ ...base, seed: 1 })).fixtures;
    const b = ok(generateFixtures({ ...base, seed: 2 })).fixtures;
    expect(a).not.toEqual(b);
  });
});

describe("generateFixtures — the real Season 1 divisions", () => {
  // Straight from the Players tab: M1 has 7, M2 has 9, W has 5.
  const M1 = ["David G", "Benson E.", "Edgar A.", "Saga", "Folarin A.", "Tami O.", "Lewis"];
  const M2 = ["Omar", "Kalid", "Ben", "Taiwo", "Idris", "Demi", "Dami", "Kola", "Layi"];
  const W = ["Evelyn A", "Albright G", "Paola I", "Onome", "Samia"];

  it("builds a full card for all three divisions on one court each", () => {
    const divisions: [string, string[], string][] = [
      ["M1", M1, COURTS[0]],
      ["M2", M2, COURTS[1]],
      ["W", W, COURTS[2]],
    ];
    for (const [division, players, court] of divisions) {
      const { fixtures, stats } = ok(
        generateFixtures({
          division,
          players,
          courts: [court],
          rounds: 6,
          seed: 9,
        }),
      );
      expect(fixtures).toHaveLength(6);
      for (const f of fixtures) expect(f.division).toBe(division);
      const counts = Object.values(stats.matchesPerPlayer);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });

  it("warns that nine on one court is thin", () => {
    const { stats } = ok(
      generateFixtures({
        division: "M2",
        players: M2,
        courts: ["Court 5"],
        rounds: 6,
        seed: 9,
      }),
    );
    expect(stats.warnings.some((w) => w.includes("one court"))).toBe(true);
  });

  it("generates every realistic division well inside 200ms", () => {
    const started = performance.now();
    for (let i = 0; i < 20; i++) {
      ok(
        generateFixtures({
          division: "M2",
          players: M2,
          courts: ["Court 4", "Court 5"],
          rounds: 8,
          seed: i,
        }),
      );
    }
    const perRun = (performance.now() - started) / 20;
    expect(perRun).toBeLessThan(200);
  });
});

describe("generateFixtures — seed sweep", () => {
  // Regenerate hands the admin a different seed. The objectives have to hold
  // on all of them, not just the ones these tests happened to pick, or the
  // second tap on a Sunday produces a card nobody can defend.
  it("holds the objectives across 25 seeds for every roster size 4..12", () => {
    const rounds = 6;
    const failures: string[] = [];

    for (let n = 4; n <= 12; n++) {
      const players = names(n);
      const possiblePairs = (n * (n - 1)) / 2;

      for (let seed = 1; seed <= 25; seed++) {
        const result = generateFixtures({
          division: "M1",
          players,
          courts: ["Court 4"],
          rounds,
          seed,
        });
        if (result.error) {
          failures.push(`n=${n} seed=${seed}: refused, ${result.error}`);
          continue;
        }
        const { fixtures, stats } = result;
        const where = `n=${n} seed=${seed}`;

        const matchCounts = Object.values(stats.matchesPerPlayer);
        const matchSpread = Math.max(...matchCounts) - Math.min(...matchCounts);
        if (matchSpread > 1) failures.push(`${where}: match spread ${matchSpread}`);

        const byeCounts = Object.values(stats.byes);
        const byeSpread = Math.max(...byeCounts) - Math.min(...byeCounts);
        if (byeSpread > 1) failures.push(`${where}: bye spread ${byeSpread}`);

        for (const f of fixtures) {
          if (new Set([...f.teamA, ...f.teamB]).size !== 4) {
            failures.push(`${where}: round ${f.round} has a duplicate player`);
          }
        }

        // Every distinct pairing must be spent before any is reused.
        const used = partnershipCounts(fixtures);
        const needed = fixtures.length * 2;
        if (needed <= possiblePairs) {
          const repeated = [...used.values()].filter((c) => c > 1).length;
          if (repeated > 0) {
            failures.push(
              `${where}: ${repeated} pairing(s) repeated with ${possiblePairs - used.size} still unused`,
            );
          }
        } else if (used.size !== possiblePairs) {
          failures.push(
            `${where}: only ${used.size}/${possiblePairs} pairings used before repeating`,
          );
        }
      }
    }

    expect(failures, failures.slice(0, 12).join("\n")).toHaveLength(0);
  });

  it("holds for two courts across 15 seeds", () => {
    const failures: string[] = [];
    for (let n = 8; n <= 12; n++) {
      for (let seed = 1; seed <= 15; seed++) {
        const result = generateFixtures({
          division: "M2",
          players: names(n),
          courts: ["Court 4", "Court 5"],
          rounds: 6,
          seed,
        });
        if (result.error) {
          failures.push(`n=${n} seed=${seed}: ${result.error}`);
          continue;
        }
        const counts = Object.values(result.stats.matchesPerPlayer);
        const spread = Math.max(...counts) - Math.min(...counts);
        if (spread > 1) failures.push(`n=${n} seed=${seed}: match spread ${spread}`);
        for (let r = 1; r <= 6; r++) {
          const seated = result.fixtures
            .filter((f) => f.round === r)
            .flatMap((f) => [...f.teamA, ...f.teamB]);
          if (new Set(seated).size !== seated.length) {
            failures.push(`n=${n} seed=${seed}: round ${r} double-books a player`);
          }
        }
      }
    }
    expect(failures, failures.slice(0, 12).join("\n")).toHaveLength(0);
  });
});

describe("capacityPreview", () => {
  it("matches the allocation screen's numbers", () => {
    // 5 players, 1 court, 6 rounds: 4 play, 1 sits, ~4 matches each.
    expect(capacityPreview(5, 1, 6)).toEqual({
      matchesEach: 4,
      sittingOut: 1,
      viable: true,
    });
    // 6 players, 1 court: 2 sit out.
    expect(capacityPreview(6, 1, 6)).toEqual({
      matchesEach: 4,
      sittingOut: 2,
      viable: true,
    });
  });

  it("flags a division that cannot run doubles", () => {
    expect(capacityPreview(3, 1, 6).viable).toBe(false);
    expect(capacityPreview(5, 2, 6).viable).toBe(false);
  });
});
