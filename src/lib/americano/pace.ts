// PTO Americano v4 — the informational pace line (STEP 4, brief §6/§8).
// "avg 7:40 · RR ends ~9:38". Pace = rolling average of the LAST FIVE
// inter-completion intervals for the pool; the first interval runs from the
// session's first call (the first match's generation time). It informs the
// early-playoff call and enforces NOTHING. Pure: `now` is injected.

import type { AmericanoPlayer, AmericanoPool } from "@/types/americano";
import { matchesPlayed } from "./generator";

export interface PoolPace {
  /** Completed (non-voided) round-robin matches. */
  done: number;
  /** done + the matches still owed to the players actually here. */
  total: number;
  /** Rolling average of the last 5 inter-completion intervals; null until
      two completions exist. */
  avgMs: number | null;
  /** Projected round-robin end (epoch ms); null while avgMs is null. */
  projectedEndMs: number | null;
}

/**
 * How many more matches this court owes. NOT courtMatchesNeeded(size, target):
 * once anyone is `left` or `not_arrived` (STEP 5), pool membership overstates
 * the night — a court whose no-shows never arrive would sit forever at
 * "match 7 of 12". Counting the shortfall of the players who are actually
 * PRESENT is also wrong on its own (it ignores matches already banked by
 * people who since left), so the honest number is the outstanding need:
 * every present player's remaining matches, four seats to a match. Players
 * carried past target by the fill rule owe nothing (never negative).
 */
function remainingMatches(pool: AmericanoPool, players: AmericanoPlayer[]): number {
  const byId = new Map(players.map((p) => [p.playerId, p] as const));
  let owed = 0;
  for (const id of pool.playerIds) {
    const p = byId.get(id);
    if (!p || p.status !== "present") continue;
    owed += Math.max(0, pool.targetMatches - matchesPlayed(pool, id));
  }
  return Math.ceil(owed / 4);
}

export function poolPace(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
  nowMs: number,
): PoolPace {
  const rr = pool.matches.filter((m) => m.phase === "round_robin" && m.status !== "voided");
  const completions = rr
    .filter((m) => m.status === "completed" && m.completedAt !== null)
    .map((m) => m.completedAt as number)
    .sort((a, b) => a - b);
  const done = completions.length;
  const remaining = remainingMatches(pool, players);
  const total = done + remaining;

  if (done < 2) return { done, total, avgMs: null, projectedEndMs: null };

  // Anchor: the pool's first call of the night (earliest generation time).
  const anchor = Math.min(...pool.matches.map((m) => m.startedAt ?? Infinity));
  const intervals: number[] = [];
  for (let i = 0; i < completions.length; i++) {
    const prev = i === 0 ? (Number.isFinite(anchor) ? anchor : completions[0]) : completions[i - 1];
    intervals.push(Math.max(0, completions[i] - prev));
  }
  const window = intervals.slice(-5);
  const avgMs = window.reduce((a, b) => a + b, 0) / window.length;
  return {
    done,
    total,
    avgMs,
    projectedEndMs: remaining > 0 ? nowMs + remaining * avgMs : null,
  };
}
