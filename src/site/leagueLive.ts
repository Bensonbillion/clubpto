// Live PTO League data for the public pages.
//
// Read-only. The league's Google Sheet is the source of truth, written by
// /league/admin courtside and exposed by the same Apps Script web app
// (scripts/league-apps-script/Code.gs). The public pages only ever GET
// `type=standings` and `type=sessions`; writes need the admin passcode and
// never happen here.
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
): StandingRow => ({
  rank,
  playerId,
  player,
  division: "M1",
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
 * Tables Benson sent before the Sheet had the scores. A division's manual
 * table is used only while the Sheet has no results for that division; the
 * moment scores land in /league/admin, the Sheet wins and this goes quiet.
 * Delete an entry once its division is live in the Sheet.
 */
export const MANUAL_STANDINGS: Record<string, { asOf: string; rows: StandingRow[] }> = {
  M1: {
    asOf: "After Week 1",
    rows: [
      row(1, "M01", "David G", 5, 0, 15, 9),
      row(2, "M05", "Folarin A.", 3, 2, 9, 2),
      row(3, "M06", "Tami O.", 2, 3, 6, 0),
      row(4, "M08", "Lewis", 2, 3, 6, -4),
      row(5, "M02", "Benson E.", 2, 3, 6, -4),
      row(6, "M03", "Edgar A.", 1, 4, 3, -4),
    ],
  },
};

/** The Sheet's rows, with a manual table standing in for any division not yet scored there. */
export const mergeManual = (rows: StandingRow[]): StandingRow[] => {
  let out = rows;
  for (const [code, manual] of Object.entries(MANUAL_STANDINGS)) {
    const sheetHasResults = rows.some((r) => r.division === code && r.matches > 0);
    if (!sheetHasResults) out = [...out.filter((r) => r.division !== code), ...manual.rows];
  }
  return out;
};

/**
 * "After Week 1" while a division is showing its manual table, else null.
 * Pass the Sheet's own rows (before mergeManual).
 */
export const manualAsOf = (sheetRows: StandingRow[], code: string): string | null => {
  const manual = MANUAL_STANDINGS[code];
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

const CACHE_KEY = "pto-league-live-v2";
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

const get = async <T,>(type: string): Promise<T> => {
  const res = await fetch(`${API_URL}?type=${type}`);
  const body = await res.json();
  if (!body || body.ok !== true) throw new Error("league sheet unavailable");
  return body.data as T;
};

let inflight: Promise<LeagueSnapshot> | null = null;

/** One request pair per visit, shared by every component on the page. */
export const loadLeague = (): Promise<LeagueSnapshot> => {
  const cached = readCache();
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = Promise.all([get<StandingRow[]>("standings"), get<Matchday[]>("sessions")])
      .then(([standings, matchdays]) => {
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
 * Table order: league points, then point difference, then wins, then the
 * Sheet's (or Benson's) own rank, then name.
 */
export const sortTable = (rows: StandingRow[]): StandingRow[] =>
  [...rows].sort(
    (a, b) =>
      b.leaguePoints - a.leaguePoints ||
      b.diff - a.diff ||
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
