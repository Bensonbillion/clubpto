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
  /**
   * One table per matchday, from that day's games only, keyed by session id
   * ("S03"). Added Oct 28 2026 so a single week can be shown and posted on
   * its own. Missing on a copy a browser saved before then.
   */
  weeks?: Record<string, StandingRow[]>;
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
 * Each matchday's own table: only that day's games, keyed by session id.
 * A player sits in the division of the games they played that day, not the
 * one the Players tab has now, so a player who moved divisions (Kalid, from
 * Riviera to Atlas on Oct 25) keeps their earlier weeks where they played
 * them. Only players with a game that day are in a week's table, and a
 * blank seat still counts for nobody.
 */
export const weeklyStandings = (
  players: readonly SheetPlayer[],
  matches: readonly SheetMatch[],
  pointsPerWin = 3,
  pointsPerLoss = 0,
): Record<string, StandingRow[]> => {
  const out: Record<string, StandingRow[]> = {};
  const sessions = [...new Set(matches.map((m) => m.sessionId).filter(Boolean))];
  for (const id of sessions) {
    const rows: StandingRow[] = [];
    for (const { code } of DIVISIONS) {
      const games = matches.filter((m) => m.sessionId === id && m.division === code);
      if (!games.length) continue;
      // Ranked again within this division and week: the rank computeStandings
      // gives is by the Players tab's division, which a mover no longer shares.
      const table = sortTable(
        computeStandings(players, games, pointsPerWin, pointsPerLoss)
          .filter((r) => r.matches > 0)
          .map((r) => ({ ...r, division: code, rank: 0 })),
      );
      table.forEach((r, i) => {
        const prev = table[i - 1];
        r.rank = prev && prev.leaguePoints === r.leaguePoints && prev.diff === r.diff && prev.pointsFor === r.pointsFor ? prev.rank : i + 1;
      });
      rows.push(...table);
    }
    if (rows.length) out[id] = rows;
  }
  return out;
};

/** The played matchdays that have a table of their own, in week order. */
export const weeksWithTables = (data: LeagueSnapshot): Matchday[] =>
  data.matchdays.filter((m) => (data.weeks?.[m.id]?.length ?? 0) > 0).sort((a, b) => a.week - b.week);

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

// Where the table comes from, quickest first. Changed Oct 15 2026, when a
// visitor could wait 17.6 s for a cold Sheet and the browser forgot the
// table after 5 minutes or in a new tab.
//
// 1. The copy this browser saved last time, shown at once whatever its age.
//    The table only changes after league Sunday, so the last copy is the
//    right thing to show while a newer one is fetched.
// 2. On a first visit, the copy the build baked in (/league-snapshot.json,
//    written by scripts/league-snapshot.mjs), raced against the network.
// 3. The network: /api/league, then the Sheet's web app directly.
//
// Then freshLeague() reads the network quietly whenever the saved copy is
// 5 minutes old or more, and the page swaps the newer table in.

const SAVE_KEY = "pto-league-live-v4";
const FRESH_MS = 5 * 60 * 1000;
const BAKED_URL = "/league-snapshot.json";

interface Saved {
  at: number;
  data: LeagueSnapshot;
}

const isSnapshot = (d: unknown): d is LeagueSnapshot =>
  !!d && Array.isArray((d as LeagueSnapshot).standings) && Array.isArray((d as LeagueSnapshot).matchdays);

/**
 * The saved copy, any age. Read through `window.localStorage` inside a
 * try/catch: private mode, blocked storage, a corrupt entry or no browser at
 * all (a Node test, a server render) all just mean there is no saved copy.
 */
const readSaved = (): Saved | null => {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved> | null;
    return saved && typeof saved.at === "number" && isSnapshot(saved.data) ? (saved as Saved) : null;
  } catch {
    return null;
  }
};

const save = (data: LeagueSnapshot, at: number) => {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ at, data }));
  } catch {
    // Private mode or storage full: the page just fetches again next time.
  }
};

/** The table this browser saw last, whatever its age, or null. Synchronous, for the first render. */
export const savedLeague = (): LeagueSnapshot | null => readSaved()?.data ?? null;

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

/** The answer /api/league gives, which the baked copy shares. */
const isReads = (body: { ok?: unknown; data?: { players?: unknown } } | null): boolean =>
  !!body && body.ok === true && Array.isArray(body.data?.players);

/**
 * The four reads. First from /api/league (api/league.js), which reads the
 * Sheet once and serves everyone the same copy from Vercel's edge (fresh for
 * five minutes, then served at once for up to a week while it refreshes);
 * if that isn't there (local dev) or fails, straight from the Sheet's web
 * app as before.
 */
const readSheet = async (): Promise<SheetReads> => {
  try {
    const res = await fetch("/api/league");
    const body = await res.json();
    if (isReads(body)) return body.data as SheetReads;
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

/** The four reads as the pages show them: the table, and the matchdays not cancelled. */
const toSnapshot = ({ players, matches, sessions: matchdays, config }: SheetReads): LeagueSnapshot => {
  const win = config?.pointsPerWin || 3;
  const loss = config?.pointsPerLoss || 0;
  const standings = computeStandings(players, matches, win, loss);
  return {
    standings: standings.filter((r) => r.player && DIVISIONS.some((d) => d.code === r.division)),
    matchdays: matchdays.filter((m) => m.status !== "Cancelled"),
    weeks: weeklyStandings(players, matches, win, loss),
  };
};

let network: Promise<LeagueSnapshot> | null = null;

/**
 * The network read, one at a time, shared by loadLeague, freshLeague and
 * every component on the page, so a page never asks twice at once. Saved
 * when it lands, even if a quicker copy is already showing.
 */
const readNetwork = (): Promise<LeagueSnapshot> => {
  if (!network) {
    network = readSheet()
      .then((reads) => {
        const data = toSnapshot(reads);
        save(data, Date.now());
        return data;
      })
      .finally(() => {
        network = null;
      });
  }
  return network;
};

/**
 * The copy the build baked in. It is a file next to the page, so there is
 * only one to fetch inside a browser. Its age is when the build read the
 * Sheet (0 if unknown), so it counts as old and gets refreshed.
 */
const readBaked = async (): Promise<Saved> => {
  if (typeof window === "undefined") throw new Error("no page to fetch the baked league table from");
  const res = await fetch(BAKED_URL);
  const body = await res.json();
  if (!isReads(body)) throw new Error("no baked league table");
  const at = Date.parse(body.fetchedAt);
  return { at: Number.isFinite(at) ? at : 0, data: toSnapshot(body.data as SheetReads) };
};

let first: Promise<LeagueSnapshot> | null = null;

/**
 * The quickest good copy of the table, shared by every component on the
 * page. The saved copy if there is one, at once, with no network wait.
 * Otherwise whichever lands first of the baked copy and the network read;
 * if the baked copy wins, the network read carries on and is saved when it
 * lands. Rejects only when neither gives a table.
 */
export const loadLeague = (): Promise<LeagueSnapshot> => {
  const saved = savedLeague();
  if (saved) return Promise.resolve(saved);
  if (!first) {
    first = new Promise<LeagueSnapshot>((resolve, reject) => {
      let done = false;
      let failed = 0;
      const lose = (e: unknown) => {
        failed += 1;
        if (failed === 2 && !done) reject(e);
      };
      readNetwork().then((data) => {
        if (done) return;
        done = true;
        resolve(data);
      }, lose);
      readBaked().then((baked) => {
        if (done) return;
        done = true;
        // The network may have saved a newer copy a moment ago; keep that.
        const now = readSaved();
        if (now && now.at >= baked.at) return resolve(now.data);
        save(baked.data, baked.at);
        resolve(baked.data);
      }, lose);
    }).finally(() => {
      first = null;
    });
  }
  return first;
};

/**
 * A newer table, when one is due. Null with no request while the saved copy
 * is under 5 minutes old. Otherwise the network read (shared if one is
 * already going), saved and returned. Null if that fails too, so whatever
 * is showing stays.
 */
export const freshLeague = async (): Promise<LeagueSnapshot | null> => {
  const saved = readSaved();
  // A copy saved before the weekly tables existed is out of date whatever its age.
  const age = saved && saved.data.weeks ? Date.now() - saved.at : Infinity;
  if (!network && age >= 0 && age < FRESH_MS) return null;
  try {
    return await readNetwork();
  } catch {
    return null;
  }
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
