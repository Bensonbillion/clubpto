// GET /api/league: the league Sheet's four public reads (players, matches,
// sessions, config) in one response, cached at Vercel's edge for five
// minutes.
//
// Why: the public pages used to make those four calls to the Apps Script
// web app from every visitor's phone. Each call takes 1 to 3 seconds and
// Apps Script only runs so many at once, so a busy evening (an Instagram
// story, a matchday) could fail one of them and blank the table. Through
// here the Sheet is read about once every five minutes, whoever is
// visiting, and a visitor gets the cached copy straight from the edge. The
// page still falls back to calling the Sheet directly if this ever fails
// (src/site/leagueLive.ts).
//
// Read-only, like the pages: only GET types the web app already serves.

const API_URL =
  process.env.VITE_LEAGUE_API_URL ||
  "https://script.google.com/macros/s/AKfycbwrnmlqcOdzfw5YNTX-xQyK5P3aS08j6-ZHmrhMGB4OEoynAvZ8BBBCspESIz4SBCsriQ/exec";

const TYPES = ["players", "matches", "sessions", "config"];

/** One read, tried twice: Apps Script sometimes drops a cold call. */
const readOne = async (type, doFetch) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await doFetch(`${API_URL}?type=${type}`, { redirect: "follow" });
      const body = await res.json();
      if (body && body.ok === true) return body.data;
    } catch {
      // try again
    }
  }
  throw new Error(`league ${type} unavailable`);
};

/** All four reads, or a throw if any of them is unavailable. */
export const readLeague = async (doFetch = fetch) => {
  const [players, matches, sessions, config] = await Promise.all(TYPES.map((t) => readOne(t, doFetch)));
  return { players, matches, sessions, config };
};

export default async function handler(req, res) {
  try {
    const data = await readLeague();
    // Fresh for 5 minutes at the edge; for 15 more, serve the last copy
    // while a new one is fetched in the background.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=900");
    res.status(200).json({ ok: true, data, fetchedAt: new Date().toISOString() });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ ok: false, error: "league sheet unavailable" });
  }
}
