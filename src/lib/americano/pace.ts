// PTO Americano v4 — the informational pace line (STEP 4, brief §6/§8).
// "avg 7:40 · RR ends ~9:38". Pace = rolling average of the LAST FIVE
// inter-completion intervals for the pool; the first interval runs from the
// session's first call (the first match's generation time). It informs the
// early-playoff call and enforces NOTHING. Pure: `now` is injected.

import type { AmericanoPool } from "@/types/americano";
import { courtMatchesNeeded } from "./config";

export interface PoolPace {
  /** Completed (non-voided) round-robin matches. */
  done: number;
  /** courtMatchesNeeded for the pool's current size + target. */
  total: number;
  /** Rolling average of the last 5 inter-completion intervals; null until
      two completions exist. */
  avgMs: number | null;
  /** Projected round-robin end (epoch ms); null while avgMs is null. */
  projectedEndMs: number | null;
}

export function poolPace(pool: AmericanoPool, nowMs: number): PoolPace {
  const rr = pool.matches.filter((m) => m.phase === "round_robin" && m.status !== "voided");
  const completions = rr
    .filter((m) => m.status === "completed" && m.completedAt !== null)
    .map((m) => m.completedAt as number)
    .sort((a, b) => a - b);
  const done = completions.length;
  const total = courtMatchesNeeded(pool.playerIds.length, pool.targetMatches);

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
  const remaining = Math.max(0, total - done);
  return {
    done,
    total,
    avgMs,
    projectedEndMs: remaining > 0 ? nowMs + remaining * avgMs : null,
  };
}
