// PTO Americano v4 — the match generator (STEP 2, brief §3).
//
// ARCHITECTURAL LAW: pure function. No React, no I/O, no Date.now(), no
// Math.random(). All tie-breaks are deterministic, stable playerId last.
//
//   generateNextMatch(pool, players) → { match } | { blocked }
//
// SELECT  — present, not in the active match, below target; four fewest
//           matches, ties by longest wait (measured in completed pool
//           matches; never-played = Infinity → late arrivals join the front).
// FILL    — a departure broke the arithmetic: at-target players complete the
//           quartet, longest wait first; nobody exceeds target+1, and nobody
//           reaches target+1 while a present player sits below target.
// B2B     — nobody from the immediately preceding completed match, except a
//           late arrival's single catch-up, pools under 8 present (where it
//           is mathematically unavoidable), or when exclusion leaves < 4 —
//           then it relaxes with a warning in the metadata.
// RANK    — wins → fewest losses → gameDiff → playerId (equal matchesPlayed
//           makes this always fair). Opening seeding: two never-played
//           players compare by hidden tier so opening quartets are adjacent
//           in strength; once a player has played, tier never touches them.
// PAIR    — 1+4 vs 2+3, falling back 1+3/2+4 then 1+2/3+4 to avoid repeating
//           tonight's partnerships (voided matches excluded); if every
//           configuration repeats, the fewest-repeats option wins.

import type { AmericanoMatch, AmericanoPlayer, AmericanoPool } from "@/types/americano";
import { computeRecords } from "./standings";

const TIER_RANK = { A: 0, B: 1, C: 2 } as const;

/** Matches that COUNT: completed and not voided. */
export function countedMatches(pool: AmericanoPool): AmericanoMatch[] {
  return pool.matches.filter((m) => m.status === "completed");
}

export function activeMatch(pool: AmericanoPool): AmericanoMatch | undefined {
  return pool.matches.find((m) => m.status === "active" || m.status === "pending");
}

const inMatch = (m: AmericanoMatch, id: string) => m.teamA.includes(id) || m.teamB.includes(id);

/** Round-robin matches played (completed, non-voided) by a player in this pool. */
export function matchesPlayed(pool: AmericanoPool, playerId: string): number {
  let n = 0;
  for (const m of pool.matches) {
    if (m.status === "completed" && m.phase === "round_robin" && inMatch(m, playerId)) n++;
  }
  return n;
}

/**
 * Wait = completed pool matches since this player last finished one.
 * Never-played = Infinity — the front of the queue.
 */
export function waitOf(pool: AmericanoPool, playerId: string): number {
  const done = countedMatches(pool);
  let lastIdx = -1;
  for (let i = 0; i < done.length; i++) {
    if (inMatch(done[i], playerId)) lastIdx = i;
  }
  return lastIdx === -1 ? Infinity : done.length - 1 - lastIdx;
}

/** Tonight's partnerships in this pool — completed AND active; voided excluded. */
export function partnershipsTonight(pool: AmericanoPool): Set<string> {
  const set = new Set<string>();
  for (const m of pool.matches) {
    if (m.status === "voided") continue;
    set.add(pairKey(m.teamA[0], m.teamA[1]));
    set.add(pairKey(m.teamB[0], m.teamB[1]));
  }
  return set;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export type BlockedReason = "all_at_target" | "below_four_present" | "match_active";

export interface GeneratedMatch {
  match: { teamA: [string, string]; teamB: [string, string] };
  meta: {
    quartet: string[];               // rank order 1..4
    fallbackLevel: 0 | 1 | 2;        // which pairing configuration was used
    fillPlayerIds: string[];         // at-target players seated by the fill rule
    catchUpPlayerIds: string[];      // late arrivals granted their back-to-back
    warnings: string[];              // e.g. forced back-to-back relaxation
  };
}

export type GenerateResult = GeneratedMatch | { blocked: BlockedReason };

export function generateNextMatch(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
): GenerateResult {
  if (activeMatch(pool)) return { blocked: "match_active" };

  const byId = new Map(players.map((p) => [p.playerId, p] as const));
  const present = pool.playerIds
    .map((id) => byId.get(id))
    .filter((p): p is AmericanoPlayer => !!p && p.status === "present");

  if (present.length < 4) return { blocked: "below_four_present" };

  const played = (id: string) => matchesPlayed(pool, id);
  const below = present.filter((p) => played(p.playerId) < pool.targetMatches);
  if (below.length === 0) return { blocked: "all_at_target" };

  const wait = (id: string) => waitOf(pool, id);
  const neverPlayed = (id: string) => played(id) === 0 && wait(id) === Infinity;
  const atTarget = (id: string) => played(id) === pool.targetMatches;
  // Canonical candidate order (also the deterministic combo tie-break):
  // fewest matches first; never-played pairs compare by hidden tier (opening
  // seeding — tier never touches a player with history); at-target fillers
  // compare by longest wait (the unamended fill rule); playerId last.
  const cmp = (a: AmericanoPlayer, b: AmericanoPlayer): number => {
    const pa = played(a.playerId), pb = played(b.playerId);
    if (pa !== pb) return pa - pb;
    if (neverPlayed(a.playerId) && neverPlayed(b.playerId)) {
      const t = TIER_RANK[a.tier] - TIER_RANK[b.tier];
      if (t !== 0) return t;
    }
    if (atTarget(a.playerId) && atTarget(b.playerId)) {
      const wa = wait(a.playerId), wb = wait(b.playerId);
      if (wa !== wb) return wb - wa;
    }
    return a.playerId < b.playerId ? -1 : 1;
  };

  const warnings: string[] = [];
  const fillPlayerIds: string[] = [];

  // Candidate seats: every below-target player first (the fill guard — nobody
  // reaches target+1 while anyone sits below target), then at-target fillers
  // when a departure left fewer than four.
  const candidates = [...below].sort(cmp);
  if (candidates.length < 4) {
    const fillers = present
      .filter((p) => atTarget(p.playerId))
      .sort(cmp);
    for (const f of fillers) {
      if (candidates.length >= 4) break;
      candidates.push(f);
      fillPlayerIds.push(f.playerId);
    }
    if (candidates.length < 4) return { blocked: "below_four_present" };
    candidates.sort(cmp);
  }

  // VARIETY SELECTION (§3, amended). The quartet must consume the four LOWEST
  // match counts (the wave property and exact convergence are untouchable);
  // WITHIN that constraint, prefer the foursome with the fewest prior
  // co-occurrences tonight, never repeat an exact foursome while an
  // alternative satisfying the hard constraints exists, and avoid
  // back-to-backs above all. Deterministic: canonical order breaks all ties.
  const done = countedMatches(pool);
  const prev = done[done.length - 1];
  const justPlayed = new Set(prev ? [...prev.teamA, ...prev.teamB] : []);
  const isCatchUp = (p: AmericanoPlayer) => p.joinedAtMatchIndex !== null && !p.catchUpUsed;

  // Co-occurrence counts and past foursomes: completed + active, voided out.
  const coocc = new Map<string, number>();
  const foursomes = new Set<string>();
  for (const m of pool.matches) {
    if (m.status === "voided") continue;
    const four = [...m.teamA, ...m.teamB];
    foursomes.add([...four].sort().join("|"));
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const k = pairKey(four[i], four[j]);
        coocc.set(k, (coocc.get(k) ?? 0) + 1);
      }
    }
  }

  const requiredCounts = candidates
    .slice(0, 4)
    .map((p) => played(p.playerId))
    .sort((a, b) => a - b)
    .join(",");
  const b2bRelaxed = present.length < 8;

  let best: AmericanoPlayer[] | null = null;
  let bestScore = Infinity;
  const n = candidates.length;
  for (let i = 0; i < n - 3; i++)
    for (let j = i + 1; j < n - 2; j++)
      for (let k = j + 1; k < n - 1; k++)
        for (let l = k + 1; l < n; l++) {
          const combo = [candidates[i], candidates[j], candidates[k], candidates[l]];
          const counts = combo.map((p) => played(p.playerId)).sort((a, b) => a - b).join(",");
          if (counts !== requiredCounts) continue; // least-played-first is hard
          let score = 0;
          if (!b2bRelaxed) {
            for (const p of combo) {
              if (justPlayed.has(p.playerId) && !isCatchUp(p)) score += 1e9;
            }
          }
          if (foursomes.has(combo.map((p) => p.playerId).sort().join("|"))) score += 1e6;
          for (let x = 0; x < 4; x++)
            for (let y = x + 1; y < 4; y++)
              score += coocc.get(pairKey(combo[x].playerId, combo[y].playerId)) ?? 0;
          if (score < bestScore) {
            bestScore = score;
            best = combo;
          }
        }
  if (!best) return { blocked: "below_four_present" };
  const selection = best;
  if (bestScore >= 1e9) {
    warnings.push("Back-to-back relaxed: fewer than four rested players were available.");
  }
  const catchUpPlayerIds: string[] = [];
  for (const p of selection) {
    if (justPlayed.has(p.playerId) && isCatchUp(p)) catchUpPlayerIds.push(p.playerId);
  }

  // RANK the four by record — equal matchesPlayed makes this always fair.
  const records = computeRecords(pool);
  const rec = (id: string) => records.get(id) ?? { wins: 0, losses: 0, gameDiff: 0 };
  const ranked = [...selection].sort((a, b) => {
    const ra = rec(a.playerId), rb = rec(b.playerId);
    if (rb.wins !== ra.wins) return rb.wins - ra.wins;
    if (ra.losses !== rb.losses) return ra.losses - rb.losses;
    if (rb.gameDiff !== ra.gameDiff) return rb.gameDiff - ra.gameDiff;
    if (neverPlayed(a.playerId) && neverPlayed(b.playerId)) {
      const t = TIER_RANK[a.tier] - TIER_RANK[b.tier];
      if (t !== 0) return t;
    }
    return a.playerId < b.playerId ? -1 : 1;
  });

  // PAIR — 1+4 vs 2+3 → 1+3 vs 2+4 → 1+2 vs 3+4; fewest repeats if all repeat.
  const partnered = partnershipsTonight(pool);
  const configs: [number, number][][] = [
    [[0, 3], [1, 2]],
    [[0, 2], [1, 3]],
    [[0, 1], [2, 3]],
  ];
  let fallbackLevel: 0 | 1 | 2 = 0;
  let fewest = Infinity;
  for (let i = 0; i < configs.length; i++) {
    const [[a1, a2], [b1, b2]] = configs[i];
    const repeats =
      (partnered.has(pairKey(ranked[a1].playerId, ranked[a2].playerId)) ? 1 : 0) +
      (partnered.has(pairKey(ranked[b1].playerId, ranked[b2].playerId)) ? 1 : 0);
    if (repeats < fewest) {
      fewest = repeats;
      fallbackLevel = i as 0 | 1 | 2;
      if (repeats === 0) break;
    }
  }
  const [[a1, a2], [b1, b2]] = configs[fallbackLevel];

  return {
    match: {
      teamA: [ranked[a1].playerId, ranked[a2].playerId],
      teamB: [ranked[b1].playerId, ranked[b2].playerId],
    },
    meta: {
      quartet: ranked.map((p) => p.playerId),
      fallbackLevel,
      fillPlayerIds: fillPlayerIds.filter((id) => selection.some((p) => p.playerId === id)),
      catchUpPlayerIds,
      warnings,
    },
  };
}

/** Wave property: across present players, max − min matchesPlayed. */
export function waveSpread(pool: AmericanoPool, players: AmericanoPlayer[]): number {
  const present = players.filter(
    (p) => p.status === "present" && pool.playerIds.includes(p.playerId),
  );
  if (present.length === 0) return 0;
  const counts = present.map((p) => matchesPlayed(pool, p.playerId));
  return Math.max(...counts) - Math.min(...counts);
}
