// The league table reads the Sheet through /api/league (one cached copy for
// everyone) and only calls the Sheet directly when that isn't there.
import { afterEach, describe, expect, it, vi } from "vitest";
// The Vercel function is plain JS outside src; this checks its core.
import { readLeague } from "../../../api/league.js";

const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

const sheet = {
  players: [{ id: "M01", name: "David G", division: "M1", status: "Active" }],
  matches: [
    {
      sessionId: "S01",
      division: "M1",
      round: 1,
      court: "",
      teamA: ["David G", ""],
      teamB: ["", ""],
      scoreA: 2,
      scoreB: 0,
    },
  ],
  sessions: [{ id: "S01", week: 1, date: "2026-10-11", status: "Played" }],
  config: { pointsPerWin: 3, pointsPerLoss: 0 },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("api/league", () => {
  it("returns all four reads in one answer", async () => {
    const doFetch = vi.fn(async (url: string) => ok(sheet[new URL(url).searchParams.get("type") as keyof typeof sheet]));
    await expect(readLeague(doFetch)).resolves.toEqual(sheet);
    expect(doFetch).toHaveBeenCalledTimes(4);
  });

  it("tries a dropped read a second time", async () => {
    let dropped = false;
    const doFetch = vi.fn(async (url: string) => {
      const type = new URL(url).searchParams.get("type") as keyof typeof sheet;
      if (type === "matches" && !dropped) {
        dropped = true;
        throw new TypeError("network dropped");
      }
      return ok(sheet[type]);
    });
    await expect(readLeague(doFetch)).resolves.toEqual(sheet);
    expect(doFetch).toHaveBeenCalledTimes(5);
  });

  it("gives up after two failures instead of serving half a table", async () => {
    const doFetch = vi.fn(async (url: string) =>
      new URL(url).searchParams.get("type") === "players"
        ? new Response(JSON.stringify({ ok: false }), { status: 200 })
        : ok(sheet[new URL(url).searchParams.get("type") as keyof typeof sheet]),
    );
    await expect(readLeague(doFetch)).rejects.toThrow(/players/);
  });
});

describe("the site's league loader", () => {
  it("uses the cached /api/league answer when it is there, and makes no direct Sheet calls", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return url === "/api/league" ? ok(sheet) : ok([]);
      }),
    );
    const { loadLeague } = await import("@/site/leagueLive");
    const snap = await loadLeague();
    expect(calls).toEqual(["/api/league"]);
    expect(snap.standings.find((r) => r.player === "David G")).toMatchObject({ matches: 1, wins: 1, leaguePoints: 3 });
  });

  it("falls back to the Sheet itself when /api/league isn't there", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url === "/api/league") return new Response("<!doctype html>", { status: 200 });
        return ok(sheet[new URL(url).searchParams.get("type") as keyof typeof sheet]);
      }),
    );
    const { loadLeague } = await import("@/site/leagueLive");
    const snap = await loadLeague();
    expect(calls[0]).toBe("/api/league");
    expect(calls.slice(1).map((u) => new URL(u).searchParams.get("type")).sort()).toEqual([
      "config",
      "matches",
      "players",
      "sessions",
    ]);
    expect(snap.matchdays).toHaveLength(1);
  });
});
