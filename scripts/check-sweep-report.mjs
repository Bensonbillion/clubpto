#!/usr/bin/env node
// Did the exhaustive sweep actually run?
//
// The three sweeps in src/manage/engine/__tests__/mixing-sweep.test.ts are
// gated behind MANAGE_SWEEP, so without it vitest reports them SKIPPED and
// exits 0. A workflow step that only checked the exit code would be green
// having dealt no courts at all, which is the same vacuous green the gauntlet
// guards against when it asserts tsc resolved files (scripts/gauntlet.mjs).
//
// So this asserts the sweeps themselves rather than the absence of skips.
// Counting the file's passing tests would not do it: fifteen of the eighteen
// are the ungated block, so a file whose sweeps were skipped still reports a
// healthy-looking count, and any future `it.skip` elsewhere in the file would
// fail an otherwise good run. Naming them is the only check that cannot drift
// into meaninglessness (2026-09-12).
//
// It lives in a file rather than inline in the workflow because the names
// carry apostrophes and a shell single-quote cannot hold them.

import { readFileSync } from "node:fs";

/** The gated sweeps, by the titles they are registered under. */
const SWEEPS = [
  "A's and B's, one to twelve of each, at every target the room divides into",
  "beginners on the court too, one to five of them",
  "a walk-in or a leaver of each tier, at every game of the night",
];

const path = process.argv[2] ?? "sweep-report.json";
let report;
try {
  report = JSON.parse(readFileSync(path, "utf8"));
} catch (err) {
  // The realistic cause is vitest's --reporter=json or --outputFile drifting
  // in a future major, which is exactly the silent drift this file exists to
  // catch, so it says so rather than handing the reader a stack trace out of
  // node internals.
  console.error(
    `No readable sweep report at ${path}. Check vitest's --reporter=json and`
    + ` --outputFile flags, which is what writes it.\n  ${err.message}`,
  );
  process.exit(1);
}
const status = new Map(
  (report.testResults ?? [])
    .flatMap((file) => file.assertionResults ?? [])
    .map((test) => [test.title, test.status]),
);

const missing = SWEEPS.filter((title) => status.get(title) !== "passed");
if (missing.length > 0) {
  console.error(
    "The sweep proved nothing. These did not pass:\n  "
    + missing.map((t) => `${t} (${status.get(t) ?? "not reported"})`).join("\n  ")
    + "\n\nA skipped sweep usually means MANAGE_SWEEP did not reach vitest.",
  );
  process.exit(1);
}
console.log(`${SWEEPS.length} sweeps ran and passed.`);
