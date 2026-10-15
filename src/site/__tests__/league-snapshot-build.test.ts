// The build writes the current league table to dist/league-snapshot.json,
// so a first-time visitor sees a real table even when the edge copy is cold
// (every deploy starts it over). The build must never fail or hang on it.
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// Plain JS build step outside src.
import { writeSnapshot } from "../../../scripts/league-snapshot.mjs";

const ROOT = join(__dirname, "..", "..", "..");
const sheet = {
  players: [{ id: "M01", name: "David G", division: "M1", status: "Active" }],
  matches: [],
  sessions: [{ id: "S01", week: 1, date: "2026-10-11", status: "Played" }],
  config: { pointsPerWin: 3, pointsPerLoss: 0 },
};
const outFile = () => join(mkdtempSync(join(tmpdir(), "pto-snap-")), "league-snapshot.json");

describe("league snapshot in the build", () => {
  it("writes the table in the same shape /api/league answers with", async () => {
    const file = outFile();
    await expect(writeSnapshot({ outFile: file, read: async () => sheet })).resolves.toBe(true);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(saved).toMatchObject({ ok: true, data: sheet });
    expect(typeof saved.fetchedAt).toBe("string");
  });

  it("never fails the build when the Sheet is down", async () => {
    const file = outFile();
    await expect(
      writeSnapshot({
        outFile: file,
        read: async () => {
          throw new Error("down");
        },
      }),
    ).resolves.toBe(false);
    expect(existsSync(file)).toBe(false);
  });

  it("gives up on a hung Sheet instead of hanging the build", async () => {
    const file = outFile();
    await expect(writeSnapshot({ outFile: file, read: () => new Promise(() => {}), timeoutMs: 50 })).resolves.toBe(false);
    expect(existsSync(file)).toBe(false);
  });

  it("runs as part of the build", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts.build).toContain("scripts/league-snapshot.mjs");
  });
});
