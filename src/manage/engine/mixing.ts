// The third law's arithmetic: how many second B games do the seats force?
//
// On 2026-09-10 the owner put the rule in one breath: "An A should not get
// more than one B game throughout the whole session, whether it's three
// games, four or five. They should never get more than one B game. I know
// the math is confusing, it's always a weird number, but this is highly
// important for our business." The picker in tiers.ts keeps that promise one
// four at a time, and this file is the part that lets it look ahead.
//
// A DEFICIT is the price of the rest of the night. Given who is still owed
// games on a court, it is the smallest total charge any lawful finish of
// those seats can carry, where an A's k-th game with the B's costs k-1: the
// first is free, the second costs one, the third two. Zero means the seats
// can still be finished with no A meeting the B's twice, and the picker
// takes that as a hard cap. A positive number means the seats force second
// games (six A's at four each and two B's need eight A-seats across the net
// and have only six), and the picker spends them as evenly as it can.
// Infinity means these seats cannot be finished exactly at all, which the
// picker treats as "no lookahead" rather than "no game".
//
// SLACK is the card's overshoot. A night of twenty-one at three each is
// sixty-three seats, and games come in fours, so one seat on the card goes
// to somebody already at target. Slack is that residue, (4 - Σowed mod 4)
// mod 4, and it is a walk-in's or a leaver's signature: a fresh court never
// has any. Without it every four dealt after a walk-in would be Infinity
// (the owed seats alone never fit) and the cap would be silently off for the
// rest of the night. With it the oracle hands the extra seats out by CLASS
// (which tier, how many B games for an A, bridge or not for a B) and takes
// the cheapest way, which is exactly what the picker is about to do anyway.
// Those invented seats fill the seat equations and nothing else: the law
// the court runs under is read off the OWED totals, because that is what
// lawfulFour reads, and deficit() says why at length.
//
// Pure. No clock, no log, no ids: the state is counts per player and the
// answer is a number, so the picker can memoise it by class and two courts,
// or the two instances of the manager, never see each other's.

import type { Tier } from "./tiers";

/** An A still on the court: games owed, and B games had so far this session. */
export interface MixingA { owed: number; bGames: number }
/** A B still on the court: games owed, and whether they ride with the C's. */
export interface MixingB { owed: number; bridge: boolean }
/** A C still on the court. */
export interface MixingC { owed: number }

export interface MixingState {
  as: readonly MixingA[];
  bs: readonly MixingB[];
  cs: readonly MixingC[];
  /**
   * "free" when the court's HEADCOUNT gives a lone A or a lone B, the way
   * LawContext.abLaw does. Otherwise strict against soft is not a fact about
   * the court but about what is still owed, and it is derived in here from
   * the parities the same way lawfulFour derives it draw by draw.
   */
  headcountLaw: "free" | "bound";
  /** Fewer than three C's on the court, so the C's play among the B's. */
  relaxed: boolean;
  /**
   * Seats the card fills with people already at target. Never negative on a
   * state that exists; a candidate four that seats an at-target player on a
   * court with no slack left produces slack -1, and that is Infinity here.
   */
  slack: number;
}

/**
 * One player as the picker sees them, for building a state from a queue.
 * `bGames` and `bridge` are read for the tiers they belong to and ignored
 * for the others.
 */
export interface Seat { tier: Tier; owed: number; bGames?: number; bridge?: boolean }

/** The slack a set of owed seats leaves on a card of fours. */
export const slackFor = (owedSeats: number): number => (4 - (owedSeats % 4)) % 4;

/**
 * A court's state from its people. Everyone on the court belongs in it,
 * at-target players included at owed 0: they are who the slack seats go to.
 */
export function stateOf(
  seats: readonly Seat[],
  headcountLaw: "free" | "bound",
  relaxed: boolean,
): MixingState {
  const as: MixingA[] = [];
  const bs: MixingB[] = [];
  const cs: MixingC[] = [];
  let owed = 0;
  for (const s of seats) {
    owed += s.owed;
    if (s.tier === "A") as.push({ owed: s.owed, bGames: s.bGames ?? 0 });
    else if (s.tier === "B") bs.push({ owed: s.owed, bridge: s.bridge ?? false });
    else cs.push({ owed: s.owed });
  }
  return { as, bs, cs, headcountLaw, relaxed, slack: slackFor(owed) };
}

const sumOwed = (xs: readonly { owed: number }[]) => xs.reduce((n, x) => n + x.owed, 0);

/**
 * The smallest total charge any lawful finish of these seats carries.
 * 0 when no A need meet the B's a second time, k when the seats force
 * charges adding to k, Infinity when the seats cannot be finished exactly.
 */
export function deficit(state: MixingState): number {
  if (state.slack < 0) return Infinity;
  // The regime the picker will actually run under, read off the OWED totals
  // and nothing else. lawfulFour derives strict against soft from exactly
  // these two parities, and a game only ever moves them by the number of
  // OWED players it seats: a seat spent by somebody already at target
  // leaves them where they were, because owed is clamped at zero. So the
  // padding below must not be allowed to flip them. It used to: handing one
  // slack seat to an A and one to a B made both totals odd, the counting
  // read soft off the padded state and priced a (1,3) game the live court
  // would have called sidesUnequal. That is where the cap came off after a
  // walk-in on a court with beginners (2026-09-11).
  //
  // A slack seat CAN flip a parity for real, once the at-target player who
  // spends it walks on, and a finish that plays one early is sometimes
  // cheaper than anything counted here. This takes the pessimistic reading
  // anyway. The picker follows this number one draw at a time, so what it
  // must never do is promise a finish the next draw cannot deliver: a
  // price of zero is read as a hard cap. Counting the slack turns as
  // available was measured on the walk-in and leaver sweep and put the cap
  // back off on fifteen of 2,244 nights, where refusing them breaks none.
  const law = { headcountLaw: state.headcountLaw, relaxed: state.relaxed,
                pa: sumOwed(state.as) % 2, pb: sumOwed(state.bs) % 2, slackOnC: 0 };
  if (state.slack === 0) return exact(state.as, state.bs, state.cs, law);

  // The slack seats go out by class, each to the member of that class with
  // the fewest seats already (an at-target player of the class when there
  // is one, else the least owed). Within a class every member has the same
  // caps and the same price, so the level hand-out is never worse than a
  // lopsided one, and the search is over class multisets only.
  type Cls = { tier: "A"; bGames: number } | { tier: "B"; bridge: boolean } | { tier: "C" };
  const classes: Cls[] = [];
  for (const bGames of new Set(state.as.map((a) => a.bGames))) classes.push({ tier: "A", bGames });
  for (const bridge of new Set(state.bs.map((b) => b.bridge))) classes.push({ tier: "B", bridge });
  if (state.cs.length > 0) classes.push({ tier: "C" });
  if (classes.length === 0) return Infinity;

  let best = Infinity;
  const counts = new Array<number>(classes.length).fill(0);
  const walk = (index: number, left: number): void => {
    if (best === 0) return;
    if (index === classes.length - 1) {
      counts[index] = left;
      let as = state.as;
      let bs = state.bs;
      let cs = state.cs;
      classes.forEach((cls, c) => {
        if (counts[c] === 0) return;
        if (cls.tier === "A") as = padded(as, (a) => a.bGames === cls.bGames, counts[c]);
        else if (cls.tier === "B") bs = padded(bs, (b) => b.bridge === cls.bridge, counts[c]);
        else cs = padded(cs, () => true, counts[c]);
      });
      // The same reading for the C games that turn the B parity over. One
      // of them seats a single B, and it only moves the live court if that
      // B is OWED a game. A slack seat handed to the B who rides with the
      // beginners can fill one of those seats instead, so that many of
      // them are assumed not to count.
      let slackOnC = 0;
      classes.forEach((cls, c) => {
        if (cls.tier !== "B") return;
        if (state.relaxed || cls.bridge) slackOnC += counts[c];
      });
      best = Math.min(best, exact(as, bs, cs, { ...law, slackOnC }));
      return;
    }
    for (let n = left; n >= 0; n--) {
      counts[index] = n;
      walk(index + 1, left - n);
    }
  };
  walk(0, state.slack);
  return best;
}

/** A copy with n seats handed to the members matching `of`, least owed first. */
function padded<T extends { owed: number }>(xs: readonly T[], of: (x: T) => boolean, n: number): T[] {
  const out = xs.map((x) => ({ ...x }));
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < out.length; i++) {
      if (of(out[i]) && (pick < 0 || out[i].owed < out[pick].owed)) pick = i;
    }
    if (pick < 0) break;
    out[pick].owed += 1;
  }
  return out;
}

/**
 * The counting itself: every way to cut the owed seats into lawful shapes,
 * the cheapest one wins.
 *
 * Seats per game as (A, B, C): pure A (4,0,0) and pure B (0,4,0); the mixed
 * shapes (2,2,0), (1,3,0) and, under the free law only, (3,1,0); the C
 * shapes, which on a court with three C's or more are (0,0,4) and (0,1,3)
 * with the bridge in the one B seat, and on a relaxed court are (0,3,1) and
 * (0,2,2) with any B's. The mixed and C counts are enumerated; the pure
 * counts follow from the seat totals and have to come out whole.
 */
function exact(
  as: readonly MixingA[],
  bs: readonly MixingB[],
  cs: readonly MixingC[],
  law: { headcountLaw: "free" | "bound"; relaxed: boolean; pa: number; pb: number;
         slackOnC: number },
): number {
  const SA = sumOwed(as);
  const SB = sumOwed(bs);
  const SC = sumOwed(cs);
  if ((SA + SB + SC) % 4 !== 0) return Infinity;
  const free = law.headcountLaw === "free";
  const hasBridge = bs.some((b) => b.bridge);
  // The live court's parities, handed down from deficit(). Not SA % 2 and
  // SB % 2: those count the slack seats, which the law never sees.
  const { pa, pb } = law;

  // The C shapes first. Each choice fixes how many B seats the C games take,
  // how many of those games flip the B parity (an odd number of B seats),
  // and the per-B cap on C-game seats.
  const cShapes: { bSeats: number; flips: number; capFor: (b: MixingB) => number; games: number }[] = [];
  if (!law.relaxed) {
    for (let q = 0; 3 * q <= SC; q++) {
      if ((SC - 3 * q) % 4 !== 0) continue;
      if (q > 0 && !hasBridge) continue;
      const p = (SC - 3 * q) / 4;
      if (cs.some((c) => c.owed > p + q)) continue;
      cShapes.push({ bSeats: q, flips: q, capFor: (b) => (b.bridge ? q : 0), games: p + q });
    }
  } else {
    for (let r2 = 0; 2 * r2 <= SC; r2++) {
      const r1 = SC - 2 * r2;
      if (cs.some((c) => c.owed > r1 + r2)) continue;
      cShapes.push({ bSeats: 3 * r1 + 2 * r2, flips: r1, capFor: () => r1 + r2, games: r1 + r2 });
    }
  }

  let best = Infinity;
  for (const shape of cShapes) {
    const SBm = SB - shape.bSeats;
    if (SBm < 0) continue;
    // The parity automaton for the (1,3) shape. A strict court (both owed
    // totals even) never deals one and nothing without a flip gets it out
    // of strict; a soft court with both totals odd deals exactly one and
    // lands in strict; any flip, or the free law, leaves the count open.
    // A flip is a C game whose one B seat is filled by a B who is OWED the
    // game, so the slack seats handed to those B's come off the count.
    const flips = Math.max(0, shape.flips - law.slackOnC);
    const m13Max = free || flips > 0 || pa !== pb ? SA
      : pa === 0 ? 0 : 1;
    const m31Max = free ? Math.floor(SA / 3) : 0;
    for (let m31 = 0; m31 <= m31Max; m31++) {
      for (let m13 = 0; m13 <= Math.min(m13Max, SA - 3 * m31, Math.floor(SBm / 3)); m13++) {
        for (let m22 = 0; 2 * m22 + m13 + 3 * m31 <= SA; m22++) {
          const MA = 2 * m22 + m13 + 3 * m31;
          const MB = 2 * m22 + 3 * m13 + m31;
          if ((SA - MA) % 4 !== 0 || SBm < MB || (SBm - MB) % 4 !== 0) continue;
          const nA = (SA - MA) / 4;
          const nB = (SBm - MB) / 4;
          const mtot = m22 + m13 + m31;
          const charge = aSide(as, nA, mtot, MA);
          if (charge >= best) continue;
          if (!bSide(bs, nB, mtot, MB, shape.capFor, shape.bSeats)) continue;
          best = charge;
          if (best === 0) return 0;
        }
      }
    }
  }
  return best;
}

/**
 * Can the A's take MA mixed seats and the rest pure, and at what charge?
 *
 * Each A needs at least owed - nA mixed seats (a pure game holds them once)
 * and can take at most min(owed, mtot). Totals plus those per-player caps
 * are enough: a 4-uniform multi-hypergraph with every degree at most nA and
 * degrees summing to 4nA exists, and the mixed shapes' A-columns are small
 * enough that the same holds for them. The charge assigns the forced seats
 * first, then the rest one at a time to whoever's next seat is cheapest,
 * which for a convex price is the optimum. Infinity when the seats do not
 * fit.
 */
function aSide(as: readonly MixingA[], nA: number, mtot: number, MA: number): number {
  let needed = 0;
  let possible = 0;
  let charge = 0;
  let top = 0;
  for (const a of as) {
    const need = Math.max(0, a.owed - nA);
    const can = Math.min(a.owed, mtot);
    if (need > can) return Infinity;
    needed += need;
    possible += can;
    charge += need * a.bGames + (need * (need - 1)) / 2;
    top = Math.max(top, a.bGames + can);
  }
  if (needed > MA || MA > possible) return Infinity;
  // Water-filling: at price L every A whose next seat costs L takes one,
  // and an A's next seat costs its count plus the seats already given.
  let left = MA - needed;
  for (let price = 0; left > 0 && price < top; price++) {
    let takers = 0;
    for (const a of as) {
      const need = Math.max(0, a.owed - nA);
      const can = Math.min(a.owed, mtot);
      if (a.bGames + need <= price && price < a.bGames + can) takers++;
    }
    const take = Math.min(left, takers);
    charge += take * price;
    left -= take;
  }
  return left === 0 ? charge : Infinity;
}

/**
 * Can the B's fill their pure, mixed and C-game seats exactly?
 *
 * A transportation problem with three types of seat, answered by its
 * min-cut: for every non-empty set S of types, the B's capacity into S,
 * Σ_b min(owed_b, Σ_{t∈S} cap_{b,t}), must cover the seats in S. Seven
 * inequalities, no flow needed.
 */
function bSide(
  bs: readonly MixingB[],
  nB: number,
  mtot: number,
  MB: number,
  capC: (b: MixingB) => number,
  cSeats: number,
): boolean {
  const seats = [4 * nB, MB, cSeats];
  for (let S = 1; S < 8; S++) {
    let demand = 0;
    for (let t = 0; t < 3; t++) if (S & (1 << t)) demand += seats[t];
    if (demand === 0) continue;
    let supply = 0;
    for (const b of bs) {
      let cap = 0;
      if (S & 1) cap += nB;
      if (S & 2) cap += mtot;
      if (S & 4) cap += capC(b);
      supply += Math.min(b.owed, cap);
      if (supply >= demand) break;
    }
    if (supply < demand) return false;
  }
  return true;
}
