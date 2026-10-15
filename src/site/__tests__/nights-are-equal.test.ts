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
// October 2026: the weekly meet moved to Thursdays and Sunday became the
// PTO League's day, so there is one weekly night for now. The rule stands
// for whenever a second night returns: the symmetry checks below derive the
// night names from weeklyMeets instead of hard-coding Wednesday and Sunday,
// and they run as soon as there are two nights again. The banned phrases
// apply whatever the schedule.
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
 * Every surface that speaks to visitors: the redesigned pages, the facts
 * files and Skill Lab. (About, FAQ, Community and the clubhouse room were
 * retired on Oct 15 2026.)
 */
const publicCopy = () => [
  // The redesigned public site: its pages and shared copy.
  ...sourceFiles(join(ROOT, "src", "site")).filter((f) => !f.includes("__tests__")),
  join(ROOT, "src", "pages", "Home.tsx"),
  join(ROOT, "src", "pages", "Play.tsx"),
  join(ROOT, "src", "pages", "League.tsx"),
  join(ROOT, "src", "pages", "Events.tsx"),
  join(ROOT, "src", "pages", "BookPTO.tsx"),
  join(ROOT, "src", "pages", "Partners.tsx"),
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
  // The failure mode is broader than any word list: a sentence that names
  // one weekly night and not the other quietly makes it the real one.
  // ("Wednesday's format pairs you up", "Play Wednesday." both shipped.)
  // Only meaningful while there are two weekly nights, so it waits until
  // weeklyMeets has two again. The night names come from the facts table.
  it("no line of copy names one weekly night without the other", async () => {
    const { weeklyMeets } = await import("../../lib/constants");
    const names = weeklyMeets.nights.map((n) => n.day.replace(/s$/i, "").toLowerCase());
    if (names.length < 2) return;
    const offenders: string[] = [];
    // constants.ts is exempt: it is the facts table, where each night gets
    // its own line by design. Its symmetry is covered by the next test.
    for (const file of publicCopy().filter((f) => !f.endsWith("constants.ts"))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.trim();
          if (code.startsWith("//") || code.startsWith("*")) return;
          if (/weeklyMeets|nights\[|night\./.test(code)) return;
          const named = names.map((n) => new RegExp(n, "i").test(code));
          if (named.some(Boolean) && !named.every(Boolean)) {
            offenders.push(`${file.replace(ROOT + "/", "")}:${i + 1}  ${code.slice(0, 80)}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it("every weekly night carries exactly the same fields", async () => {
    const { weeklyMeets } = await import("../../lib/constants");
    const shapes = weeklyMeets.nights.map((n) => Object.keys(n).sort().join(","));
    expect(new Set(shapes).size).toBe(1);
    // A descriptor on one night and not the other is the failure this
    // whole file exists to prevent.
    expect(weeklyMeets.nights.length).toBeGreaterThan(0);
    for (const night of weeklyMeets.nights) {
      expect(night.day.length).toBeGreaterThan(0);
      expect(night.venue.length).toBeGreaterThan(0);
      expect(night.area.length).toBeGreaterThan(0);
    }
  });

  it("every weekly venue reaches the homepage", async () => {
    const { weeklyMeets } = await import("../../lib/constants");
    // The homepage renders the venue from src/site/content.ts, which reads
    // it from weeklyMeets, so both files count as "the homepage" here.
    const home = [join(ROOT, "src", "pages", "Home.tsx"), join(ROOT, "src", "site", "content.ts")]
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    // Either literally, or by mapping over weeklyMeets.nights.
    const rendersFromFacts = /weeklyMeets\.nights/.test(home);
    const namesBoth = weeklyMeets.nights.every((n) => home.includes(n.venue));
    expect(rendersFromFacts || namesBoth).toBe(true);
  });
});
