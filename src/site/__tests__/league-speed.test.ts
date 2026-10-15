// @vitest-environment jsdom
// Bug, Oct 15 2026 (Benson): the league table "takes too long to load".
// Measured that day: once the edge copy of /api/league had expired (20
// minutes with no visitor, or any new deploy) the next visitor waited for
// four Sheet reads, about 2 s warm and 17.6 s cold. The browser also forgot
// the table after 5 minutes or in a new tab, so every visit went back out.
//
// The table changes once a week. Whatever copy is nearest should show at
// once, and a newer one should be fetched quietly in the background.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueSnapshot } from "@/site/leagueLive";
// The Vercel function is plain JS outside src.
import handler from "../../../api/league.js";

const HOUR = 60 * 60 * 1000;

const sheet = (week: number) => ({
  players: [{ id: "M01", name: "David G", division: "M1", status: "Active" }],
  matches: [],
  sessions: [{ id: `S0${week}`, week, date: "2026-10-11", status: "Played" }],
  config: { pointsPerWin: 3, pointsPerLoss: 0 },
});
const answer = (week: number) => new Response(JSON.stringify({ ok: true, data: sheet(week) }), { status: 200 });
const never = () => new Promise<Response>(() => {});
const only = (path: string, week: number) =>
  vi.fn(async (url: RequestInfo | URL) => (String(url) === path ? answer(week) : never()));

/** The value, or "still waiting" if it takes longer than `ms`. */
const within = <T,>(p: Promise<T>, ms = 200): Promise<T | "still waiting"> =>
  Promise.race([p, new Promise<"still waiting">((r) => setTimeout(() => r("still waiting"), ms))]);

const weeks = (s: LeagueSnapshot | "still waiting" | null) =>
  s && s !== "still waiting" ? s.matchdays.map((m) => m.week) : s;

/** A new page load: the module starts over, the browser's storage stays. */
const newVisit = async () => {
  vi.resetModules();
  return import("@/site/leagueLive");
};

/** Moves the clock on, as if the next visit happens `ms` later. */
const later = (ms: number) => {
  const t = Date.now() + ms;
  vi.spyOn(Date, "now").mockReturnValue(t);
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("nobody waits on the Sheet for the league table", () => {
  it("a returning visitor sees the last table at once, even an hour later on a hung network", async () => {
    vi.stubGlobal("fetch", only("/api/league", 1));
    await (await newVisit()).loadLeague();

    later(HOUR);
    vi.stubGlobal("fetch", vi.fn(never));
    const got = await within((await newVisit()).loadLeague());
    expect(weeks(got)).toEqual([1]);
  });

  it("a first-time visitor gets the copy baked into the build while the edge is cold", async () => {
    vi.stubGlobal("fetch", only("/league-snapshot.json", 1));
    const got = await within((await newVisit()).loadLeague());
    expect(weeks(got)).toEqual([1]);
  });

  it("still fetches a newer table in the background, and keeps it for next time", async () => {
    vi.stubGlobal("fetch", only("/api/league", 1));
    await (await newVisit()).loadLeague();

    later(HOUR);
    const edge = only("/api/league", 2);
    vi.stubGlobal("fetch", edge);
    const lib = await newVisit();
    expect(weeks(await within(lib.loadLeague()))).toEqual([1]);
    expect(weeks(await within(lib.freshLeague(), 1000))).toEqual([2]);
    expect(edge).toHaveBeenCalledWith("/api/league");

    vi.stubGlobal("fetch", vi.fn(never));
    expect(weeks(await within((await newVisit()).loadLeague()))).toEqual([2]);
  });

  it("doesn't go back out for a copy that is only a few minutes old", async () => {
    vi.stubGlobal("fetch", only("/api/league", 1));
    await (await newVisit()).loadLeague();

    later(2 * 60 * 1000);
    const edge = vi.fn(never);
    vi.stubGlobal("fetch", edge);
    const lib = await newVisit();
    expect(weeks(await within(lib.loadLeague()))).toEqual([1]);
    expect(await within(lib.freshLeague())).toBeNull();
    expect(edge).not.toHaveBeenCalled();
  });
});

describe("api/league keeps a copy at the edge for the week", () => {
  it("serves the stored table while it refreshes for a week, not 15 minutes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const type = new URL(String(url)).searchParams.get("type") as keyof ReturnType<typeof sheet>;
        return new Response(JSON.stringify({ ok: true, data: sheet(1)[type] }), { status: 200 });
      }),
    );
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => (headers[k.toLowerCase()] = v),
      status() {
        return this;
      },
      json() {},
    };
    await handler({ method: "GET" }, res);
    const cc = headers["cache-control"] ?? "";
    expect(Number(/stale-while-revalidate=(\d+)/.exec(cc)?.[1])).toBeGreaterThanOrEqual(7 * 24 * 60 * 60);
    // Still refreshed within minutes of a visit, so Sunday's scores show up.
    expect(Number(/s-maxage=(\d+)/.exec(cc)?.[1])).toBeLessThanOrEqual(600);
  });
});
