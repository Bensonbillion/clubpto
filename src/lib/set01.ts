// ============================================================
// Pure tournament logic for Set 01 / Courtside Social
// ============================================================
// All functions here are deterministic and side-effect-free so the bracket
// engine can be unit-tested without React or Supabase. The hook
// (`useSet01Tournament`) calls into these helpers; nothing else should.

import {
  Set01State,
  Stage1Match,
  FinalSeed,
  KnockoutMatch,
  WomensGroupMatch,
  WomensStanding,
  WomensTeamSlot,
  WomensKnockoutMatch,
} from "@/types/set01";

// ── Match helpers ──────────────────────────────────────────

export function matchWinner(m: { scoreA: number | null; scoreB: number | null }): "A" | "B" | null {
  if (m.scoreA == null || m.scoreB == null) return null;
  if (m.scoreA === m.scoreB) return null; // ties not allowed in best-of-3
  return m.scoreA > m.scoreB ? "A" : "B";
}

export function pointDiff(m: { scoreA: number | null; scoreB: number | null }): number | null {
  if (m.scoreA == null || m.scoreB == null) return null;
  return Math.abs(m.scoreA - m.scoreB);
}

// ── Stage 1 swap rule ──────────────────────────────────────

/**
 * Apply the Stage 1 promotion/relegation rule.
 *
 * Rules (per user spec):
 * - Top 4 anchor seeds are locked. Stage 1 results never change them.
 * - Band A: each 9-12 team that wins their match swaps with a 5-8 team that lost.
 *   When upsets and openings are uneven, the upsetter with the highest point
 *   differential gets the promotion. Remaining upsetters stay in 9-12.
 * - Band B: each 13-16 team that wins promotes to 9-12. The replaced 9-12 team
 *   is the highest-numbered remaining 9-12 team (weakest).
 *
 * Returns a fresh array of FinalSeed objects (1..16).
 */
export function applySwaps(stage1: Stage1Match[]): FinalSeed[] {
  const finalSeeds: FinalSeed[] = Array.from({ length: 16 }, (_, i) => ({
    seed: i + 1,
    originalSeed: i + 1,
  }));

  const swap = (a: number, b: number) => {
    const slotA = finalSeeds.find((f) => f.originalSeed === a);
    const slotB = finalSeeds.find((f) => f.originalSeed === b);
    if (!slotA || !slotB) return;
    const tmp = slotA.originalSeed;
    slotA.originalSeed = slotB.originalSeed;
    slotB.originalSeed = tmp;
  };

  // Band A: matches 0..3 (1-4 vs 9-12)
  // Upset = team B (the 9-12) won
  const bandA_upsets = stage1
    .slice(0, 4)
    .filter((m) => matchWinner(m) === "B")
    .sort((a, b) => (pointDiff(b)! - pointDiff(a)!));

  // Open spots in 5-8 = matches in band B where the 5-8 team lost
  const bandA_openSpots = stage1
    .slice(4, 8)
    .filter((m) => matchWinner(m) === "B")
    .sort((a, b) => (pointDiff(b)! - pointDiff(a)!));

  const numA = Math.min(bandA_upsets.length, bandA_openSpots.length);
  for (let i = 0; i < numA; i++) {
    // The 9-12 winner gets promoted; the 5-8 loser is the team they swap with
    swap(bandA_upsets[i].seedB, bandA_openSpots[i].seedA);
  }

  // Band B: 13-16 winners promote into the 9-12 band
  const bandB_upsets = stage1.slice(4, 8).filter((m) => matchWinner(m) === "B");
  for (const m of bandB_upsets) {
    const upsetter = m.seedB; // 13-16 team
    // Find a 9-12 slot whose CURRENT occupant is still an original 9-12 team
    // (i.e. wasn't already promoted out by a band A swap)
    const candidates = [9, 10, 11, 12].filter((slot) => {
      const fs = finalSeeds.find((f) => f.seed === slot)!;
      return fs.originalSeed >= 9 && fs.originalSeed <= 12;
    });
    if (candidates.length === 0) continue;
    // Replace the weakest remaining 9-12 (highest originalSeed)
    candidates.sort((a, b) => {
      const fa = finalSeeds.find((f) => f.seed === a)!;
      const fb = finalSeeds.find((f) => f.seed === b)!;
      return fb.originalSeed - fa.originalSeed;
    });
    const targetSlot = candidates[0];
    const fs = finalSeeds.find((f) => f.seed === targetSlot)!;
    swap(upsetter, fs.originalSeed);
  }

  return finalSeeds;
}

// ── Knockout bracket walking ───────────────────────────────

/**
 * Recursively resolve the seeded teams for a knockout match.
 * For R16 matches the seeds are explicit; for QF/SF/F they cascade from
 * prior winners.
 */
export function getKnockoutSeeds(
  match: KnockoutMatch,
  allMatches: Map<string, KnockoutMatch>,
): { a: number | null; b: number | null } {
  if (match.seedA != null && match.seedB != null) {
    return { a: match.seedA, b: match.seedB };
  }

  const winnerSeed = (id: string | undefined): number | null => {
    if (!id) return null;
    const src = allMatches.get(id);
    if (!src) return null;
    const w = matchWinner(src);
    if (!w) return null;
    if (src.seedA != null && src.seedB != null) {
      return w === "A" ? src.seedA! : src.seedB!;
    }
    return w === "A" ? winnerSeed(src.sourceA) : winnerSeed(src.sourceB);
  };

  return {
    a: winnerSeed(match.sourceA),
    b: winnerSeed(match.sourceB),
  };
}

export function buildMatchMap(state: Set01State): Map<string, KnockoutMatch> {
  const map = new Map<string, KnockoutMatch>();
  state.r16.forEach((m) => map.set(m.id, m));
  state.qf.forEach((m) => map.set(m.id, m));
  state.sf.forEach((m) => map.set(m.id, m));
  map.set(state.f.id, state.f);
  return map;
}

// ── Women's standings ──────────────────────────────────────

/**
 * Calculate women's group-stage standings.
 * Sort: Wins (desc) → point differential (desc) → points scored (desc).
 * Further ties (head-to-head, coin toss) are caller responsibility.
 */
export function calculateWomensStandings(
  teams: WomensTeamSlot[],
  groupMatches: WomensGroupMatch[],
): WomensStanding[] {
  const teamNameOf = (t: WomensTeamSlot): string => {
    if (t.player1 && t.player2) return `${t.player1.display} & ${t.player2.display}`;
    if (t.player1) return t.player1.display;
    return `Team ${t.label}`;
  };

  const standings: WomensStanding[] = teams.map((t) => ({
    label: t.label,
    name: teamNameOf(t),
    w: 0,
    l: 0,
    pf: 0,
    pa: 0,
    diff: 0,
  }));

  const map = Object.fromEntries(standings.map((s) => [s.label, s]));

  for (const g of groupMatches) {
    if (g.scoreA == null || g.scoreB == null) continue;
    const a = map[g.teamA];
    const b = map[g.teamB];
    if (!a || !b) continue;
    a.pf += g.scoreA;
    a.pa += g.scoreB;
    b.pf += g.scoreB;
    b.pa += g.scoreA;
    if (g.scoreA > g.scoreB) {
      a.w++;
      b.l++;
    } else if (g.scoreB > g.scoreA) {
      b.w++;
      a.l++;
    }
  }

  standings.forEach((s) => (s.diff = s.pf - s.pa));
  standings.sort((x, y) => y.w - x.w || y.diff - x.diff || y.pf - x.pf);
  return standings;
}

export function womensSFWinnerLabel(sf: WomensKnockoutMatch): string | null {
  const w = matchWinner(sf);
  if (!w) return null;
  return w === "A" ? sf.teamA : sf.teamB;
}
