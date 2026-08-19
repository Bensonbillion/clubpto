// Turns the curated roster seed SQL into a TypeScript module the app bundles.
//
// The seed file is the only human-curated list of real club members that
// exists. It was built by hand from pair_history: NATO-alphabet test names
// dropped, annotation variants folded, lookalike spellings that co-occurred
// on the same night deliberately kept apart. That curation is worth more than
// anything we could re-derive at runtime, so it becomes a build artifact
// instead of a query.
//
// Run: node scripts/gen-manage-roster.mjs
//
// Deterministic on purpose. Two people on two machines running this against
// the same SQL must produce byte-identical output, or the generated file
// churns in every diff and stops being reviewable. That is why the sort names
// an explicit "en" locale rather than trusting the host's default collation,
// and why ties fall back to playerId instead of leaving the order to the
// sort's stability guarantees.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "src/clubhouse/migrations/002_roster_seed.sql");
const TARGET = path.join(ROOT, "src/manage/roster/names.ts");

/**
 * Pull the value tuples out of the seed's INSERT.
 *
 * The file is not only tuples: it opens with a long comment block explaining
 * the curation, and it closes with `on conflict ... do update` plus a
 * `select count(*)`. Slicing between the `values` keyword and `on conflict`
 * keeps the parse honest, so a future edit to either the header or the footer
 * cannot leak a stray match into the roster.
 */
function extractTuples(sql) {
  // Comment lines are dropped first. The header quotes example names, and
  // although today it quotes them with double quotes, a future editor writing
  // 'kayode (C)' with single quotes would otherwise become a roster entry.
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  const start = withoutComments.search(/\bvalues\b/i);
  if (start === -1) throw new Error("No `values` keyword found in the seed SQL.");
  const rest = withoutComments.slice(start);
  const end = rest.search(/\bon\s+conflict\b/i);
  const body = end === -1 ? rest : rest.slice(0, end);

  // SQL escapes a literal apostrophe by doubling it, so a name is any run of
  // non-quote characters or doubled quotes. O'Brien would arrive as 'O''Brien'.
  const tuple = /\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*\)/g;
  const rows = [];
  for (const m of body.matchAll(tuple)) {
    rows.push({
      playerId: m[1].replace(/''/g, "'").trim(),
      displayName: m[2].replace(/''/g, "'").trim(),
    });
  }
  return rows;
}

function main() {
  const sql = fs.readFileSync(SOURCE, "utf8");
  const rows = extractTuples(sql);
  if (rows.length === 0) throw new Error("Parsed zero roster tuples. Refusing to write an empty roster.");

  // A duplicate id in the seed would mean the curation contradicts itself, and
  // silently keeping one of the two would hide that. Fail loudly instead.
  const seen = new Map();
  for (const row of rows) {
    if (!row.playerId || !row.displayName) {
      throw new Error(`Blank field in tuple: ${JSON.stringify(row)}`);
    }
    if (seen.has(row.playerId)) {
      throw new Error(`Duplicate playerId in the seed SQL: ${row.playerId}`);
    }
    seen.set(row.playerId, row.displayName);
  }

  rows.sort(
    (a, b) =>
      a.displayName.localeCompare(b.displayName, "en") ||
      a.playerId.localeCompare(b.playerId, "en"),
  );

  const entries = rows
    .map((r) => `  { playerId: ${JSON.stringify(r.playerId)}, displayName: ${JSON.stringify(r.displayName)} },`)
    .join("\n");

  const file = `// GENERATED FILE. Do not edit by hand.
//
// Generator: scripts/gen-manage-roster.mjs
// Source:    src/clubhouse/migrations/002_roster_seed.sql
//
// Edit the seed SQL, re-run the generator, commit both.
//
// WHY THE ROSTER IS BUNDLED INTO THE APP
//
// A live night runs on one phone in a loud room with the club's wifi
// somewhere between bad and absent, and the manager's door is a passcode, so
// there is no auth session to read the club's table with. If step 2 of the
// wizard asked the network who plays here, the night would stall before the
// first serve. So the roster ships with the build. The remote list in
// clubhouse_roster is a refresh layered on top of these names, never the
// thing they depend on, and every path through src/manage/roster/source.ts
// starts from this array.
//
// Sorted by displayName using localeCompare with an explicit "en" locale, so
// the order is identical on every machine that regenerates it.

export interface RosterName {
  readonly playerId: string;
  readonly displayName: string;
}

export const BUNDLED_ROSTER: readonly RosterName[] = [
${entries}
];
`;

  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, file, "utf8");
  console.log(`Wrote ${rows.length} roster names to ${path.relative(ROOT, TARGET)}`);
}

main();
