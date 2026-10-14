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

/** Display order and labels for the Sheet's division codes. */
export const DIVISIONS: { code: string; label: string; short: string }[] = [
  { code: "M1", label: "Men's Division 1", short: "Men's 1" },
  { code: "M2", label: "Men's Division 2", short: "Men's 2" },
  { code: "W", label: "Women's Division", short: "Women's" },
];

export const divisionLabel = (code: string): string =>
  DIVISIONS.find((d) => d.code === code)?.label ?? code;

/** "David G" → "David G.", "Benson E." stays, "Saga" stays. */
export const displayName = (raw: string): string => {
  const name = raw.trim().replace(/\s+/g, " ");
  return /\s[A-Za-z]$/.test(name) ? `${name}.` : name;
};

const CACHE_KEY = "pto-league-live-v1";
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

/** Table order: league points, then point difference, then wins, then name. */
export const sortTable = (rows: StandingRow[]): StandingRow[] =>
  [...rows].sort(
    (a, b) =>
      b.leaguePoints - a.leaguePoints ||
      b.diff - a.diff ||
      b.wins - a.wins ||
      displayName(a.player).localeCompare(displayName(b.player)),
  );

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
