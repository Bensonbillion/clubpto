// Thin client for the league Apps Script web app. The Sheet is the source
// of truth; nothing is cached beyond the current screen.

export interface Player {
  id: string;
  name: string;
  division: string;
  status: string;
}

export interface Session {
  id: string;
  week: number;
  date: string;
  status: string;
  courts: number;
  notes: string;
}

export interface MatchRow {
  sessionId: string;
  division: string;
  round: number;
  court: string;
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number | null;
  scoreB: number | null;
}

export interface Bootstrap {
  players: Player[];
  sessions: Session[];
  sessionId: string;
  attendance: Record<string, string>;
  matches: MatchRow[];
}

// The /exec URL is not a secret: it does nothing without the passcode, which
// lives in the script's own properties. Kept here so there is no extra
// config step, overridable if the script is ever redeployed fresh.
export const API_URL: string =
  import.meta.env.VITE_LEAGUE_API_URL ||
  "https://script.google.com/macros/s/AKfycbwrnmlqcOdzfw5YNTX-xQyK5P3aS08j6-ZHmrhMGB4OEoynAvZ8BBBCspESIz4SBCsriQ/exec";

const unwrap = async (res: Response) => {
  const body = await res.json();
  if (!body || body.ok !== true) {
    throw new Error((body && body.error) || "The Sheet said no.");
  }
  return body.data;
};

export const fetchBootstrap = async (sessionId?: string): Promise<Bootstrap> => {
  const qs = new URLSearchParams({ type: "bootstrap" });
  if (sessionId) qs.set("session", sessionId);
  return unwrap(await fetch(`${API_URL}?${qs}`));
};

/**
 * Posted as text/plain on purpose. It is a CORS safelisted content type, so
 * the browser sends it without a preflight, which an Apps Script web app
 * cannot answer. The body is still JSON.
 */
const post = async (payload: Record<string, unknown>, passcode: string) => {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, passcode }),
  });
  return unwrap(res);
};

export const saveAttendance = (
  sessionId: string,
  entries: { playerId: string; status: "In" | "Out" }[],
  passcode: string,
) => post({ action: "setAttendance", sessionId, entries }, passcode);

export const saveFixtures = (
  sessionId: string,
  fixtures: {
    division: string;
    round: number;
    court: string;
    teamA: [string, string];
    teamB: [string, string];
  }[],
  passcode: string,
) => post({ action: "createFixtures", sessionId, fixtures }, passcode);

export const saveScore = (
  match: {
    sessionId: string;
    division: string;
    round: number;
    court: string;
    teamA: [string, string];
    teamB: [string, string];
  },
  scoreA: number,
  scoreB: number,
  passcode: string,
) => post({ action: "recordScore", ...match, scoreA, scoreB }, passcode);
