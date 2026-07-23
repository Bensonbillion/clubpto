// Court Manager v3 — pace measurement.
//
// Pure functions that measure how long games actually take (rolling average of
// real durations, excluding paused time). There is NO hard-stop deadline — the
// admin decides when to jump to playoffs; the average is shown as information.

import type { PaceState } from "./types";

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

/** Measured per-venue average for the session archive — sharpens next week's setup. */
export function sessionAverageMs(pace: PaceState): number | null {
  if (pace.samples.length === 0) return null;
  return pace.samples.reduce((a, b) => a + b, 0) / pace.samples.length;
}
