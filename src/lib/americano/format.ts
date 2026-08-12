// PTO Americano v4 — match format (STEP F).
//
// Format is a per-pool, setup-time choice: best of N games, or a single game
// to a target. The engine above this file is format-BLIND — selection,
// variety, the wave property, the standings chain, SOS and the coin all
// consume a differential and never ask where it came from. This module is
// the only place that knows.
//
// Nothing hard-codes a score alphabet. A best-of-N win needs ⌈N/2⌉ games, so
// the entry buttons and the log notation are generated from `sets`: two
// buttons at best of 3, three at best of 5. At best of 3 the differential
// reduces to exactly the original ±2 / ±1 — that reduction is the
// backward-compatibility proof, and it is asserted in the suite.

import type {
  AmericanoMatch, AmericanoPool, AmericanoResult, AmericanoSession, MatchFormat,
} from "@/types/americano";
import { isSingleGameResult } from "@/types/americano";

export const DEFAULT_FORMAT: MatchFormat = { kind: "bestOf", sets: 3 };

/** Targets a single game may be played to. */
export const MIN_TARGET_POINTS = 4;
export const MAX_TARGET_POINTS = 15;
export const DEFAULT_TARGET_POINTS = 7;

export const validTargetPoints = (): number[] =>
  Array.from(
    { length: MAX_TARGET_POINTS - MIN_TARGET_POINTS + 1 },
    (_, i) => MIN_TARGET_POINTS + i,
  );

/** Games needed to win a best-of-N. */
export const setsToWin = (sets: number): number => Math.ceil(sets / 2);

export function isValidFormat(f: MatchFormat): boolean {
  if (f.kind === "bestOf") return f.sets === 3 || f.sets === 5;
  return (
    Number.isInteger(f.targetPoints) &&
    f.targetPoints >= MIN_TARGET_POINTS &&
    f.targetPoints <= MAX_TARGET_POINTS
  );
}

export const sameFormat = (a: MatchFormat, b: MatchFormat): boolean =>
  a.kind === b.kind &&
  (a.kind === "bestOf"
    ? a.sets === (b as { sets: number }).sets
    : a.targetPoints === (b as { targetPoints: number }).targetPoints);

export function formatLabel(f: MatchFormat): string {
  return f.kind === "bestOf" ? `Best of ${f.sets}` : `Game to ${f.targetPoints}`;
}

/** The format a given match was played in: its own override, else its pool's. */
export function matchFormatOf(pool: AmericanoPool, match: AmericanoMatch): MatchFormat {
  return match.format ?? pool.matchFormat ?? DEFAULT_FORMAT;
}

/* ── entry: the second row of buttons, generated from the format ── */

export interface EntryOption {
  /** What the button says — "2–1", "3–2", "4" (a single game's loser score). */
  label: string;
  /** The result this button records, minus the winner. */
  value: { setsLost: number } | { loserPoints: number };
}

export function entryOptions(f: MatchFormat): EntryOption[] {
  if (f.kind === "bestOf") {
    const won = setsToWin(f.sets);
    return Array.from({ length: won }, (_, lost) => ({
      label: `${won}–${lost}`,
      value: { setsLost: lost },
    }));
  }
  return Array.from({ length: f.targetPoints }, (_, points) => ({
    label: String(points),
    value: { loserPoints: points },
  }));
}

/** How a recorded result reads in its own notation: "2–1", "3–2", "7–4". */
export function resultNotation(f: MatchFormat, r: AmericanoResult): string {
  if (isSingleGameResult(r)) return `${f.kind === "singleGame" ? f.targetPoints : "?"}–${r.loserPoints}`;
  const won = f.kind === "bestOf" ? setsToWin(f.sets) : 2;
  return `${won}–${r.setsLost}`;
}

/* ── the differential ────────────────────────────────────────────── */

/**
 * What a result is worth to the winners and the losers.
 *
 * Best of N: games won − games lost. At best of 3 that is +2 / +1 and −1 /
 * −2, identical to the original hard-coded rule.
 * Single game to T: ±(T − the loser's score), so a 7–0 is ±7 and a 7–6 is ±1.
 */
export function resultDiff(
  f: MatchFormat,
  r: AmericanoResult,
): { win: number; loss: number } {
  if (isSingleGameResult(r)) {
    const target = f.kind === "singleGame" ? f.targetPoints : DEFAULT_TARGET_POINTS;
    const margin = target - r.loserPoints;
    return { win: margin, loss: -margin };
  }
  const won = f.kind === "bestOf" ? setsToWin(f.sets) : 2;
  const margin = won - r.setsLost;
  return { win: margin, loss: -margin };
}

/* ── the lock ────────────────────────────────────────────────────── */

/**
 * A pool's format is mutable only until it has recorded a result. Voided
 * results count as recorded: the simplest honest rule is that a format
 * mistake caught after play started means void the match, change the format,
 * and replay it — rather than leaving a night with two meanings of "+2".
 */
export function isFormatLocked(pool: AmericanoPool): boolean {
  return pool.matches.some((m) => m.result !== null);
}

/** Change a pool's format. Rejected (identity) once the pool is locked or
    the format is not one we can play. */
export function setPoolFormat(
  s: AmericanoSession,
  poolId: string,
  format: MatchFormat,
): AmericanoSession {
  if (!isValidFormat(format)) return s;
  const pool = s.pools.find((p) => p.id === poolId);
  if (!pool || isFormatLocked(pool)) return s;
  if (sameFormat(pool.matchFormat ?? DEFAULT_FORMAT, format)) return s;
  return {
    ...s,
    pools: s.pools.map((p) => (p.id === poolId ? { ...p, matchFormat: format } : p)),
  };
}

/** Set the session default and carry it to every pool that is still free to
    take it — the courts stay in step until one is deliberately overridden. */
export function setDefaultFormat(s: AmericanoSession, format: MatchFormat): AmericanoSession {
  if (!isValidFormat(format)) return s;
  return {
    ...s,
    defaultMatchFormat: format,
    pools: s.pools.map((p) => (isFormatLocked(p) ? p : { ...p, matchFormat: format })),
  };
}

/* ── the playoff hook (lib now, UI in Step 7) ────────────────────── */

/**
 * The format a bracket should be played in: the pool's own unless the confirm
 * screen overrides it. Step 7 stamps the result onto each bracket match, so a
 * playoff run in a different format still renders in its own notation.
 */
export function playoffFormat(pool: AmericanoPool, override?: MatchFormat): MatchFormat {
  if (override && isValidFormat(override)) return override;
  return pool.matchFormat ?? DEFAULT_FORMAT;
}

/** Stamp a bracket match with its format, but only when it differs from the
    pool's — an unnecessary override would be noise in the log. */
export function stampPlayoffFormat(
  match: AmericanoMatch,
  pool: AmericanoPool,
  override?: MatchFormat,
): AmericanoMatch {
  const format = playoffFormat(pool, override);
  if (sameFormat(format, pool.matchFormat ?? DEFAULT_FORMAT)) return match;
  return { ...match, format };
}
