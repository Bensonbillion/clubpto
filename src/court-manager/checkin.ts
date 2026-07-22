// Court Manager v2 — check-in, VIP resolution, and pair generation (§5, §18).
//
// THE SECRECY LAYER IS STRUCTURAL HERE: the player-facing projections return
// types that contain no tier, no VIP flag, no composition data — a view built
// on them cannot leak what it never receives. Tier labels, tier colors, VIP
// mechanics, and tier breakdowns are admin-eyes-only, everywhere, always.

import type { Pair, Player, Tier } from "./types";

// ---------------------------------------------------------------------------
// Player-facing projections (§18.1, §18.2, §18.4)
// ---------------------------------------------------------------------------

/** What a player may see about another player: name and check-in state. Nothing else. */
export interface PublicRosterEntry {
  playerId: string;
  name: string;
  checkedIn: boolean;
}

/** Names listed alphabetically with a check-in state — no tags, no colors, no hints. */
export function publicRoster(players: Player[]): PublicRosterEntry[] {
  return [...players]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ playerId: p.id, name: p.name, checkedIn: p.checkedIn }));
}

/** "24 of 28 checked in" — how full the session is, never the composition. */
export function publicCountSummary(players: Player[]): { checkedIn: number; total: number } {
  return {
    checkedIn: players.filter((p) => p.checkedIn).length,
    total: players.length,
  };
}

/** The only roster-status message a player ever sees. No tier attached. */
export const WAITLIST_MESSAGE = "You're on the waitlist — we'll get you in as soon as your partner arrives.";

/** The chosen partner's entire view of a VIP pick: subtle, no who, no why (§18.3). */
export const PAIRED_CONFIRMATION = "You've been paired for tonight.";

// ---------------------------------------------------------------------------
// VIP resolution (§5, rule 15) — invisible on both ends, admin-only data
// ---------------------------------------------------------------------------

export interface VipResolution {
  /** Hard pairing constraints — regeneration must preserve these. */
  locks: Pair[];
  /** VIPs whose chosen partner hasn't checked in yet — held until they arrive. */
  pending: { vipId: string; partnerId: string }[];
  /** Picks that can't be honored; the VIP falls back to normal pairing. Admin-only. */
  rejected: { vipId: string; partnerId: string; reason: string }[];
}

function pairId(a: string, b: string): string {
  return a < b ? `pair-${a}-${b}` : `pair-${b}-${a}`;
}

/**
 * Resolve VIP picks in CHECK-IN ORDER: mutual picks lock instantly, conflicts
 * go to whoever checked in first, same-tier only, absent partners hold pending.
 */
export function resolveVipPicks(players: Player[]): VipResolution {
  const byId = new Map(players.map((p) => [p.id, p]));
  const vips = players
    .filter((p) => p.isVip && p.checkedIn && p.vipPartnerId)
    .sort((a, b) => (a.checkInTime ?? Infinity) - (b.checkInTime ?? Infinity));

  const locks: Pair[] = [];
  const pending: VipResolution["pending"] = [];
  const rejected: VipResolution["rejected"] = [];
  const lockedIds = new Set<string>();

  for (const vip of vips) {
    if (lockedIds.has(vip.id)) continue; // already locked by a mutual/earlier pick
    const partner = byId.get(vip.vipPartnerId as string);
    if (!partner) {
      rejected.push({ vipId: vip.id, partnerId: vip.vipPartnerId as string, reason: "unknown player" });
      continue;
    }
    if (partner.tier !== vip.tier) {
      rejected.push({ vipId: vip.id, partnerId: partner.id, reason: "different tier — VIP picks are same-tier only" });
      continue;
    }
    if (!partner.checkedIn) {
      pending.push({ vipId: vip.id, partnerId: partner.id });
      continue;
    }
    if (lockedIds.has(partner.id)) {
      rejected.push({ vipId: vip.id, partnerId: partner.id, reason: "partner already locked — earlier check-in wins" });
      continue;
    }
    locks.push({ id: pairId(vip.id, partner.id), playerIds: [vip.id, partner.id], tier: vip.tier, vipLocked: true });
    lockedIds.add(vip.id);
    lockedIds.add(partner.id);
  }

  return { locks, pending, rejected };
}

// ---------------------------------------------------------------------------
// Pair generation (§5) — within tier only (/manage)
// ---------------------------------------------------------------------------

export interface PairGeneration {
  pairs: Pair[];
  vip: VipResolution;
  /**
   * Checked-in players left without a partner, per tier: the odd player out
   * (sub candidate), plus VIPs holding for an absent partner. These feed the
   * waitlist — first priority the moment they're paired.
   */
  unpaired: Record<Tier, string[]>;
}

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

export function generatePairs(players: Player[], seed = 1): PairGeneration {
  const rng = makeRng(seed);
  const vip = resolveVipPicks(players);
  const locked = new Set(vip.locks.flatMap((p) => p.playerIds));
  const holding = new Set(vip.pending.map((p) => p.vipId)); // VIPs waiting on a partner

  const pairs: Pair[] = [...vip.locks];
  const unpaired: Record<Tier, string[]> = { A: [], B: [], C: [] };

  for (const tier of ["A", "B", "C"] as Tier[]) {
    const pool = players
      .filter((p) => p.tier === tier && p.checkedIn && !locked.has(p.id) && !holding.has(p.id))
      .map((p) => p.id)
      .sort(() => rng() - 0.5);
    while (pool.length >= 2) {
      const a = pool.pop() as string;
      const b = pool.pop() as string;
      pairs.push({ id: pairId(a, b), playerIds: [a, b], tier });
    }
    unpaired[tier].push(...pool); // the odd player out, if any
    for (const hold of vip.pending) {
      const vipPlayer = players.find((p) => p.id === hold.vipId);
      if (vipPlayer?.tier === tier) unpaired[tier].push(hold.vipId);
    }
  }

  return { pairs, vip, unpaired };
}
