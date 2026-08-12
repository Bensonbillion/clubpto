// PTO Americano v4 — the rolling live loop as PURE state transitions (STEP 4).
//
// These are the production transitions the hook commits — extracted here so
// the step's non-negotiable (refresh at ANY moment restores exactly) is
// provable in a simulation: state → mutate → JSON round-trip → ensureLive →
// deep-equal. No React, no I/O, no clock (now is injected), deterministic
// match ids (pool + matchIndex — StrictMode double-invokes React updaters,
// so an impure id here would fork between the two passes).

import type {
  AmericanoMatch, AmericanoScore, AmericanoSession,
} from "@/types/americano";
import { activeMatch, generateNextMatch } from "./generator";

export interface GenerationEvent {
  poolId: string;
  matchId: string;
  warnings: string[];
}

/** Keep every round-robin court rolling: whenever a pool has no active match,
    generate the next one instantly (§3 "Play. Record. Repeat."). Idempotent —
    safe to run after any commit and on resume. */
export function ensureLive(
  s: AmericanoSession,
  now: number,
  onGenerated?: (e: GenerationEvent) => void,
): AmericanoSession {
  if (s.status !== "active") return s;
  let next = s;
  for (const poolId of s.pools.map((p) => p.id)) {
    const pool = next.pools.find((p) => p.id === poolId)!;
    if (pool.status !== "round_robin" || activeMatch(pool)) continue;
    const gen = generateNextMatch(pool, next.players);
    if ("blocked" in gen) continue; // rendered plainly by the UI, never silent
    const matchIndex = pool.matches.length + 1;
    const match: AmericanoMatch = {
      id: `${pool.id}-m${matchIndex}`,
      poolId: pool.id,
      matchIndex,
      teamA: gen.match.teamA,
      teamB: gen.match.teamB,
      result: null,
      status: "active",
      phase: "round_robin",
      startedAt: now,
      completedAt: null,
      // Which exemptions this seating spent — the receipt a discard refunds.
      ...(gen.meta.catchUpPlayerIds.length > 0
        ? { catchUpGranted: [...gen.meta.catchUpPlayerIds] }
        : {}),
    };
    next = {
      ...next,
      // The late arrival's one catch-up is consumed when it is granted.
      players: next.players.map((p) =>
        gen.meta.catchUpPlayerIds.includes(p.playerId) ? { ...p, catchUpUsed: true } : p,
      ),
      pools: next.pools.map((p) =>
        p.id === pool.id ? { ...p, matches: [...p.matches, match] } : p,
      ),
    };
    onGenerated?.({ poolId: pool.id, matchId: match.id, warnings: gen.meta.warnings });
  }
  return next;
}

/** Two-tap entry: an ACTIVE match gets its result and completion stamp. */
export function applyResult(
  s: AmericanoSession,
  matchId: string,
  winner: "A" | "B",
  score: AmericanoScore,
  now: number,
): AmericanoSession {
  return {
    ...s,
    pools: s.pools.map((pool) => ({
      ...pool,
      matches: pool.matches.map((m) =>
        m.id === matchId && m.status === "active"
          ? { ...m, result: { winner, score }, status: "completed" as const, completedAt: now }
          : m,
      ),
    })),
  };
}

/** Correction: standings recompute from the log; completedAt is kept so the
    pace history stays truthful. Completed matches only. */
export function applyCorrection(
  s: AmericanoSession,
  matchId: string,
  winner: "A" | "B",
  score: AmericanoScore,
): AmericanoSession {
  return {
    ...s,
    pools: s.pools.map((pool) => ({
      ...pool,
      matches: pool.matches.map((m) =>
        m.id === matchId && m.status === "completed"
          ? { ...m, result: { winner, score } }
          : m,
      ),
    })),
  };
}

/** Void = counts for nothing anywhere (schema rule). The row stays in the
    log, struck through; the queue self-corrects on the next generation. */
export function applyVoid(s: AmericanoSession, matchId: string): AmericanoSession {
  return {
    ...s,
    pools: s.pools.map((pool) => ({
      ...pool,
      matches: pool.matches.map((m) =>
        m.id === matchId && m.status === "completed"
          ? { ...m, status: "voided" as const }
          : m,
      ),
    })),
  };
}
