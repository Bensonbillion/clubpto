// The old-branding pages retired on Oct 15 2026 stay retired: each old URL
// lands on its replacement (in the app and as a server redirect), and no
// menu on the site still points at one.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RETIRED } from "@/site/retired";
import { NAV } from "@/site/ui/SiteLayout";

const ROOT = join(__dirname, "..", "..", "..");
const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
  redirects: { source: string; destination: string }[];
};

describe("retired pages", () => {
  it("sends every old URL to the page that replaced it", () => {
    expect(Object.fromEntries(RETIRED)).toEqual({
      "/about": "/",
      "/faq": "/play",
      "/book": "/play",
      "/community": "/events",
      "/league/join": "/league#season-2",
      "/install": "/play",
      "/club": "/",
      "/club/*": "/",
      "/membership": "/",
    });
  });

  it("redirects the same paths on the server, before the app loads", () => {
    const server = Object.fromEntries(vercel.redirects.map((r) => [r.source.replace("/:path*", "/*"), r.destination]));
    expect(server).toEqual(Object.fromEntries(RETIRED));
  });

  it("no longer ships the retired pages", () => {
    for (const page of ["About", "FAQPage", "Community", "Book", "LeagueJoin", "Install", "Club", "ClubRoomPreview"]) {
      expect(existsSync(join(ROOT, "src", "pages", `${page}.tsx`)), page).toBe(false);
    }
    const app = readFileSync(join(ROOT, "src", "App.tsx"), "utf8");
    expect(app).not.toMatch(/import\("\.\/pages\/(About|FAQPage|Community|Book|LeagueJoin|Install|Club)"\)/);
  });

  it("keeps Skill Lab, rebuilt in the new layout and in the top menu", () => {
    expect(existsSync(join(ROOT, "src", "pages", "SkillsLab.tsx"))).toBe(true);
    expect(RETIRED.some(([from]) => from.startsWith("/skill"))).toBe(false);
    expect(NAV.some((n) => n.to === "/skills-lab")).toBe(true);
    expect(existsSync(join(ROOT, "src", "components", "layout", "PublicLayout.tsx"))).toBe(false);
  });

  it("has no menu link to a retired page", () => {
    const retired = new Set(RETIRED.map(([from]) => from.replace("/*", "")));
    for (const to of NAV.map((n) => n.to)) {
      expect(retired.has(to.split("#")[0]), to).toBe(false);
    }
  });
});
