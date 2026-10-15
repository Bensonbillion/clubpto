// After `vite build`: bake the current league table into the site as
// dist/league-snapshot.json, in the same shape /api/league answers with
// ({ ok, data: { players, matches, sessions, config }, fetchedAt }).
//
// Why (Oct 15 2026): every deploy starts the edge copy of /api/league over,
// and the next visitor then waited for the Sheet, up to 17.6 s cold. A
// first-time visitor's browser races this file against /api/league
// (src/site/leagueLive.ts), so they see a real table straight away and the
// live one swaps in when it lands. A returning visitor never needs it: their
// browser shows the table it saved last time.
//
// The build must never fail or hang on the Sheet. Any error, or no answer
// within the timeout, writes nothing and the build carries on; the site then
// works exactly as it did before this file existed.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeague } from "../api/league.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Reads the league with `read` (the same reads /api/league makes) and writes
 * it to `outFile`. True when the file was written; false on any error or
 * when `read` takes longer than `timeoutMs`, with nothing written. Never
 * throws.
 */
export const writeSnapshot = async ({ outFile, read = readLeague, timeoutMs = 30000 }) => {
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no answer from the Sheet in ${timeoutMs} ms`)), timeoutMs);
    });
    const data = await Promise.race([Promise.resolve().then(() => read()), timeout]);
    if (!data || !Array.isArray(data.players)) throw new Error("the Sheet answered without a league table");
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify({ ok: true, data, fetchedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outFile = join(root, "dist", "league-snapshot.json");
  writeSnapshot({ outFile })
    .then((written) => {
      console.log(
        written
          ? "league-snapshot: written dist/league-snapshot.json"
          : "league-snapshot: skipped (the Sheet did not answer); first visits wait for /api/league as before",
      );
    })
    .catch(() => {
      console.log("league-snapshot: skipped");
    })
    // Always 0, and right away: a hung Sheet read can leave a socket open
    // that would otherwise keep the build waiting.
    .finally(() => process.exit(0));
}
