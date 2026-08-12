// PTO Americano v4 — weekly setup arithmetic (STEP 1, brief §2).
// Pure functions: no React, no I/O, no clock, no randomness.
//
// Exactness rule: everyone in a pool plays the exact same number of matches
// only when pool_size × target divides evenly by 4. The setup screen offers
// ONLY targets that satisfy it. Guarantee encoded here: 4 each is valid for
// every even pool size, so any even signup count always has a clean option.

import type { AmericanoPlayer, AmericanoTier } from "@/types/americano";

const TIER_RANK: Record<AmericanoTier, number> = { A: 0, B: 1, C: 2 };

/** Targets t in [2..6] where (poolSize × t) % 4 === 0.
    14 → [2, 4, 6] · 12 → [2, 3, 4, 5, 6] · 16 → [2, 3, 4, 5, 6]. */
export function validTargets(poolSize: number): number[] {
  if (poolSize < 4) return [];
  const out: number[] = [];
  for (let t = 2; t <= 6; t++) {
    if ((poolSize * t) % 4 === 0) out.push(t);
  }
  return out;
}

/** Court matches a pool owes: (size × target) / 4. 16×3→12 · 12×4→12 · 14×4→14. */
export function courtMatchesNeeded(poolSize: number, target: number): number {
  return (poolSize * target) / 4;
}

/** Setup default (STEP 3): the highest valid target that is ≤ 4; null when
    the pool can't field a match at all. Every size ≥ 4 has one (4 is valid
    for all even sizes and for any size divisible by… any size, since s×4 is
    always divisible by 4). */
export function setupDefaultTarget(poolSize: number): number | null {
  const options = validTargets(poolSize).filter((t) => t <= 4);
  return options.length > 0 ? options[options.length - 1] : null;
}

export type SetupNoticeLevel = "info" | "warning" | "block";

export interface SetupNotice {
  level: SetupNoticeLevel;
  message: string;
}

/** Live inline notices for a pool column on the setup screen (STEP 3). */
export function poolSetupNotices(poolSize: number): SetupNotice[] {
  const out: SetupNotice[] = [];
  if (poolSize < 4) {
    out.push({ level: "block", message: `Court needs at least 4 players to run — ${poolSize} assigned.` });
    return out;
  }
  if (poolSize % 2 === 1) {
    out.push({
      level: "warning",
      message: "Odd pool size — exact equality can break; the fill rule will give one or two players an extra match. Consider moving one player.",
    });
  }
  if (poolSize < 8) {
    out.push({ level: "info", message: "Back-to-back rest relaxes at this size." });
  }
  return out;
}

export interface PoolSplitProposal {
  /** Premier pool (Champion-of-the-Week court, brief §5). */
  court2: string[];
  court1: string[];
}

/**
 * Propose the two pools from hidden tiers: A/B to the premier pool (Court 2),
 * C to the other — then balance sizes by shifting the weakest of the premier
 * group down so neither pool starts under 4. The admin adjusts the split in
 * the setup UI; this is a starting point, not a cage.
 */
export function proposePoolSplit(players: AmericanoPlayer[]): PoolSplitProposal {
  const sorted = [...players]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => TIER_RANK[a.p.tier] - TIER_RANK[b.p.tier] || a.i - b.i)
    .map((x) => x.p);
  const court2: string[] = [];
  const court1: string[] = [];
  for (const p of sorted) {
    (p.tier === "C" ? court1 : court2).push(p.playerId);
  }
  // Keep both courts playable: shift the weakest premier players down (they
  // are last in sorted order within court2) until sizes are workable.
  while (court1.length < 4 && court2.length > 4) court1.unshift(court2.pop()!);
  while (court2.length < 4 && court1.length > 4) court2.push(court1.shift()!);
  return { court2, court1 };
}
