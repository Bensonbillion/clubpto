// Court Manager v2 — the pace engine (§8).
//
// Connective tissue between games-first promises and the clock. Pure functions:
// duration logging, rolling average of measured reality, projection against the
// hard stop. The engine WARNS — the human presses the button.

import type { PaceProjection, PaceState } from "./types";

export function createPaceState(assumedGameMs: number, minSamples = 4): PaceState {
  return { samples: [], assumedGameMs, minSamples };
}

export interface PauseInterval {
  start: number;
  /** null while the pause is still active. */
  end: number | null;
}

/** Milliseconds of [startedAt, completedAt] covered by pauses — frozen time doesn't count as game duration (§8). */
export function pausedOverlapMs(startedAt: number, completedAt: number, pauses: PauseInterval[]): number {
  let total = 0;
  for (const p of pauses) {
    const end = p.end ?? completedAt;
    total += Math.max(0, Math.min(completedAt, end) - Math.max(startedAt, p.start));
  }
  return total;
}

/** Log a completed game's measured duration. Ignores nonsense (clock skew). */
export function recordGameDuration(pace: PaceState, startedAt: number, completedAt: number): PaceState {
  const ms = completedAt - startedAt;
  const MIN_SANE = 2 * 60_000;
  const MAX_SANE = 40 * 60_000;
  if (ms < MIN_SANE || ms > MAX_SANE) return pace;
  return { ...pace, samples: [...pace.samples, ms] };
}

/** Rolling average of actual durations; assumed value until enough real data. */
export function avgGameMs(pace: PaceState): { value: number; usingMeasured: boolean } {
  if (pace.samples.length < pace.minSamples) {
    return { value: pace.assumedGameMs, usingMeasured: false };
  }
  const sum = pace.samples.reduce((a, b) => a + b, 0);
  return { value: sum / pace.samples.length, usingMeasured: true };
}

export interface ProjectionInput {
  nowMs: number;
  /** Round-robin games not yet completed (including in-flight). */
  gamesRemaining: number;
  /** Courts running those games concurrently. */
  courts: number;
  hardStopAt: number;
  playoffBudgetMs: number;
  pace: PaceState;
}

export function projectFinish(input: ProjectionInput): PaceProjection {
  const { value, usingMeasured } = avgGameMs(input.pace);
  const slotsRemaining = Math.ceil(input.gamesRemaining / Math.max(1, input.courts));
  const projectedFinishAt = input.nowMs + slotsRemaining * value + input.playoffBudgetMs;
  const overrunMs = projectedFinishAt - input.hardStopAt;
  return {
    avgGameMs: value,
    usingMeasured,
    projectedFinishAt,
    hardStopAt: input.hardStopAt,
    overrunMs,
    fits: overrunMs <= 0,
  };
}

export interface DecisionPoint {
  projection: PaceProjection;
  /** "play" = the next round fits; "jump" = it projects past the hard stop. */
  recommendation: "play" | "jump";
  message: string;
}

/**
 * The round-boundary decision (§6): would playing the next round, plus
 * playoffs, still land before the hard stop? Information, not action —
 * the admin decides.
 */
export function roundBoundaryDecision(input: ProjectionInput & { nextRoundLabel: string }): DecisionPoint {
  const projection = projectFinish(input);
  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  const mins = Math.round(Math.abs(projection.overrunMs) / 60_000);
  const avgMin = (projection.avgGameMs / 60_000).toFixed(1);
  const message = projection.fits
    ? `Averaging ${avgMin} min/game — ${input.nextRoundLabel} plus playoffs projects to finish ${fmt(projection.projectedFinishAt)}, ${mins} min before the ${fmt(projection.hardStopAt)} hard stop.`
    : `Averaging ${avgMin} min/game — ${input.nextRoundLabel} plus playoffs projects to finish ${fmt(projection.projectedFinishAt)}, ${mins} min PAST the ${fmt(projection.hardStopAt)} hard stop.`;
  return { projection, recommendation: projection.fits ? "play" : "jump", message };
}

/** Measured per-venue average for the session archive — sharpens next week's setup. */
export function sessionAverageMs(pace: PaceState): number | null {
  if (pace.samples.length === 0) return null;
  return pace.samples.reduce((a, b) => a + b, 0) / pace.samples.length;
}
