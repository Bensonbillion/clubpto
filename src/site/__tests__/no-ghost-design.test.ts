// The tripwire.
//
// The pre-RALLY public site ("Club Padel Toronto" — Play. / Connect. /
// "Book This Wednesday") was deleted from the source on 2026-03-06 in
// 3ce5a00, yet kept appearing for months: a precaching service worker was
// serving retired bundles to returning devices. The worker is gone and a
// kill-switch now purges survivors, but the other way this ghost returns is a
// bad merge or a revert dragging the old components back in.
//
// (It lives outside src/__tests__/ because vitest excludes that directory —
// it holds the legacy standalone sims that run under tsx.)
//
// So: fail the build if the dead design's most distinctive strings reappear in
// the source, and fail if a service worker registration is reintroduced
// without a deliberate decision. Cheap, fast, and it fails LOUDLY on the pull
// request rather than quietly on a visitor's phone.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const SRC = join(process.cwd(), "src");
const CODE = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html"]);

/** This file quotes the dead strings by construction, so it excludes itself. */
const SELF = "no-ghost-design.test.ts";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (CODE.has(extname(p)) && !p.endsWith(SELF)) out.push(p);
  }
  return out;
}

const files = () => [...sourceFiles(SRC), join(process.cwd(), "index.html")];

describe("the retired public site stays retired", () => {
  // Split so this test file's own source cannot match the grep it performs.
  const GHOST = [
    ["Book This", "Wednesday"],
    ["Toronto's Wednesday", "Ritual"],
    ["Club Padel", "Toronto"],
  ].map(([a, b]) => `${a} ${b}`);

  it.each(GHOST)("%s appears nowhere in the source", (needle) => {
    const hits = files().filter((f) => readFileSync(f, "utf8").includes(needle));
    expect(hits.map((f) => f.replace(process.cwd() + "/", ""))).toEqual([]);
  });

  it("no deleted old-design asset is referenced again", () => {
    const dead = [
      "gallery-1.jpg", "gallery-2.jpg", "gallery-3.jpg", "gallery-4.jpg",
      "hero-court.jpg", "court-action.jpg", "padel-detail.jpg", "players-duo.jpg",
      "highlight-video.mp4", "logo-club-pto.jpg", "logo-wordmark.png",
      "courtside-ii-poster.jpg", "logo.jpg",
    ];
    const offenders: string[] = [];
    for (const f of files()) {
      const src = readFileSync(f, "utf8");
      for (const asset of dead) {
        // Prefix traps: logo-wordmark-cream.png and logo-club-pto.jpg are
        // distinct from logo-wordmark.png and logo.jpg, so the boundary
        // before the name matters as much as the name.
        if (new RegExp(`(^|[^-\\w/])${asset.replace(".", "\\.")}`).test(src)) {
          offenders.push(`${f.replace(process.cwd() + "/", "")} → ${asset}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no service worker is registered without a deliberate decision", () => {
    // If offline support is ever wanted back, delete this assertion in the
    // same commit that adds the worker — so the choice is visible in review.
    const offenders = files().filter((f) => {
      const src = readFileSync(f, "utf8");
      return (
        src.includes("serviceWorker.register") ||
        src.includes("virtual:pwa-register") ||
        src.includes("VitePWA")
      );
    });
    expect(offenders.map((f) => f.replace(process.cwd() + "/", ""))).toEqual([]);
  });

  it("the kill-switch is still wired into app boot", () => {
    // The one thing that heals devices still holding a ghost worker.
    const main = readFileSync(join(SRC, "main.tsx"), "utf8");
    expect(main).toContain("killStaleCaches()");
  });
});
