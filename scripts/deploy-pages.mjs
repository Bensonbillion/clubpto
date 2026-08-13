#!/usr/bin/env node
/**
 * Ship main to GitHub Pages — the whole procedure, so none of it lives in
 * someone's memory on a Wednesday evening.
 *
 * Two traps this encodes:
 *   1. The build MUST carry --base=/clubpto/. Without it Vite writes
 *      root-relative /assets/ paths and Pages serves a blank page. This cost
 *      real time on 2026-08-13.
 *   2. Pages needs a 404.html standing in for index.html or every deep link
 *      (/clubpto/manage4 among them) 404s on refresh. vite.config.ts emits it;
 *      this script refuses to publish a build that somehow lacks one.
 *
 * It publishes by checking gh-pages out into a throwaway worktree, replacing
 * its contents with dist/, and pushing — no extra dependency, and the diff is
 * a normal commit you can read afterwards.
 *
 * Usage:  npm run deploy:pages          (asks nothing, publishes main)
 *         npm run deploy:pages -- --dry (build and verify, publish nothing)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "/clubpto/";
const BRANCH = "gh-pages";
const DRY = process.argv.includes("--dry");

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: "pipe", ...opts });
const say = (s) => process.stdout.write(`${s}\n`);
const die = (s) => { process.stderr.write(`\n✗ ${s}\n`); process.exit(1); };

/* ── refuse to ship something you cannot name ─────────────────────── */

if (run("git", ["status", "--porcelain"]).trim() && !DRY) {
  die("working tree is dirty. Commit or stash first — a deploy should be a\n" +
      "  named commit you can point at, not whatever happened to be on disk.");
}
const sha = run("git", ["rev-parse", "--short", "HEAD"]).trim();
const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
say(`building ${branch} @ ${sha} with --base=${BASE}`);

/* ── build ────────────────────────────────────────────────────────── */

run("npx", ["vite", "build", `--base=${BASE}`], { stdio: "inherit" });

const dist = path.join(ROOT, "dist");
const indexHtml = path.join(dist, "index.html");
if (!fs.existsSync(indexHtml)) die("no dist/index.html — the build produced nothing.");

const html = fs.readFileSync(indexHtml, "utf8");
if (!html.includes(`${BASE}assets/`)) {
  die(`dist/index.html does not reference ${BASE}assets/ — the base flag did not\n` +
      "  take, and this build would serve a blank page. Not publishing.");
}
if (!fs.existsSync(path.join(dist, "404.html"))) {
  die("dist/404.html is missing — every deep link would 404 on refresh.\n" +
      "  vite.config.ts should emit it; check the spaFallback plugin.");
}
say(`✓ assets are ${BASE}assets/, 404.html present`);

if (DRY) { say("\n--dry: built and verified, published nothing."); process.exit(0); }

/* ── publish ──────────────────────────────────────────────────────── */

const work = fs.mkdtempSync(path.join(os.tmpdir(), "clubpto-pages-"));
try {
  try {
    run("git", ["worktree", "add", "--force", work, BRANCH]);
  } catch {
    run("git", ["worktree", "add", "--force", "-b", BRANCH, work]);
  }

  // Replace the published tree wholesale — stale files from an older deploy
  // are exactly how a retired design keeps haunting returning devices.
  for (const entry of fs.readdirSync(work)) {
    if (entry === ".git") continue;
    fs.rmSync(path.join(work, entry), { recursive: true, force: true });
  }
  fs.cpSync(dist, work, { recursive: true });

  run("git", ["add", "-A"], { cwd: work });
  const staged = run("git", ["status", "--porcelain"], { cwd: work }).trim();
  if (!staged) {
    say("published tree is already identical — nothing to push.");
  } else {
    run("git", ["commit", "-m", `deploy: ${branch} @ ${sha}`], { cwd: work });
    run("git", ["push", "origin", BRANCH], { cwd: work, stdio: "inherit" });
    say(`✓ pushed ${BRANCH}`);
  }
} finally {
  run("git", ["worktree", "remove", "--force", work]);
}

say(`
Now verify the LIVE artifact, not this log:
  curl -s https://bensonbillion.github.io/clubpto/ | grep -o '${BASE}assets/[^"]*' | head -3
  curl -so /dev/null -w '%{http_code}\\n' https://bensonbillion.github.io/clubpto/manage4
Pages can take a minute. The second must not be 404.`);
