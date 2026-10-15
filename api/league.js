// GET /api/league: the league Sheet's four public reads (players, matches,
// sessions, config) in one response, kept at Vercel's edge for the week.
//
// Why: the public pages used to make those four calls to the Apps Script
// web app from every visitor's phone. Each call takes 1 to 3 seconds and
// Apps Script only runs so many at once, so a busy evening (an Instagram
// story, a matchday) could fail one of them and blank the table. Through
// here the Sheet is read at most about once every five minutes, whoever is
// visiting, and a visitor gets the stored copy straight from the edge. The
// page still falls back to calling the Sheet directly if this ever fails
// (src/site/leagueLive.ts).
//
// How long the edge keeps it (changed Oct 15 2026): the table only changes
// once a week, after league Sunday's scores go in, and a cold Sheet took
// 17.6 s to answer that day. The old 15 minutes of stale-while-revalidate
// meant anyone arriving after a quiet 20 minutes waited for it. Now a copy
// is fresh for 5 minutes, and for a week after that the edge answers with
// its last copy at once while it fetches a new one in the background, so
// Sunday's scores still show within minutes of a visit. vercel.json gives
// this function 30 s, so a cold read of 17 s or more can finish.
//
// readLeague is also what the build uses to bake a copy into the site
// (scripts/league-snapshot.mjs), for first visits after a deploy, when the
// edge starts empty.
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
    // Fresh for 5 minutes at the edge; after that, for up to a week (the
    // table changes weekly), serve the last copy at once while a new one is
    // fetched in the background.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=604800");
    res.status(200).json({ ok: true, data, fetchedAt: new Date().toISOString() });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ ok: false, error: "league sheet unavailable" });
  }
}
