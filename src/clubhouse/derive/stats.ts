// Clubhouse derived stats (MILE-1, DASH-3, PROF-2, CHW-2).
// Pure functions over published data. Computed at publish time, stored,
// then read — never computed per visitor (PIPE-6 / OPS-3).

import type { PublishBundle } from "../publish/types";

// ---------------------------------------------------------------------------
// Milestone clubs — persistence over performance (Parkrun model)
// ---------------------------------------------------------------------------

export const MILESTONE_TIERS = [10, 25, 50, 100] as const;

export interface MilestoneStatus {
  /** Clubs already earned, ascending. */
  earned: number[];
  /** The next club, or null past the top tier. */
  next: number | null;
  /** Sessions remaining to the next club (null when next is null). */
  toNext: number | null;
}

export function milestoneStatus(sessionsAttended: number): MilestoneStatus {
  const earned = MILESTONE_TIERS.filter((t) => sessionsAttended >= t);
  const next = MILESTONE_TIERS.find((t) => sessionsAttended < t) ?? null;
  return {
    earned: [...earned],
    next,
    toNext: next === null ? null : next - sessionsAttended,
  };
}

export function milestoneClubName(tier: number): string {
  return `The ${tier} Club`;
}

// ---------------------------------------------------------------------------
// Weekly attendance streaks — positive framing only (DASH-3).
// A week is Monday-Sunday; attending any session that week keeps the streak.
// ---------------------------------------------------------------------------

/** ISO week key like "2026-W32" for a YYYY-MM-DD date string. */
export function isoWeekKey(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this ISO week
  const year = d.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - jan1) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export interface StreakStatus {
  /** Consecutive weeks with attendance, counting back from the most recent attended week. */
  current: number;
  /** Longest run of consecutive attended weeks ever. */
  best: number;
}

export function weeklyStreaks(attendedDates: string[]): StreakStatus {
  if (attendedDates.length === 0) return { current: 0, best: 0 };
  const weeks = [...new Set(attendedDates.map(isoWeekKey))].sort();

  // Convert week keys to absolute week numbers for gap detection.
  const abs = weeks.map((w) => {
    const [y, wk] = w.split("-W").map(Number);
    return y * 53 + wk;
  });

  let best = 1;
  let run = 1;
  for (let i = 1; i < abs.length; i++) {
    run = abs[i] - abs[i - 1] === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  // Current streak counts back from the latest attended week.
  let current = 1;
  for (let i = abs.length - 1; i > 0; i--) {
    if (abs[i] - abs[i - 1] === 1) current++;
    else break;
  }
  return { current, best };
}

// ---------------------------------------------------------------------------
// Rivalries — auto-detected head-to-head series (PROF-2)
// ---------------------------------------------------------------------------

export interface Rivalry {
  playerA: string; // player id
  playerB: string; // player id
  meetings: number;
  winsA: number;
  winsB: number;
}

export const RIVALRY_MIN_MEETINGS = 3;

/**
 * Player-vs-player series across published sessions: every game where A's pair
 * opposed B's pair counts as a meeting. Only visible (non-hidden) players can
 * appear, because hidden players carry no id in published pairs.
 */
export function detectRivalries(bundles: PublishBundle[]): Rivalry[] {
  const series = new Map<string, Rivalry>();

  for (const bundle of bundles) {
    if (bundle.practiceOnly) continue;
    const pairPlayers = new Map(
      bundle.pairs.map((p) => [
        p.pairId,
        p.players.map((ref) => ref.id).filter((id): id is string => Boolean(id)),
      ])
    );
    for (const result of bundle.results) {
      const winners = pairPlayers.get(result.winnerPairId) ?? [];
      const losers = pairPlayers.get(result.loserPairId) ?? [];
      for (const w of winners) {
        for (const l of losers) {
          const [a, b] = [w, l].sort();
          const key = `${a}|${b}`;
          const entry = series.get(key) ?? { playerA: a, playerB: b, meetings: 0, winsA: 0, winsB: 0 };
          entry.meetings++;
          if (w === a) entry.winsA++;
          else entry.winsB++;
          series.set(key, entry);
        }
      }
    }
  }

  return [...series.values()]
    .filter((r) => r.meetings >= RIVALRY_MIN_MEETINGS)
    .sort((a, b) => b.meetings - a.meetings);
}

// ---------------------------------------------------------------------------
// Records book (CHW-2) — the all-time numbers that give nights stakes
// ---------------------------------------------------------------------------

export interface PlayerTotals {
  playerId: string;
  sessions: number;
  games: number;
  wins: number;
  losses: number;
  championships: number;
  /** LB-4: sum of openly-published event points from titles won. */
  ptoPoints: number;
  longestWinStreak: number; // consecutive games won, all-time
}

export function playerTotals(bundles: PublishBundle[]): Map<string, PlayerTotals> {
  const totals = new Map<string, PlayerTotals>();
  const ensure = (id: string): PlayerTotals => {
    let t = totals.get(id);
    if (!t) {
      t = { playerId: id, sessions: 0, games: 0, wins: 0, losses: 0, championships: 0, ptoPoints: 0, longestWinStreak: 0 };
      totals.set(id, t);
    }
    return t;
  };
  const winRuns = new Map<string, number>();

  const ordered = [...bundles].sort((a, b) => a.session.date.localeCompare(b.session.date));
  for (const bundle of ordered) {
    const pairPlayers = new Map(
      bundle.pairs.map((p) => [
        p.pairId,
        p.players.map((ref) => ref.id).filter((id): id is string => Boolean(id)),
      ])
    );
    const attended = new Set<string>();
    for (const ids of pairPlayers.values()) ids.forEach((id) => attended.add(id));
    attended.forEach((id) => ensure(id).sessions++);

    if (bundle.practiceOnly) continue;

    const chronological = [...bundle.results].sort((a, b) => a.completedAt - b.completedAt);
    for (const result of chronological) {
      for (const id of pairPlayers.get(result.winnerPairId) ?? []) {
        const t = ensure(id);
        t.games++;
        t.wins++;
        const run = (winRuns.get(id) ?? 0) + 1;
        winRuns.set(id, run);
        if (run > t.longestWinStreak) t.longestWinStreak = run;
      }
      for (const id of pairPlayers.get(result.loserPairId) ?? []) {
        const t = ensure(id);
        t.games++;
        t.losses++;
        winRuns.set(id, 0);
      }
    }
    for (const champ of bundle.champions) {
      for (const ref of champ.pair.players) {
        if (ref.id) {
          const t = ensure(ref.id);
          t.championships++;
          t.ptoPoints += champ.points;
        }
      }
    }
    // Finalists earn points, never a championship (LB-4 half-rule).
    for (const finalist of bundle.finalists) {
      for (const ref of finalist.pair.players) {
        if (ref.id) ensure(ref.id).ptoPoints += finalist.points;
      }
    }
  }
  return totals;
}

/** Win% board qualifier (LB-1 owner decision): 8 games minimum. */
export const WINPCT_MIN_GAMES = 8;

export function winPct(t: PlayerTotals): number {
  return t.games === 0 ? 0 : t.wins / t.games;
}

/** Players eligible for the Win% board. Per-player opt-out applies upstream (LB-3). */
export function winPctEligible(totals: PlayerTotals[]): PlayerTotals[] {
  return totals.filter((t) => t.games >= WINPCT_MIN_GAMES);
}

/** Top-N by a metric — the ONLY ranked view the site may build (LB-1). */
export function topN<T>(items: T[], metric: (t: T) => number, n = 10): T[] {
  return [...items].sort((a, b) => metric(b) - metric(a)).slice(0, n);
}
