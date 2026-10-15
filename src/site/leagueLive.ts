// Live PTO League data for the public pages.
//
// Read-only. The league's Google Sheet is the source of truth, written by
// /league/admin courtside and exposed by the same Apps Script web app
// (scripts/league-apps-script/Code.gs). The public pages only ever GET
// `type=players`, `type=matches`, `type=sessions` and `type=config`; writes
// need the admin passcode and never happen here.
//
// The table is worked out here from the Matches tab, with the Sheet's own
// rules (Config points per win and loss; order by league points, then point
// difference, then points for), rather than read from the Standings tab.
// The Sheet was rebuilt on 2026-10-13 and its Standings tab no longer has
// the columns `type=standings` expects, so that endpoint now returns
// headers and numbers in the wrong fields. Matches, Players, Sessions and
// Config kept their layout, so this stays right whatever Standings looks
// like. A blank name in a match counts for nobody: that is how a game a
// player should not be credited with (a sixth game) is recorded. Every
// match counts (Config's fairness basis is TOTAL, so its best-N setting
// is not in play).
//
// Names are shown exactly as the Sheet has them (first name, last initial),
// tidied so "David G" reads "David G.". Nothing beyond the table is shown:
// no phone numbers, no emails, no attendance.

import { API_URL } from "@/league/adminApi";

export interface StandingRow {
  rank: number;
  playerId: string;
  player: string;
  division: string;
  matches: number;
  wins: number;
  losses: number;
  winPct: number | null;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  leaguePoints: number;
}

export interface Matchday {
  id: string;
  week: number;
  date: string;
  status: string;
}

export interface LeagueSnapshot {
  standings: StandingRow[];
  matchdays: Matchday[];
}

/** One row of the Matches tab, as `type=matches` returns it. */
export interface SheetMatch {
  sessionId: string;
  division: string;
  round: number;
  court: string;
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number | null;
  scoreB: number | null;
}

/** One row of the Players tab, as `type=players` returns it. */
export interface SheetPlayer {
  id: string;
  name: string;
  division: string;
  status: string;
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The league table, one row per rostered player, from the scored matches.
 * Names that are blank or not on the roster count for nobody.
 */
export const computeStandings = (
  players: readonly SheetPlayer[],
  matches: readonly SheetMatch[],
  pointsPerWin = 3,
  pointsPerLoss = 0,
): StandingRow[] => {
  const byName = new Map<string, StandingRow>();
  for (const p of players) {
    if (!p.name.trim()) continue;
    byName.set(nameKey(p.name), {
      rank: 0,
      playerId: p.id,
      player: p.name.trim(),
      division: p.division.trim(),
      matches: 0,
      wins: 0,
      losses: 0,
      winPct: null,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      leaguePoints: 0,
    });
  }
  for (const m of matches) {
    if (m.scoreA === null || m.scoreB === null || m.scoreA === m.scoreB) continue;
    const sides: [readonly string[], number, number][] = [
      [m.teamA, m.scoreA, m.scoreB],
      [m.teamB, m.scoreB, m.scoreA],
    ];
    for (const [team, scored, conceded] of sides) {
      for (const name of team) {
        const r = name ? byName.get(nameKey(name)) : undefined;
        if (!r) continue;
        r.matches += 1;
        r.pointsFor += scored;
        r.pointsAgainst += conceded;
        if (scored > conceded) r.wins += 1;
        else r.losses += 1;
      }
    }
  }
  const rows = [...byName.values()].map((r) => ({
    ...r,
    winPct: r.matches ? r.wins / r.matches : null,
    diff: r.pointsFor - r.pointsAgainst,
    leaguePoints: r.wins * pointsPerWin + r.losses * pointsPerLoss,
  }));
  // Rank within each division, ties sharing a rank as on the Sheet.
  for (const div of new Set(rows.map((r) => r.division))) {
    const table = sortTable(rows.filter((r) => r.division === div));
    table.forEach((r, i) => {
      const prev = table[i - 1];
      r.rank = prev && prev.leaguePoints === r.leaguePoints && prev.diff === r.diff && prev.pointsFor === r.pointsFor ? prev.rank : i + 1;
    });
  }
  return rows;
};

/**
 * Display order and names for the Sheet's division codes (named by Benson,
 * Oct 14 2026). The Sheet keeps its codes; only the site shows the names.
 */
export const DIVISIONS: { code: string; label: string; short: string }[] = [
  { code: "M1", label: "Atlas Division", short: "Atlas" },
  { code: "M2", label: "Riviera Division", short: "Riviera" },
  { code: "W", label: "Venus Division", short: "Venus" },
];

/** "Atlas, Riviera, Venus" for the tiles and copy. */
export const divisionNames = (): string => DIVISIONS.map((d) => d.short).join(", ");

const row = (
  rank: number,
  playerId: string,
  player: string,
  wins: number,
  losses: number,
  leaguePoints: number,
  diff: number,
  division = "M1",
): StandingRow => ({
  rank,
  playerId,
  player,
  division,
  matches: wins + losses,
  wins,
  losses,
  winPct: wins + losses ? wins / (wins + losses) : null,
  pointsFor: 0,
  pointsAgainst: 0,
  diff,
  leaguePoints,
});

/**
 * Tables Benson sends before the Sheet has the scores. A division's manual
 * table is used only while the Sheet has no results for that division; the
 * moment scores land in /league/admin, the Sheet wins and this goes quiet.
 * Empty since 2026-10-14: Atlas Week 1 is in the Sheet now. To stand one
 * in again: `M2: { asOf: "After Week 1", rows: [row(1, "M07", "Omar", 3, 2, 9, 2, "M2")] }`.
 */
export const MANUAL_STANDINGS: Record<string, { asOf: string; rows: StandingRow[] }> = {};

/** For standing a manual table in (see above), and for the tests. */
export const manualRow = row;

/** The Sheet's rows, with a manual table standing in for any division not yet scored there. */
export const mergeManual = (rows: StandingRow[], tables = MANUAL_STANDINGS): StandingRow[] => {
  let out = rows;
  for (const [code, manual] of Object.entries(tables)) {
    const sheetHasResults = rows.some((r) => r.division === code && r.matches > 0);
    if (!sheetHasResults) out = [...out.filter((r) => r.division !== code), ...manual.rows];
  }
  return out;
};

/**
 * "After Week 1" while a division is showing its manual table, else null.
 * Pass the Sheet's own rows (before mergeManual).
 */
export const manualAsOf = (sheetRows: StandingRow[], code: string, tables = MANUAL_STANDINGS): string | null => {
  const manual = tables[code];
  if (!manual) return null;
  return sheetRows.some((r) => r.division === code && r.matches > 0) ? null : manual.asOf;
};

export const divisionLabel = (code: string): string =>
  DIVISIONS.find((d) => d.code === code)?.label ?? code;

/** "David G" → "David G.", "Benson E." stays, "Saga" stays. */
export const displayName = (raw: string): string => {
  const name = raw.trim().replace(/\s+/g, " ");
  return /\s[A-Za-z]$/.test(name) ? `${name}.` : name;
};

const CACHE_KEY = "pto-league-live-v3";
const CACHE_MS = 5 * 60 * 1000;

const readCache = (): LeagueSnapshot | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: LeagueSnapshot };
    return Date.now() - at < CACHE_MS ? data : null;
  } catch {
    return null;
  }
};

const writeCache = (data: LeagueSnapshot) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Private mode or storage full: the page just fetches again next time.
  }
};

/** One read from the Sheet's web app, tried twice (a cold call can drop). */
const get = async <T,>(type: string): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API_URL}?type=${type}`);
      const body = await res.json();
      if (body && body.ok === true) return body.data as T;
      lastError = new Error("league sheet unavailable");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
};

interface SheetConfig {
  pointsPerWin: number;
  pointsPerLoss: number;
}

interface SheetReads {
  players: SheetPlayer[];
  matches: SheetMatch[];
  sessions: Matchday[];
  config: SheetConfig;
}

/**
 * The four reads. First from /api/league (api/league.js), which reads the
 * Sheet once and serves everyone the same copy from Vercel's edge for five
 * minutes; if that isn't there (local dev) or fails, straight from the
 * Sheet's web app as before.
 */
const readSheet = async (): Promise<SheetReads> => {
  try {
    const res = await fetch("/api/league");
    const body = await res.json();
    if (body && body.ok === true && Array.isArray(body.data?.players)) return body.data as SheetReads;
  } catch {
    // fall through to the direct reads
  }
  const [players, matches, sessions, config] = await Promise.all([
    get<SheetPlayer[]>("players"),
    get<SheetMatch[]>("matches"),
    get<Matchday[]>("sessions"),
    get<SheetConfig>("config").catch(() => ({ pointsPerWin: 3, pointsPerLoss: 0 })),
  ]);
  return { players, matches, sessions, config };
};

let inflight: Promise<LeagueSnapshot> | null = null;

/** One set of requests per visit, shared by every component on the page. */
export const loadLeague = (): Promise<LeagueSnapshot> => {
  const cached = readCache();
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = readSheet()
      .then(({ players, matches, sessions: matchdays, config }) => {
        const standings = computeStandings(players, matches, config.pointsPerWin || 3, config.pointsPerLoss || 0);
        const data: LeagueSnapshot = {
          standings: standings.filter((r) => r.player && DIVISIONS.some((d) => d.code === r.division)),
          matchdays: matchdays.filter((m) => m.status !== "Cancelled"),
        };
        writeCache(data);
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

/**
 * Table order, the Sheet's own: league points, then point difference, then
 * points for. Then wins, a manual table's own rank, and name, so the order
 * never depends on row order.
 */
export const sortTable = (rows: StandingRow[]): StandingRow[] =>
  [...rows].sort(
    (a, b) =>
      b.leaguePoints - a.leaguePoints ||
      b.diff - a.diff ||
      b.pointsFor - a.pointsFor ||
      b.wins - a.wins ||
      a.rank - b.rank ||
      displayName(a.player).localeCompare(displayName(b.player)),
  );

/** True once any score is in for one division. */
export const divisionHasResults = (rows: StandingRow[], code: string): boolean =>
  rows.some((r) => r.division === code && r.matches > 0);

export const byDivision = (rows: StandingRow[], code: string): StandingRow[] =>
  sortTable(rows.filter((r) => r.division === code));

/** True once any score has been entered for the season. */
export const hasResults = (rows: StandingRow[]): boolean => rows.some((r) => r.matches > 0);

export const matchdaysPlayed = (days: Matchday[]): number =>
  days.filter((d) => d.status === "Played").length;

/** The next matchday on or after today (Toronto date as YYYY-MM-DD). */
export const nextMatchday = (days: Matchday[], today: string): Matchday | undefined =>
  [...days].filter((d) => d.date >= today && d.status !== "Played").sort((a, b) => (a.date < b.date ? -1 : 1))[0];

export interface Leader {
  title: string;
  division: string;
  player: string;
  value: string;
}

/** Brodie-style leaders, once there are results: one card per division. */
export const leaders = (rows: StandingRow[]): Leader[] =>
  DIVISIONS.flatMap(({ code, short }) => {
    const table = byDivision(rows, code).filter((r) => r.matches > 0);
    if (!table.length) return [];
    const top = table[0];
    return [{ title: `${short} leader`, division: code, player: displayName(top.player), value: `${top.leaguePoints} pts` }];
  });

/** Whole days from today to a YYYY-MM-DD date (both Toronto calendar days). */
export const daysUntil = (ymd: string, today: string): number =>
  Math.round((Date.parse(`${ymd}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);

/** "Today", "Tomorrow", "In 4 days". */
export const countdownLabel = (ymd: string, today: string): string => {
  const d = daysUntil(ymd, today);
  if (d <= 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
};

/** The most recent matchday marked Played, if any. */
export const lastMatchday = (days: Matchday[]): Matchday | undefined =>
  [...days].filter((d) => d.status === "Played").sort((a, b) => (a.date < b.date ? 1 : -1))[0];

/** Every division leader, in the site's division order, for divisions with results. */
export const divisionLeaders = (rows: StandingRow[]) =>
  DIVISIONS.flatMap((d) => {
    const top = byDivision(rows, d.code).find((r) => r.matches > 0);
    return top ? [{ division: d, row: top }] : [];
  });
