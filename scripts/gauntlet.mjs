#!/usr/bin/env node
// The gauntlet: every check that must pass before anything ships.
//
// It exists because the typecheck gate was silently VACUOUS for weeks. The
// root tsconfig.json carries "files": [] with project references, so plain
// `tsc --noEmit` compiles NOTHING and exits 0 — a green light that proved
// nothing at all. So this runner does not merely invoke tsc; it asserts that
// tsc actually resolved files, and fails loudly if it did not.

import { execSync, spawnSync } from "node:child_process";

const PROJECT = "tsconfig.app.json";

/** Errors tsc reports that predate this work and live in scope-guarded code. */
const KNOWN_PREEXISTING = ["src/court-manager/supabase.ts"];

const step = (name) => `\x1b[1m${name}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;

let failed = 0;
function run(name, cmd, { allow } = {}) {
  process.stdout.write(`${step(name)} … `);
  const r = spawnSync(cmd, { shell: true, encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status === 0 || allow?.(out, r.status)) {
    console.log(ok("pass"));
    return out;
  }
  failed++;
  console.log(bad("FAIL"));
  console.log(out.split("\n").slice(-25).join("\n"));
  return out;
}

// 1. TYPECHECK — and prove it actually looked at something.
process.stdout.write(`${step("typecheck: tsc resolves files")} … `);
const listed = execSync(`npx tsc -p ${PROJECT} --listFilesOnly 2>/dev/null || true`, {
  encoding: "utf8",
});
const resolved = listed.split("\n").filter((l) => l.includes("/src/")).length;
if (resolved === 0) {
  failed++;
  console.log(bad("FAIL — tsc resolved ZERO project files; the gate is vacuous"));
} else {
  console.log(ok(`pass (${resolved} files)`));
}

run("typecheck: no new errors", `npx tsc --noEmit -p ${PROJECT}`, {
  allow: (out) => {
    const errs = out.split("\n").filter((l) => l.includes("error TS"));
    const fresh = errs.filter((l) => !KNOWN_PREEXISTING.some((f) => l.includes(f)));
    if (fresh.length === 0 && errs.length > 0) {
      console.log(ok(`(${errs.length} known pre-existing, in scope-guarded code)`));
    }
    return fresh.length === 0;
  },
});

// 2. LINT the surfaces this project owns.
run("lint", "npx eslint src/lib/americano src/hooks/useAmericanoSession.ts " +
  "src/pages/ManageAmericano.tsx src/types/americano.ts src/site");

// 3. TESTS.
run("tests", "npx vitest run");

// 4. BUILD.
run("build", "npm run build");

// 5. The v3 engine sims — the live-night fallback must stay green.
run("v3 sims", "npx tsx src/court-manager/sim/run.ts", {
  allow: (out) => out.includes("GREEN"),
});

console.log(failed === 0 ? ok("\nGAUNTLET GREEN") : bad(`\nGAUNTLET FAILED (${failed})`));
process.exit(failed === 0 ? 0 : 1);
