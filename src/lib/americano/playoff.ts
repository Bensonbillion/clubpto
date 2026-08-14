// PTO Americano v4 — the playoff module (STEP 7, brief §5 and §6).
//
// Pure throughout: the clock is injected, nothing here touches React or I/O,
// and the round-robin generator is untouched. The bracket is LOCKED by the
// brief — pairs 1+3, 2+4, 5+7, 6+8 and a crossed draw — so nothing about it
// is configurable and nothing about it is guessed at runtime.
//
// The load-bearing idea is the SNAPSHOT. Seeds, pairs and structure freeze at
// lock time and are persisted, because the round robin stays correctable
// afterwards: without a freeze, fixing a typo in match 3 could reshuffle a
// bracket that four people are already standing on court to play.

import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoSession, MatchFormat,
  PlayoffPair, PlayoffSeed, PlayoffSnapshot, PoolChampion, StandingsRow,
} from "@/types/americano";
import { activeMatch } from "./generator";
import { poolStandings, unresolvedFlipsAffecting, type BlockingFlip } from "./flips";
import { playoffFormat } from "./format";

/* ── eligibility ─────────────────────────────────────────────────── */

export interface Eligibility {
  eligible: StandingsRow[];
  excluded: { playerId: string; matchesPlayed: number }[];
  leaderMatches: number;
  minimum: number;
}

/**
 * Within one match of the pool's most-played player (brief §5). The wave
 * property means everyone present from the start qualifies automatically; it
 * only ever excludes a very late arrival.
 */
export function eligibility(pool: AmericanoPool, players: AmericanoPlayer[]): Eligibility {
  const rows = poolStandings(pool, players);
  const leaderMatches = Math.max(0, ...rows.map((r) => r.matchesPlayed));
  const minimum = Math.max(0, leaderMatches - 1);
  const eligible: StandingsRow[] = [];
  const excluded: { playerId: string; matchesPlayed: number }[] = [];
  for (const r of rows) {
    if (r.matchesPlayed >= minimum) eligible.push(r);
    else excluded.push({ playerId: r.playerId, matchesPlayed: r.matchesPlayed });
  }
  return { eligible, excluded, leaderMatches, minimum };
}

/** 12+ eligible runs the top-8 bracket; 8–11 runs top 4; fewer runs neither. */
export function playoffModeFor(eligibleCount: number): "top8" | "top4" | null {
  if (eligibleCount >= 12) return "top8";
  if (eligibleCount >= 8) return "top4";
  return null;
}

export const cutSizeFor = (mode: "top8" | "top4"): number => (mode === "top8" ? 8 : 4);

/* ── the gate ────────────────────────────────────────────────────── */

/**
 * Seeds cannot lock while a coin the bracket depends on is unresolved.
 * Group-based and blank-slate-aware by construction — this delegates to the
 * 6.2 gate rather than re-deriving anything.
 */
export function playoffBlockers(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
  mode: "top8" | "top4",
): BlockingFlip[] {
  return unresolvedFlipsAffecting(pool, players, cutSizeFor(mode));
}

/* ── seeding and the locked bracket ──────────────────────────────── */

/** LOCKED (brief §5). Top 8: 1+3, 2+4, 5+7, 6+8. Top 4: 1+3, 2+4. */
const PAIR_SEEDS: Record<"top8" | "top4", [number, number][]> = {
  top8: [[1, 3], [2, 4], [5, 7], [6, 8]],
  top4: [[1, 3], [2, 4]],
};

export type PlayoffPlan =
  | { status: "ready"; snapshot: PlayoffSnapshot }
  | { status: "too_few_eligible"; blockers: BlockingFlip[] }
  | { status: "blocked_by_flips"; blockers: BlockingFlip[] };

/**
 * Everything the confirm screen shows, and exactly what lockPlayoff will
 * write. Computing it is side-effect free, so the screen can render the plan
 * and the refusal from the same call.
 */
export function planPlayoff(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
  now: number,
  formatOverride?: MatchFormat,
): PlayoffPlan {
  const { eligible, excluded, leaderMatches } = eligibility(pool, players);
  const mode = playoffModeFor(eligible.length);
  if (!mode) return { status: "too_few_eligible", blockers: [] };

  const blockers = playoffBlockers(pool, players, mode);
  if (blockers.length > 0) return { status: "blocked_by_flips", blockers };

  const cut = eligible.slice(0, cutSizeFor(mode));
  const seeds: PlayoffSeed[] = cut.map((r, i) => ({
    playerId: r.playerId,
    seed: i + 1,
    tiebreakApplied: r.tiebreakApplied,
  }));
  const bySeed = new Map(seeds.map((s) => [s.seed, s.playerId] as const));
  const pairs: PlayoffPair[] = PAIR_SEEDS[mode].map(([x, y]) => ({
    seeds: [x, y],
    playerIds: [bySeed.get(x)!, bySeed.get(y)!],
  }));

  return {
    status: "ready",
    snapshot: {
      mode, lockedAt: now, seeds, pairs, excluded,
      format: playoffFormat(pool, formatOverride),
      leaderMatches,
    },
  };
}

/* ── triggering ──────────────────────────────────────────────────── */

/**
 * Trigger. No new round-robin matches generate for this pool from here. If a
 * match is on court it finishes and COUNTS — seeds lock from the final
 * standings, not from a snapshot taken mid-point.
 */
export function requestPlayoff(s: AmericanoSession, poolId: string): AmericanoSession {
  const pool = s.pools.find((p) => p.id === poolId);
  if (!pool || (pool.status !== "round_robin" && pool.status !== "playoff_pending")) return s;
  const pending = activeMatch(pool) !== undefined;
  const status = pending ? "playoff_pending" as const : "playoff_pending" as const;
  if (pool.status === status) return s;
  return { ...s, pools: s.pools.map((p) => (p.id === poolId ? { ...p, status } : p)) };
}

/** Back out of a trigger while nothing is locked — the valve is not a trap. */
export function cancelPlayoff(s: AmericanoSession, poolId: string): AmericanoSession {
  const pool = s.pools.find((p) => p.id === poolId);
  if (!pool || pool.status !== "playoff_pending" || pool.playoff) return s;
  return { ...s, pools: s.pools.map((p) => (p.id === poolId ? { ...p, status: "round_robin" } : p)) };
}

/** Is the pool waiting on a round-robin match before seeds can lock? */
export const awaitingPendingMatch = (pool: AmericanoPool): boolean =>
  pool.status === "playoff_pending" && activeMatch(pool) !== undefined;

/* ── locking: write the snapshot and the bracket ─────────────────── */

const bracketMatch = (
  pool: AmericanoPool,
  index: number,
  phase: "playoff_sf1" | "playoff_sf2" | "playoff_final",
  teamA: [string, string],
  teamB: [string, string],
  format: MatchFormat,
  now: number,
): AmericanoMatch => ({
  id: `${pool.id}-${phase}`,
  poolId: pool.id,
  matchIndex: index,
  teamA, teamB,
  result: null,
  status: "active",
  phase,
  startedAt: now,
  completedAt: null,
  // Carried on the match so the log renders it in the notation it was played
  // in, even when the bracket runs a different format from the pool.
  format,
});

const EMPTY_PAIR: [string, string] = ["", ""];

/**
 * Lock the seeds and create the bracket. Refused while the gate blocks, while
 * a round-robin match is still on court, or when a bracket already exists.
 */
export function lockPlayoff(
  s: AmericanoSession,
  poolId: string,
  now: number,
  formatOverride?: MatchFormat,
): AmericanoSession {
  const pool = s.pools.find((p) => p.id === poolId);
  if (!pool || pool.playoff) return s;
  if (activeMatch(pool)) return s; // the pending match finishes first
  const plan = planPlayoff(pool, s.players, now, formatOverride);
  if (plan.status !== "ready") return s;

  const { snapshot } = plan;
  const base = pool.matches.length;
  const [p1, p2, p3, p4] = snapshot.pairs;
  const matches: AmericanoMatch[] =
    snapshot.mode === "top8"
      ? [
          // CROSSED (brief §5): the two strong pairs cannot meet before the
          // final, and seeds 5-8 get a live shot at the upset.
          bracketMatch(pool, base + 1, "playoff_sf1", p1.playerIds, p4.playerIds, snapshot.format, now),
          bracketMatch(pool, base + 2, "playoff_sf2", p2.playerIds, p3.playerIds, snapshot.format, now),
          bracketMatch(pool, base + 3, "playoff_final", EMPTY_PAIR, EMPTY_PAIR, snapshot.format, now),
        ]
      : [
          bracketMatch(pool, base + 1, "playoff_final", p1.playerIds, p2.playerIds, snapshot.format, now),
        ];
  // Only the first match of the bracket is on court; the rest wait.
  const staged = matches.map((m, i) =>
    i === 0 ? m : { ...m, status: "pending" as const, startedAt: null },
  );

  return {
    ...s,
    pools: s.pools.map((p) =>
      p.id === poolId
        ? { ...p, status: "playoff", playoffMode: snapshot.mode, playoff: snapshot,
            matches: [...p.matches, ...staged] }
        : p,
    ),
  };
}

/* ── running the bracket ─────────────────────────────────────────── */

const findPhase = (pool: AmericanoPool, phase: AmericanoMatch["phase"]) =>
  pool.matches.find((m) => m.phase === phase);

const winnerOf = (m: AmericanoMatch): [string, string] | null =>
  m.result && m.status === "completed" ? (m.result.winner === "A" ? m.teamA : m.teamB) : null;

/**
 * Fill the final from the semis and put the next bracket match on court.
 * Idempotent, so it can run after every commit exactly like ensureLive.
 */
export function advanceBracket(s: AmericanoSession, now: number): AmericanoSession {
  let changed = false;
  const pools = s.pools.map((pool) => {
    if (pool.status !== "playoff" || !pool.playoff) return pool;
    let matches = pool.matches;

    if (pool.playoff.mode === "top8") {
      const sf1 = findPhase(pool, "playoff_sf1");
      const sf2 = findPhase(pool, "playoff_sf2");
      const finalMatch = findPhase(pool, "playoff_final");
      if (sf1 && sf2 && finalMatch && finalMatch.status !== "completed") {
        const w1 = winnerOf(sf1), w2 = winnerOf(sf2);
        const teamA = w1 ?? EMPTY_PAIR;
        const teamB = w2 ?? EMPTY_PAIR;
        const ready = w1 !== null && w2 !== null;
        const wantStatus = ready ? "active" as const : "pending" as const;
        if (
          finalMatch.teamA.join() !== teamA.join() ||
          finalMatch.teamB.join() !== teamB.join() ||
          finalMatch.status !== wantStatus
        ) {
          changed = true;
          matches = matches.map((m) =>
            m.id === finalMatch.id
              ? { ...m, teamA, teamB, status: wantStatus,
                  startedAt: ready ? (m.startedAt ?? now) : null }
              : m,
          );
        }
      }
      // Both semis are live at once unless the admin is running them
      // sequentially; a pending semi comes on court when the other finishes.
      const sfs = matches.filter((m) => m.phase === "playoff_sf1" || m.phase === "playoff_sf2");
      for (const sf of sfs) {
        if (sf.status === "pending") {
          changed = true;
          matches = matches.map((m) => (m.id === sf.id ? { ...m, status: "active", startedAt: now } : m));
        }
      }
    }
    return changed ? { ...pool, matches } : pool;
  });
  return changed ? { ...s, pools } : s;
}

/* ── corrections inside a bracket ────────────────────────────────── */

const DOWNSTREAM: Partial<Record<AmericanoMatch["phase"], AmericanoMatch["phase"][]>> = {
  playoff_sf1: ["playoff_final"],
  playoff_sf2: ["playoff_final"],
};

/**
 * A bracket match is correctable like any other, EXCEPT once a match it feeds
 * already has a recorded result: changing a semi under a played final would
 * leave a champion who never beat the pair the table says they beat.
 */
export function playoffCorrectionBlock(
  pool: AmericanoPool,
  matchId: string,
): { blocked: boolean; message?: string } {
  const m = pool.matches.find((x) => x.id === matchId);
  if (!m) return { blocked: false };
  for (const phase of DOWNSTREAM[m.phase] ?? []) {
    const down = findPhase(pool, phase);
    if (down && down.result && down.status !== "voided") {
      return { blocked: true, message: "Void the final first — it was played from this result." };
    }
  }
  return { blocked: false };
}

/**
 * Voiding inside a bracket puts it back where it was.
 *
 * Voiding the FINAL takes the champion down with it — the correction sheet
 * tells the admin to "void the final first", so that has to be a real way
 * back, not just a status change under a headline still naming the wrong
 * pair. A void leaves the result on the match (it is a record of what was
 * played, not a deletion), so the final is explicitly reopened here.
 *
 * Voiding a SEMI empties the final and makes it wait again — only in top8,
 * because a top4 bracket is the final alone and has no semis to void.
 */
export function regressBracket(s: AmericanoSession, poolId: string): AmericanoSession {
  const pool = s.pools.find((p) => p.id === poolId);
  if (!pool || !pool.playoff) return s;
  const finalMatch = findPhase(pool, "playoff_final");
  if (!finalMatch) return s;

  if (finalMatch.status === "voided") {
    return {
      ...s,
      pools: s.pools.map((p) =>
        p.id === poolId
          ? { ...p, champion: undefined, status: "playoff" as const,
              matches: p.matches.map((m) =>
                m.id === finalMatch.id
                  ? { ...m, result: null, status: "active" as const, completedAt: null }
                  : m) }
          : p,
      ),
    };
  }

  if (pool.playoff.mode !== "top8" || finalMatch.result) return s;
  return {
    ...s,
    pools: s.pools.map((p) =>
      p.id === poolId
        ? { ...p, champion: undefined,
            matches: p.matches.map((m) =>
              m.id === finalMatch.id
                ? { ...m, teamA: EMPTY_PAIR, teamB: EMPTY_PAIR, status: "pending" as const, startedAt: null }
                : m) }
        : p,
    ),
  };
}

/* ── champions ───────────────────────────────────────────────────── */

export const championTitle = (pool: AmericanoPool): string =>
  pool.label === "Court 2" ? "PTO Champion of the Week" : "Court 1 Champion";

/** The final is in → crown the pair. Idempotent. */
export function crownFromBracket(s: AmericanoSession, now: number): AmericanoSession {
  let changed = false;
  const pools = s.pools.map((pool) => {
    if (pool.status !== "playoff" || !pool.playoff || pool.champion) return pool;
    const finalMatch = findPhase(pool, "playoff_final");
    const w = finalMatch ? winnerOf(finalMatch) : null;
    if (!w) return pool;
    changed = true;
    const champion: PoolChampion = {
      kind: "pair", playerIds: [...w], title: championTitle(pool), at: now,
    };
    return { ...pool, champion, status: "complete" as const };
  });
  return changed ? { ...s, pools } : s;
}

/* ── the Court 1 no-playoff path ─────────────────────────────────── */

/** No bracket here: raise the cap by one so everyone gets another match. */
export function declinePlayoff(s: AmericanoSession, poolId: string): AmericanoSession {
  const pool = s.pools.find((p) => p.id === poolId);
  if (!pool || pool.playoff) return s;
  return {
    ...s,
    pools: s.pools.map((p) =>
      p.id === poolId
        ? { ...p, playoffMode: "none" as const, status: "round_robin" as const,
            targetMatches: p.targetMatches + 1 }
        : p,
    ),
  };
}

/**
 * Ending a no-playoff court crowns the standings LEADER as an individual —
 * gated on rank 1 being genuinely settled, because a coin nobody ran must
 * never decide a champion.
 */
export function endCourtIndividual(
  s: AmericanoSession,
  poolId: string,
  now: number,
): { session: AmericanoSession; blocked: BlockingFlip[] } {
  const pool = s.pools.find((p) => p.id === poolId);
  if (!pool || pool.champion) return { session: s, blocked: [] };
  const blocked = unresolvedFlipsAffecting(pool, s.players, 1);
  if (blocked.length > 0) return { session: s, blocked };
  const leader = poolStandings(pool, s.players)[0];
  if (!leader) return { session: s, blocked: [] };
  const champion: PoolChampion = {
    kind: "individual", playerIds: [leader.playerId], title: championTitle(pool), at: now,
  };
  return {
    session: {
      ...s,
      pools: s.pools.map((p) =>
        p.id === poolId ? { ...p, champion, status: "complete" as const } : p),
    },
    blocked: [],
  };
}

/* ── the optional court borrow ───────────────────────────────────── */

/** Is the OTHER court free to host a semi in parallel? Offered, never forced. */
export function courtBorrowAvailable(s: AmericanoSession, poolId: string): boolean {
  const other = s.pools.find((p) => p.id !== poolId);
  if (!other) return false;
  const idle =
    other.status === "complete" ||
    other.playoffMode === "none" ||
    (other.status === "round_robin" && activeMatch(other) === undefined);
  return idle;
}
