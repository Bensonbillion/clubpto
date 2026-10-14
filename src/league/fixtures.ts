// PTO League — round robin fixture generator.
//
// Pure, deterministic for a given seed, no side effects. Given the players
// who actually turned up in one division, the courts that division has been
// allocated and how many rounds the session has room for, it produces the
// card: who partners whom, against whom, on which court, in which round.
//
// Objectives, in the priority the spec sets out:
//   1. No partnership repeats until every possible pairing has been used
//   2. Byes spread evenly
//   3. No back to back byes where avoidable
//   4. Opponent variety
//   5. Match counts within 1 of each other
//
// Objective 1 is bounded by arithmetic, not by effort. A division of five on
// one court over six rounds needs twelve partnerships and only has ten
// distinct pairs available, so two repeats are forced. The generator spends
// every distinct pair before it reuses one, and reports coverage so the
// screen can show the ceiling rather than implying a failure.

export interface Fixture {
  division: string;
  round: number;
  /** Court name as the Sheet stores it, e.g. "Court 4". */
  court: string;
  teamA: [string, string];
  teamB: [string, string];
}

export interface GenerationStats {
  /** Per player: how many of the other players they partnered at least once. */
  partnerCoverage: Record<string, { used: number; possible: number }>;
  byes: Record<string, number>;
  matchesPerPlayer: Record<string, number>;
  warnings: string[];
}

/**
 * Failure is carried as a populated `error` with empty `fixtures`, rather
 * than as a discriminated union. This repo compiles with `strict: false`,
 * and without strictNullChecks TypeScript will not narrow a union on a
 * boolean literal discriminant, so `if (result.ok)` buys the caller nothing
 * and every access to `error` is a compile error. A plain optional field
 * works in both worlds and cannot be read as a crash.
 */
export interface GenerationResult {
  /** Set when the card could not be built. `fixtures` is empty when it is. */
  error?: string;
  fixtures: Fixture[];
  stats: GenerationStats;
}

export interface GenerateOptions {
  division: string;
  /** Player names, unique. Order is the roster order and only breaks ties. */
  players: string[];
  /** The courts this division has been allocated, by name. */
  courts: string[];
  rounds: number;
  /** Same seed, same card. Bump it to regenerate. */
  seed?: number;
}

/** Players per court in doubles. */
const SEATS_PER_COURT = 4;
// Objective 1 outranks objective 4, so a repeated partnership has to cost
// more than any amount of opponent shuffling can offset. At 10:1 the local
// search stalled: breaking a repeat created enough fresh opponent pairs to
// cancel the gain, and the card kept a duplicate while ten pairings sat
// unused. Two orders of magnitude makes the priority absolute.
const PARTNER_WEIGHT = 100;
const OPPONENT_WEIGHT = 1;
const IMPROVEMENT_ITERATIONS = 400;

/** mulberry32: small, fast, good enough, and reproducible across machines. */
const makeRng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** One court in one round, as player indices. */
interface Seat {
  court: number;
  teamA: [number, number];
  teamB: [number, number];
}
type Schedule = Seat[][];

interface Counts {
  partner: number[][];
  opponent: number[][];
  matches: number[];
}

const zeroMatrix = (n: number): number[][] =>
  Array.from({ length: n }, () => new Array<number>(n).fill(0));

const recount = (schedule: Schedule, n: number): Counts => {
  const partner = zeroMatrix(n);
  const opponent = zeroMatrix(n);
  const matches = new Array<number>(n).fill(0);
  for (const round of schedule) {
    for (const seat of round) {
      const [a1, a2] = seat.teamA;
      const [b1, b2] = seat.teamB;
      partner[a1][a2]++;
      partner[a2][a1]++;
      partner[b1][b2]++;
      partner[b2][b1]++;
      for (const a of seat.teamA) {
        for (const b of seat.teamB) {
          opponent[a][b]++;
          opponent[b][a]++;
        }
      }
      for (const p of [a1, a2, b1, b2]) matches[p]++;
    }
  }
  return { partner, opponent, matches };
};

/** The three ways to split four players into two pairs. */
const SPLITS: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

/**
 * Marginal cost of seating these four as a given split, under the squared
 * objective: adding the (k+1)th use of a pairing costs 2k+1.
 */
const splitCost = (
  four: number[],
  split: [number, number, number, number],
  counts: Counts,
): number => {
  const [ia, ib, ic, id] = split;
  const a1 = four[ia];
  const a2 = four[ib];
  const b1 = four[ic];
  const b2 = four[id];
  let cost =
    (2 * counts.partner[a1][a2] + 1) * PARTNER_WEIGHT +
    (2 * counts.partner[b1][b2] + 1) * PARTNER_WEIGHT;
  for (const a of [a1, a2]) {
    for (const b of [b1, b2]) {
      cost += (2 * counts.opponent[a][b] + 1) * OPPONENT_WEIGHT;
    }
  }
  return cost;
};

const bestSeat = (
  four: number[],
  court: number,
  counts: Counts,
  rng: () => number,
): Seat => {
  let best = SPLITS[0];
  let bestCost = Number.POSITIVE_INFINITY;
  for (const split of SPLITS) {
    // Jitter breaks ties without changing the ordering of real differences,
    // so "Regenerate" gives a genuinely different card on a new seed.
    const cost = splitCost(four, split, counts) + rng() * 0.5;
    if (cost < bestCost) {
      bestCost = cost;
      best = split;
    }
  }
  const [ia, ib, ic, id] = best;
  return {
    court,
    teamA: [four[ia], four[ib]],
    teamB: [four[ic], four[id]],
  };
};

const applySeat = (seat: Seat, counts: Counts): void => {
  const [a1, a2] = seat.teamA;
  const [b1, b2] = seat.teamB;
  counts.partner[a1][a2]++;
  counts.partner[a2][a1]++;
  counts.partner[b1][b2]++;
  counts.partner[b2][b1]++;
  for (const a of seat.teamA) {
    for (const b of seat.teamB) {
      counts.opponent[a][b]++;
      counts.opponent[b][a]++;
    }
  }
  for (const p of [a1, a2, b1, b2]) counts.matches[p]++;
};

const failure = (error: string): GenerationResult => ({
  error,
  fixtures: [],
  stats: {
    partnerCoverage: {},
    byes: {},
    matchesPerPlayer: {},
    warnings: [],
  },
});

export const generateFixtures = (
  options: GenerateOptions,
): GenerationResult => {
  const { division, players, courts, rounds, seed = 1 } = options;
  const n = players.length;
  const courtCount = courts.length;

  if (n < SEATS_PER_COURT) {
    return failure(`${division} has ${n} ${n === 1 ? "player" : "players"}. Doubles needs at least 4.`);
  }
  if (new Set(players).size !== n) {
    return failure(`${division} has two players with the same name. Names must be unique, because the Matches sheet stores names rather than IDs.`);
  }
  if (courtCount < 1) {
    return failure(`${division} has no court allocated.`);
  }
  if (rounds < 1) {
    return failure(`${division} needs at least one round.`);
  }

  const seats = SEATS_PER_COURT * courtCount;
  if (seats > n) {
    return failure(`${division} has ${n} players but ${courtCount} courts need ${seats}. Give it fewer courts.`);
  }

  const rng = makeRng(seed);
  const indices = Array.from({ length: n }, (_, i) => i);

  const counts: Counts = {
    partner: zeroMatrix(n),
    opponent: zeroMatrix(n),
    matches: new Array<number>(n).fill(0),
  };
  const byeCount = new Array<number>(n).fill(0);
  // 0 means "has never sat out", which sorts last and so takes the next bye.
  const lastByeRound = new Array<number>(n).fill(0);

  const schedule: Schedule = [];

  for (let round = 1; round <= rounds; round++) {
    const jitter = indices.map(() => rng());
    const order = indices.slice().sort((a, b) => {
      // Fewest matches plays first; that alone spreads byes, because
      // matches + byes is the same number for everyone at this point.
      if (counts.matches[a] !== counts.matches[b]) {
        return counts.matches[a] - counts.matches[b];
      }
      // Then whoever sat out most recently, so a bye is not followed by
      // another one. Never-byed players hold 0 and sort last, which is
      // what sends them the next bye.
      if (lastByeRound[a] !== lastByeRound[b]) {
        return lastByeRound[b] - lastByeRound[a];
      }
      if (byeCount[a] !== byeCount[b]) return byeCount[b] - byeCount[a];
      return jitter[a] - jitter[b];
    });

    const seated = order.slice(0, seats);
    for (const p of order.slice(seats)) {
      byeCount[p]++;
      lastByeRound[p] = round;
    }

    const roundSeats: Seat[] = [];
    for (let c = 0; c < courtCount; c++) {
      const four = seated.slice(c * SEATS_PER_COURT, (c + 1) * SEATS_PER_COURT);
      const seat = bestSeat(four, c, counts, rng);
      applySeat(seat, counts);
      roundSeats.push(seat);
    }
    schedule.push(roundSeats);
  }

  improve(schedule, n, rng);

  return {
    fixtures: toFixtures(schedule, players, courts, division),
    stats: buildStats(schedule, players, rounds, courtCount),
  };
};

/**
 * The card scored on the spec's objectives, in the spec's order. Compared
 * lexicographically, so a later objective can never outvote an earlier one.
 *
 * Match spread is deliberately absent: matches + byes is the same number for
 * every player, so match spread and bye spread are always equal. Scoring
 * both would just be scoring one of them twice.
 */
interface Score {
  /** Objective 1. Total pairings used more than once, which is zero until
   *  every distinct pair has been spent. */
  repeats: number;
  /** Objective 2 (and 5, which is the same number). */
  byeSpread: number;
  /** Objective 3. */
  backToBack: number;
  /** Objective 4. Squared, so opponents spread rather than concentrate. */
  opponent: number;
}

const playingGrid = (schedule: Schedule, n: number): boolean[][] => {
  const grid = Array.from({ length: n }, () =>
    new Array<boolean>(schedule.length).fill(false),
  );
  schedule.forEach((round, r) => {
    for (const seat of round) {
      for (const p of [...seat.teamA, ...seat.teamB]) grid[p][r] = true;
    }
  });
  return grid;
};

const scoreOf = (schedule: Schedule, n: number): Score => {
  const counts = recount(schedule, n);
  let repeats = 0;
  let opponent = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      repeats += Math.max(0, counts.partner[i][j] - 1);
      opponent += counts.opponent[i][j] ** 2;
    }
  }

  const grid = playingGrid(schedule, n);
  const byes = grid.map((row) => row.filter((played) => !played).length);
  let backToBack = 0;
  for (let i = 0; i < n; i++) {
    for (let r = 1; r < schedule.length; r++) {
      if (!grid[i][r - 1] && !grid[i][r]) backToBack++;
    }
  }

  return {
    repeats,
    byeSpread: Math.max(...byes) - Math.min(...byes),
    backToBack,
    opponent,
  };
};

/**
 * Byes, and therefore match counts, may never spread by more than one.
 *
 * The spec lists balanced match counts last, but states it as a bound ("max
 * and min differ by at most 1") rather than as something to minimise. Read
 * as a ranked objective it loses to partner variety and the generator will
 * cheerfully hand someone two games fewer than everyone else to break a
 * duplicate pairing. Players count their own games, so this is a floor the
 * ranking sits on top of, not a rung in it.
 */
const MAX_SPREAD = 1;

/** Strictly better on the first objective that differs, inside the bound. */
const better = (next: Score, current: Score): boolean => {
  const nextFeasible = next.byeSpread <= MAX_SPREAD;
  const currentFeasible = current.byeSpread <= MAX_SPREAD;
  if (nextFeasible !== currentFeasible) return nextFeasible;

  if (next.repeats !== current.repeats) return next.repeats < current.repeats;
  if (next.byeSpread !== current.byeSpread) {
    return next.byeSpread < current.byeSpread;
  }
  if (next.backToBack !== current.backToBack) {
    return next.backToBack < current.backToBack;
  }
  return next.opponent < current.opponent;
};

/**
 * Local improvement over the greedy card. Two moves:
 *
 *   - swap a player between two courts in the same round
 *   - swap a seated player with one sitting out that round
 *
 * The second move is the one that matters here. Seating is chosen purely on
 * fairness, which can put four players together whose pairings are already
 * spent while two fresh partners sit on the bench. Without this move a
 * single-court division has no lever at all, and single court is the real
 * configuration: three courts split across three divisions.
 *
 * Candidates are accepted on a lexicographic comparison of the spec's
 * objectives in the spec's order, so a swap may trade a back to back bye
 * away to break a repeated partnership (objective 1 outranks objective 3)
 * but never the reverse.
 */
const improve = (schedule: Schedule, n: number, rng: () => number): void => {
  const seatsPerRound = schedule[0]?.length ?? 0;
  if (seatsPerRound === 0) return;
  const hasBench = n > seatsPerRound * SEATS_PER_COURT;
  const hasSecondCourt = seatsPerRound >= 2;
  if (!hasBench && !hasSecondCourt) return;

  let current = scoreOf(schedule, n);

  const flat = (seat: Seat): number[] => [...seat.teamA, ...seat.teamB];

  for (let iter = 0; iter < IMPROVEMENT_ITERATIONS; iter++) {
    const r = Math.floor(rng() * schedule.length);
    const round = schedule[r];

    // Re-split the touched courts against the rest of the card, never
    // against their own previous contribution.
    const touched: number[] = [];
    const replacements: number[][] = [];

    const useBenchMove = hasBench && (!hasSecondCourt || rng() < 0.6);

    if (useBenchMove) {
      const seated = round.flatMap(flat);
      const bench = Array.from({ length: n }, (_, i) => i).filter(
        (i) => !seated.includes(i),
      );
      if (bench.length === 0) continue;
      const ci = Math.floor(rng() * round.length);
      const pi = Math.floor(rng() * SEATS_PER_COURT);
      const incoming = bench[Math.floor(rng() * bench.length)];
      const next = flat(round[ci]);
      next[pi] = incoming;
      touched.push(ci);
      replacements.push(next);
    } else {
      const ci = Math.floor(rng() * round.length);
      let cj = Math.floor(rng() * round.length);
      if (ci === cj) cj = (cj + 1) % round.length;
      if (ci === cj) continue;
      const fourI = flat(round[ci]);
      const fourJ = flat(round[cj]);
      const pi = Math.floor(rng() * SEATS_PER_COURT);
      const pj = Math.floor(rng() * SEATS_PER_COURT);
      const nextI = fourI.slice();
      const nextJ = fourJ.slice();
      [nextI[pi], nextJ[pj]] = [fourJ[pj], fourI[pi]];
      touched.push(ci, cj);
      replacements.push(nextI, nextJ);
    }

    const saved = touched.map((c) => round[c]);
    const without = recount(
      schedule.map((rd, idx) =>
        idx === r ? rd.filter((_, k) => !touched.includes(k)) : rd,
      ),
      n,
    );
    touched.forEach((c, k) => {
      const seat = bestSeat(replacements[k], round[c].court, without, rng);
      applySeat(seat, without);
      round[c] = seat;
    });

    const next = scoreOf(schedule, n);
    if (better(next, current)) {
      current = next;
    } else {
      touched.forEach((c, k) => {
        round[c] = saved[k];
      });
    }
  }
};

const toFixtures = (
  schedule: Schedule,
  players: string[],
  courts: string[],
  division: string,
): Fixture[] => {
  const fixtures: Fixture[] = [];
  schedule.forEach((round, i) => {
    for (const seat of round) {
      fixtures.push({
        division,
        round: i + 1,
        court: courts[seat.court],
        teamA: [players[seat.teamA[0]], players[seat.teamA[1]]],
        teamB: [players[seat.teamB[0]], players[seat.teamB[1]]],
      });
    }
  });
  return fixtures;
};

const buildStats = (
  schedule: Schedule,
  players: string[],
  rounds: number,
  courtCount: number,
): GenerationStats => {
  const n = players.length;
  const counts = recount(schedule, n);

  const partnerCoverage: Record<string, { used: number; possible: number }> = {};
  const matchesPerPlayer: Record<string, number> = {};
  const byes: Record<string, number> = {};

  const playedRounds: boolean[][] = Array.from({ length: n }, () =>
    new Array<boolean>(rounds).fill(false),
  );
  schedule.forEach((round, r) => {
    for (const seat of round) {
      for (const p of [...seat.teamA, ...seat.teamB]) playedRounds[p][r] = true;
    }
  });

  for (let i = 0; i < n; i++) {
    let used = 0;
    for (let j = 0; j < n; j++) if (i !== j && counts.partner[i][j] > 0) used++;
    partnerCoverage[players[i]] = { used, possible: n - 1 };
    matchesPerPlayer[players[i]] = counts.matches[i];
    byes[players[i]] = playedRounds[i].filter((played) => !played).length;
  }

  const warnings: string[] = [];

  const matchValues = Object.values(matchesPerPlayer);
  const spread = Math.max(...matchValues) - Math.min(...matchValues);
  if (spread > 1) {
    warnings.push(
      `Match counts differ by ${spread}. With ${n} players on ${courtCount} ${courtCount === 1 ? "court" : "courts"} over ${rounds} rounds they cannot be levelled further.`,
    );
  }

  const byeValues = Object.values(byes);
  const byeSpread = Math.max(...byeValues) - Math.min(...byeValues);
  if (byeSpread > 1) {
    warnings.push(`Byes differ by ${byeSpread} between players.`);
  }

  // Back to back byes, which the seating order avoids where it can.
  const doubled = players.filter((_, i) => {
    for (let r = 1; r < rounds; r++) {
      if (!playedRounds[i][r - 1] && !playedRounds[i][r]) return true;
    }
    return false;
  });
  if (doubled.length > 0) {
    warnings.push(
      `Sat out twice in a row: ${doubled.join(", ")}. Unavoidable at this roster size.`,
    );
  }

  // Partnerships only repeat once every distinct pair has been spent. Say so
  // with the arithmetic, so the screen reads as a ceiling, not a failure.
  const possiblePairs = (n * (n - 1)) / 2;
  const partnershipsNeeded = schedule.reduce((sum, r) => sum + r.length * 2, 0);
  if (partnershipsNeeded > possiblePairs) {
    warnings.push(
      `${partnershipsNeeded} partnerships over ${rounds} rounds but only ${possiblePairs} possible pairs, so ${partnershipsNeeded - possiblePairs} repeat.`,
    );
  }

  if (courtCount === 1 && n >= 9) {
    warnings.push(
      `${n} players on one court means roughly ${Math.floor((rounds * 4) / n)} matches each. Consider a second court.`,
    );
  }

  return { partnerCoverage, byes, matchesPerPlayer, warnings };
};

/**
 * How many matches each player gets for a given split, for the live preview
 * on the court allocation screen. Cheap enough to run on every tap.
 */
export const capacityPreview = (
  playerCount: number,
  courtCount: number,
  rounds: number,
): { matchesEach: number; sittingOut: number; viable: boolean } => {
  const seats = SEATS_PER_COURT * courtCount;
  if (playerCount < SEATS_PER_COURT || courtCount < 1 || seats > playerCount) {
    return { matchesEach: 0, sittingOut: Math.max(0, playerCount), viable: false };
  }
  return {
    matchesEach: Math.floor((rounds * seats) / playerCount),
    sittingOut: playerCount - seats,
    viable: true,
  };
};
