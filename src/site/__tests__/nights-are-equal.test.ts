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
  // Partners and Community were missing from this list, which was an
  // oversight rather than a decision: both are public pages that can name a
  // night. Neither does today, so nothing was broken — but the guard only
  // works on files it reads.
  join(ROOT, "src", "pages", "Partners.tsx"),
  join(ROOT, "src", "pages", "Community.tsx"),
  join(ROOT, "src", "pages", "SkillsLab.tsx"),
  join(ROOT, "src", "content", "skillsLab.ts"),
  join(ROOT, "src", "lib", "constants.ts"),
];

describe("Wednesday and Sunday read as the same night", () => {
  // Assembled at runtime so this file's own source cannot match itself.
  const BANNED = [
    ["tournament", "night"],
    ["softer"],
    ["unwind", "sunday"],
    ["compete", "wednesday"],
    ["competitive", "night"],
    // Inventory scarcity is banned everywhere; "6 per cohort" (structural
    // capacity) is the allowed form.
    ["spots", "left"],
    // Testimonial-shaped names. The Skills Lab program has never run — if
    // one of these appears, someone invented a person.
    ["priya"],
    ["marcus", "t"],
    ["alexa", "r"],
  ].map((parts) => parts.join(" "));

  it.each(BANNED)("no public copy says %s", (phrase) => {
    const hits = publicCopy().filter((f) =>
      readFileSync(f, "utf8").toLowerCase().includes(phrase)
    );
    expect(hits.map((f) => f.replace(ROOT + "/", ""))).toEqual([]);
  });

  // The phrase list above only catches the wording we already know about.
  // The failure mode is broader: any sentence that names one night and not
  // the other quietly makes it the real one. ("Wednesday's format pairs you
  // up", "Play Wednesday." — both shipped, both invisible to a word list.)
  it("no line of copy names one night without the other", () => {
    const offenders: string[] = [];
    // constants.ts is exempt: it is the facts table, where each night gets
    // its own line by design. Its symmetry is covered by the next test.
    for (const file of publicCopy().filter((f) => !f.endsWith("constants.ts"))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.trim();
          if (code.startsWith("//") || code.startsWith("*")) return;
          // Only judge lines that carry copy, not identifiers or facts
          // rendered from weeklyMeets.
          // KNOWN GAP, left alone deliberately (out of scope where it was
          // found, and worth fixing on its own): this exemption assumes
          // anything rendering from constants.ts is symmetric by
          // construction. It is not. `weeklyMeets.nights[0].venue` renders
          // ONE night and is skipped here, so the exact failure this file
          // exists to catch can pass through the exemption meant to allow
          // the facts table. Narrow it to lines that map over the array
          // rather than index into it.
          if (/weeklyMeets|nights\[|night\./.test(code)) return;
          const wed = /wednesday/i.test(code);
          const sun = /sunday/i.test(code);
          if (wed !== sun) {
            offenders.push(`${file.replace(ROOT + "/", "")}:${i + 1}  ${code.slice(0, 80)}`);
          }
        });
    }
    expect(offenders).toEqual([]);
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
