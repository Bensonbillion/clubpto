// Court Manager v2 — round-based Wednesday scheduler (COURT-MANAGER.md §6).
//
// Pure functions: (pairs, config, history) → schedule. No React, no I/O.
//
// The structural guarantee this module exists for: after any completed round,
// every pair has identical game counts (± disclosed byes). Rounds are solved
// one at a time as a perfect matching of all pairs, honoring tier budgets and
// no-repeat constraints, with byes rotating on odd pair counts.

import type { MatchupType, Pair, RoundGame, RoundScheduleResult, Tier } from "../types";
import { matchupType } from "../types";

export interface RoundGenConfig {
  /** Total round-robin rounds for the session (Wednesday: 4). */
  rounds: number;
  /** Leading rounds restricted to same-tier games (base plan: 2). */
  sameTierRounds: number;
  courts: number;
  /** Deterministic seed so the sim suite is reproducible. */
  seed?: number;
}

interface TierBudget {
  A: number;
  B: number;
  C: number;
}

type Budgets = Record<string, TierBudget>;

function cloneBudgets(b: Budgets): Budgets {
  const out: Budgets = {};
  for (const [id, t] of Object.entries(b)) out[id] = { ...t };
  return out;
}

// --- seeded RNG (mulberry32) — Math.random is banned in pure scheduling code
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function matchKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ---------------------------------------------------------------------------
// Tier budgets (§6 targets, adapted to actual tier counts)
// ---------------------------------------------------------------------------

/**
 * Per-pair opponent budgets for R rounds. Base plan (R=4):
 * A: 3vA+1vB · B: 2vB+1vA+1vC · C: 3vC+1vB. A never faces C.
 * Adaptive: same-tier budgets cap at pairsInTier-1 (no repeats possible past
 * that); overflow bridges through B. Cross totals are reconciled so both sides
 * of AB / BC agree.
 */
export function computeTierBudgets(pairs: Pair[], rounds: number): { budgets: Budgets; disclosures: string[] } {
  const byTier: Record<Tier, Pair[]> = { A: [], B: [], C: [] };
  for (const p of pairs) byTier[p.tier].push(p);
  const n = { A: byTier.A.length, B: byTier.B.length, C: byTier.C.length };
  const disclosures: string[] = [];

  // Base per-pair targets.
  const base: Record<Tier, TierBudget> = {
    A: { A: rounds - 1, B: n.A > 0 && n.B > 0 ? 1 : 0, C: 0 },
    B: { A: n.B > 0 && n.A > 0 ? 1 : 0, B: rounds - 2, C: n.B > 0 && n.C > 0 ? 1 : 0 },
    C: { A: 0, B: n.C > 0 && n.B > 0 ? 1 : 0, C: rounds - 1 },
  };
  // Keep each pair's total at `rounds` when a cross budget is zeroed out.
  base.A.A = rounds - base.A.B;
  base.C.C = rounds - base.C.B;
  base.B.B = rounds - base.B.A - base.B.C;

  // Cap same-tier budgets at unique-opponent limits, bridge overflow via B.
  for (const t of ["A", "C"] as Tier[]) {
    const cap = Math.max(0, n[t] - 1);
    if (base[t][t] > cap) {
      const overflow = base[t][t] - cap;
      base[t][t] = cap;
      base[t].B += overflow;
      if (n[t] > 0) {
        disclosures.push(
          `${t} tier: ${n[t]} pairs — max ${cap} same-tier games each without repeats; ${overflow} extra game(s) bridge through B.`,
        );
      }
    }
  }
  const capB = Math.max(0, n.B - 1);
  if (base.B.B > capB) {
    const overflow = base.B.B - capB;
    base.B.B = capB;
    // B overflow splits toward whichever side exists.
    if (n.A > 0) base.B.A += Math.ceil(overflow / (n.C > 0 ? 2 : 1));
    if (n.C > 0) base.B.C += Math.floor(overflow / (n.A > 0 ? 2 : 1)) || (n.A > 0 ? 0 : overflow);
    if (n.B > 0) disclosures.push(`B tier: ${n.B} pairs — max ${capB} same-tier games each without repeats.`);
  }

  // Reconcile cross-tier totals (both sides of AB and BC must agree).
  const reconcile = (side1: Tier, side2: Tier) => {
    const want1 = base[side1][side2] * n[side1];
    const want2 = base[side2][side1] * n[side2];
    if (want1 === want2) return;
    // Shrink the larger side's per-pair budget toward agreement; the slack is
    // absorbed by the matcher's relaxation (budgets are priorities, the hard
    // constraints are no-repeat / no-AC / perfect matching).
    if (want1 > want2 && n[side1] > 0) base[side1][side2] = Math.max(0, Math.floor(want2 / n[side1]));
    if (want2 > want1 && n[side2] > 0) base[side2][side1] = Math.max(0, Math.floor(want1 / n[side2]));
  };
  reconcile("A", "B");
  reconcile("B", "C");

  const budgets: Budgets = {};
  for (const p of pairs) budgets[p.id] = { ...base[p.tier] };
  return { budgets, disclosures };
}

// ---------------------------------------------------------------------------
// Per-round perfect matching (backtracking, most-constrained-first)
// ---------------------------------------------------------------------------

interface MatchAttemptOpts {
  sameTierOnly: boolean;
  requireBudget: boolean;
  allowRematch: boolean;
}

function eligibleOpponents(
  p: Pair,
  candidates: Pair[],
  history: Set<string>,
  budgets: Budgets,
  opts: MatchAttemptOpts,
): Pair[] {
  return candidates.filter((q) => {
    if (q.id === p.id) return false;
    if (matchupType(p.tier, q.tier) === null) return false; // A never faces C
    if (opts.sameTierOnly && p.tier !== q.tier) return false;
    if (!opts.allowRematch && history.has(matchKey(p.id, q.id))) return false;
    if (opts.requireBudget && (budgets[p.id][q.tier] <= 0 || budgets[q.id][p.tier] <= 0)) return false;
    return true;
  });
}

function backtrackMatch(
  unmatched: Pair[],
  history: Set<string>,
  budgets: Budgets,
  opts: MatchAttemptOpts,
  rng: () => number,
  boundary: Set<string>,
): [Pair, Pair][] | null {
  if (unmatched.length === 0) return [];

  // Most-constrained pair first.
  let pick: Pair | null = null;
  let pickElig: Pair[] = [];
  for (const p of unmatched) {
    const elig = eligibleOpponents(p, unmatched, history, budgets, opts);
    if (elig.length === 0) return null; // dead end — fail fast
    if (pick === null || elig.length < pickElig.length) {
      pick = p;
      pickElig = elig;
    }
  }
  const p = pick as Pair;

  // Prefer opponents that burn the most remaining budget; keep previous-final-
  // slot pairs together (games fully inside or outside that set can open the
  // next round cleanly); shuffle equal scores.
  const scoredCandidates = shuffled(pickElig, rng)
    .map((q) => ({
      q,
      score:
        budgets[p.id][q.tier] +
        budgets[q.id][p.tier] +
        (boundary.has(p.id) === boundary.has(q.id) ? 3 : 0) +
        (history.has(matchKey(p.id, q.id)) ? -10 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  for (const { q } of scoredCandidates) {
    const rest = unmatched.filter((x) => x.id !== p.id && x.id !== q.id);
    budgets[p.id][q.tier]--;
    budgets[q.id][p.tier]--;
    const sub = backtrackMatch(rest, history, budgets, opts, rng, boundary);
    if (sub !== null) return [[p, q], ...sub];
    budgets[p.id][q.tier]++;
    budgets[q.id][p.tier]++;
  }
  return null;
}

/** One round: perfect matching over `active` pairs. Relaxes in stages, never past A-vs-C. */
function matchRound(
  active: Pair[],
  roundIndex: number,
  history: Set<string>,
  budgets: Budgets,
  config: RoundGenConfig,
  rng: () => number,
  boundary: Set<string>,
): { pairs: [Pair, Pair][]; usedRematch: boolean; usedCrossInSameTierRound: boolean } | null {
  const sameTierRound = roundIndex <= config.sameTierRounds;
  const stages: MatchAttemptOpts[] = [
    { sameTierOnly: sameTierRound, requireBudget: true, allowRematch: false },
    { sameTierOnly: sameTierRound, requireBudget: false, allowRematch: false },
    ...(sameTierRound ? [{ sameTierOnly: false, requireBudget: false, allowRematch: false } as MatchAttemptOpts] : []),
    { sameTierOnly: false, requireBudget: false, allowRematch: true },
  ];

  for (const stage of stages) {
    const restarts = 40;
    let bestResult: [Pair, Pair][] | null = null;
    let bestBudgets: Budgets | null = null;
    let bestRematches = Infinity;
    for (let attempt = 0; attempt < restarts; attempt++) {
      const attemptBudgets = cloneBudgets(budgets);
      const result = backtrackMatch(active, history, attemptBudgets, stage, rng, boundary);
      if (result === null) continue;
      if (!stage.allowRematch) {
        bestResult = result;
        bestBudgets = attemptBudgets;
        break; // rematch-free matchings are equal quality — first success wins
      }
      // Rematch stage: keep searching for the matching with the FEWEST rematches.
      const rematches = result.filter(([a, b]) => history.has(matchKey(a.id, b.id))).length;
      if (rematches < bestRematches) {
        bestRematches = rematches;
        bestResult = result;
        bestBudgets = attemptBudgets;
        if (rematches === 0) break;
      }
    }
    if (bestResult && bestBudgets) {
      for (const id of Object.keys(budgets)) budgets[id] = bestBudgets[id];
      return {
        pairs: bestResult,
        usedRematch: bestResult.some(([a, b]) => history.has(matchKey(a.id, b.id))),
        usedCrossInSameTierRound: sameTierRound && bestResult.some(([a, b]) => a.tier !== b.tier),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Within-round ordering across courts × slots (§6.2)
// ---------------------------------------------------------------------------

/**
 * Assign a round's games to courts × slots so that no pair sitting in the
 * previous round's final slot plays in this round's first slot. Returns the
 * count of unavoidable slot-1 boundary clashes so the caller can retry the
 * round MATCHING (which has the freedom ordering lacks) until clean.
 */
function orderRound(
  roundIndex: number,
  matches: [Pair, Pair][],
  courts: number,
  prevLastSlotPairIds: Set<string>,
  rng: () => number,
): { games: RoundGame[]; boundaryClashes: number } {
  const slots = Math.ceil(matches.length / courts);
  const pool = shuffled(matches, rng);

  // First slot: games with no overlap with the previous round's last slot.
  const clean = pool.filter(([a, b]) => !prevLastSlotPairIds.has(a.id) && !prevLastSlotPairIds.has(b.id));
  const dirty = pool.filter((m) => !clean.includes(m));
  const ordered = [...clean, ...dirty]; // clean games fill early slots first

  const firstSlotCount = Math.min(courts, ordered.length);
  const boundaryClashes = Math.max(0, firstSlotCount - clean.length);

  const games: RoundGame[] = [];
  let n = 0;
  for (let slot = 1; slot <= slots; slot++) {
    for (let court = 1; court <= courts && n < ordered.length; court++, n++) {
      const [a, b] = ordered[n];
      const clash = slot === 1 && (prevLastSlotPairIds.has(a.id) || prevLastSlotPairIds.has(b.id));
      games.push({
        id: `r${roundIndex}g${n + 1}`,
        round: roundIndex,
        court,
        slot,
        pairIds: [a.id, b.id],
        type: matchupType(a.tier, b.tier) as MatchupType,
        ...(clash ? { boundaryClash: true } : {}),
      });
    }
  }
  return { games, boundaryClashes };
}

function lastSlotPairIds(roundGames: RoundGame[]): Set<string> {
  if (roundGames.length === 0) return new Set();
  const maxSlot = Math.max(...roundGames.map((g) => g.slot));
  return new Set(roundGames.filter((g) => g.slot === maxSlot).flatMap((g) => g.pairIds));
}

// ---------------------------------------------------------------------------
// Session generation
// ---------------------------------------------------------------------------

export function generateRoundSchedule(pairs: Pair[], config: RoundGenConfig): RoundScheduleResult {
  return regenerateFromRound(pairs, [], {}, config);
}

/**
 * Generate (or re-generate) rounds after `completedRounds`. This is the single
 * entry point for fresh sessions, late arrivals joining at a round boundary,
 * and mid-session removals: pass the pairs as they are NOW and the rounds that
 * are already played/locked; the rest of the session is solved from there.
 * Completed rounds are returned untouched — completed data is sacred (§13).
 */
export function regenerateFromRound(
  pairs: Pair[],
  completedRounds: RoundGame[][],
  completedByes: Record<number, string[]>,
  config: RoundGenConfig,
): RoundScheduleResult {
  const rng = makeRng(config.seed ?? 1);
  const disclosuresSet = new Set<string>();
  const byId = new Map(pairs.map((p) => [p.id, p]));

  const computed = computeTierBudgets(pairs, config.rounds);
  let budgets = computed.budgets;
  computed.disclosures.forEach((d) => disclosuresSet.add(d));

  // Seed history / counts / budgets from completed rounds.
  const history = new Set<string>();
  const gamesPlayed = new Map<string, number>(pairs.map((p) => [p.id, 0]));
  const byeCounts = new Map<string, number>(pairs.map((p) => [p.id, 0]));
  for (const round of completedRounds) {
    for (const g of round) {
      history.add(matchKey(g.pairIds[0], g.pairIds[1]));
      for (const id of g.pairIds) {
        gamesPlayed.set(id, (gamesPlayed.get(id) ?? 0) + 1);
        const pair = byId.get(id);
        const opp = byId.get(g.pairIds[0] === id ? g.pairIds[1] : g.pairIds[0]);
        if (pair && opp && budgets[pair.id]) budgets[pair.id][opp.tier]--;
      }
    }
  }
  for (const ids of Object.values(completedByes)) {
    for (const id of ids) byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
  }

  const rounds: RoundGame[][] = completedRounds.map((r) => [...r]);
  const byes: Record<number, string[]> = { ...completedByes };
  let prevLast = lastSlotPairIds(rounds[rounds.length - 1] ?? []);

  if (pairs.length % 2 === 1) {
    const remaining = config.rounds - rounds.length;
    const withFull = pairs.length - 1;
    disclosuresSet.add(
      `${pairs.length} pairs: one pair sits out each round — ${withFull} pairs finish with ${config.rounds} games, byes finish with fewer. Disclosed upfront, rotated fairly.`,
    );
    void remaining;
  }

  for (let r = rounds.length + 1; r <= config.rounds; r++) {
    // Bye fairness: only pairs with the fewest byes so far are candidates,
    // preferring those with the most games played. WHICH candidate sits is a
    // degree of freedom the retry loop uses to keep the round boundary clean.
    const needBye = pairs.length % 2 === 1;
    const byeCandidates = needBye
      ? shuffled(pairs, rng)
          .filter((p) => (byeCounts.get(p.id) ?? 0) === Math.min(...pairs.map((x) => byeCounts.get(x.id) ?? 0)))
          .sort((a, b) => (gamesPlayed.get(b.id) ?? 0) - (gamesPlayed.get(a.id) ?? 0))
      : [];

    // Matching, ordering, and the bye choice interact: only the matcher (and
    // bye pick) can guarantee enough games free of the previous round's
    // final-slot pairs. Retry until the boundary is clean, or accept the
    // least-bad after 40 tries and flag it loudly.
    let best: {
      games: RoundGame[];
      clashes: number;
      budgets: Budgets;
      usedRematch: boolean;
      usedCross: boolean;
      byeId?: string;
    } | null = null;
    for (let attempt = 0; attempt < 40 && (!best || best.clashes > 0); attempt++) {
      const byeId = needBye ? byeCandidates[attempt % byeCandidates.length].id : undefined;
      const active = byeId ? pairs.filter((p) => p.id !== byeId) : [...pairs];
      const trialBudgets = cloneBudgets(budgets);
      const matched = matchRound(active, r, history, trialBudgets, config, rng, prevLast);
      if (!matched) continue;
      const { games: trialGames, boundaryClashes } = orderRound(r, matched.pairs, config.courts, prevLast, rng);
      if (!best || boundaryClashes < best.clashes) {
        best = {
          games: trialGames,
          clashes: boundaryClashes,
          budgets: trialBudgets,
          usedRematch: matched.usedRematch,
          usedCross: matched.usedCrossInSameTierRound,
          byeId,
        };
      }
    }
    if (!best) {
      // Should be unreachable: the final relaxation stage allows rematches and
      // cross-tier, leaving only the A-C ban — infeasible only in degenerate
      // rosters (e.g. odd A count with zero B pairs). Surface loudly.
      disclosuresSet.add(
        `Round ${r} could not be scheduled without breaking a hard constraint (likely A/C pairs with no B bridge). Round left empty — fix the roster shape.`,
      );
      rounds.push([]);
      continue;
    }
    budgets = best.budgets;
    if (best.byeId) {
      byes[r] = [best.byeId];
      byeCounts.set(best.byeId, (byeCounts.get(best.byeId) ?? 0) + 1);
    }
    if (best.clashes > 0) {
      disclosuresSet.add(
        `Round ${r}: a back-to-back across the round boundary was unavoidable for this roster shape.`,
      );
    } else {
      // A clean layout was found — clear any clash flags from earlier attempts.
      best.games.forEach((g) => delete g.boundaryClash);
    }
    const matched = { usedRematch: best.usedRematch, usedCrossInSameTierRound: best.usedCross };
    const games = best.games;
    for (const g of games) {
      if (history.has(matchKey(g.pairIds[0], g.pairIds[1]))) {
        g.isRematch = true;
        disclosuresSet.add(
          `Round ${r} includes a rematch — pick a meaningful one when confirming (closest earlier scoreline or top-of-tier).`,
        );
      }
      history.add(matchKey(g.pairIds[0], g.pairIds[1]));
      g.pairIds.forEach((id) => gamesPlayed.set(id, (gamesPlayed.get(id) ?? 0) + 1));
    }
    if (matched.usedCrossInSameTierRound) {
      disclosuresSet.add(`Round ${r}: tier counts required a cross-tier game in a same-tier round (bridged through B).`);
    }
    prevLast = lastSlotPairIds(games);
    rounds.push(games);
  }

  return { rounds, byes, disclosures: [...disclosuresSet] };
}
