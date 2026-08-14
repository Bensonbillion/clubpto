// The two nights are the same thing.
//
// Wednesday and Sunday are both simply padel. The site used to frame
// Wednesday as the competitive night and Sunday as the lesser, softer
// option ("tournament night" / "the softer one" / "compete Wednesday,
// unwind Sunday"), which is both untrue and a direct suppressant on Sunday
// attendance: nobody picks the night the club itself calls the B-side.
//
// The rule is simple and absolute for PUBLIC copy: never differentiate the
// two nights. If one night gets a descriptor, the other gets the same one.
// Anyone should be able to take whichever day their week allows and know
// they got the same night.
//
// This file greps the public surfaces for the framing so it cannot creep
// back in through a revert, a merge, or a well-meaning rewrite. It lives
// beside no-ghost-design.test.ts for the same reason: src/__tests__/ is
// excluded from vitest.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
const CODE = new Set([".ts", ".tsx"]);

/** This file quotes the banned phrases by construction, so it excludes itself. */
const SELF = "nights-are-equal.test.ts";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (CODE.has(extname(p)) && !p.endsWith(SELF)) out.push(p);
  }
  return out;
}

/**
 * Every surface that speaks to members or visitors: the homepage sections,
 * the two prose pages, the facts file, and the clubhouse room (which is
 * behind a login but is still the club talking about its own nights).
 */
const publicCopy = () => [
  ...sourceFiles(join(ROOT, "src", "components", "home")),
  ...sourceFiles(join(ROOT, "src", "clubhouse", "ui")),
  join(ROOT, "src", "pages", "About.tsx"),
  join(ROOT, "src", "pages", "FAQPage.tsx"),
  join(ROOT, "src", "pages", "Club.tsx"),
  join(ROOT, "src", "lib", "constants.ts"),
];

describe("Wednesday and Sunday read as the same night", () => {
  // Assembled at runtime so this file's own source cannot match itself.
  const BANNED = [
    ["tournament", "night"],
    ["softer"],
    ["unwind", "sunday"],
    ["compete", "wednesday"],
  ].map((parts) => parts.join(" "));

  it.each(BANNED)("no public copy says %s", (phrase) => {
    const hits = publicCopy().filter((f) =>
      readFileSync(f, "utf8").toLowerCase().includes(phrase)
    );
    expect(hits.map((f) => f.replace(ROOT + "/", ""))).toEqual([]);
  });

  it("both nights carry exactly the same fields", async () => {
    const { weeklyMeets } = await import("../../lib/constants");
    const shapes = weeklyMeets.nights.map((n) => Object.keys(n).sort().join(","));
    expect(new Set(shapes).size).toBe(1);
    // A descriptor on one night and not the other is the failure this
    // whole file exists to prevent.
    expect(weeklyMeets.nights.length).toBe(2);
    for (const night of weeklyMeets.nights) {
      expect(night.day.length).toBeGreaterThan(0);
      expect(night.venue.length).toBeGreaterThan(0);
      expect(night.area.length).toBeGreaterThan(0);
    }
  });

  it("both venues reach the homepage", async () => {
    const { weeklyMeets } = await import("../../lib/constants");
    const home = sourceFiles(join(ROOT, "src", "components", "home"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    // Either literally, or by mapping over weeklyMeets.nights.
    const rendersFromFacts = /weeklyMeets\.nights/.test(home);
    const namesBoth = weeklyMeets.nights.every((n) => home.includes(n.venue));
    expect(rendersFromFacts || namesBoth).toBe(true);
  });
});
