import { describe, expect, it } from "vitest";
import { buildClubhouseView } from "./viewmodel";
import type { PublishBundle } from "../publish/types";
import type { MemberPrefs, RosterEntry } from "../data/reads";

const roster: RosterEntry[] = [
  { playerId: "a", displayName: "Ada" },
  { playerId: "b", displayName: "Ben" },
  { playerId: "c", displayName: "Cy" },
  { playerId: "d", displayName: "Dee" },
];

const pairAB = { pairId: "p1", players: [{ id: "a", displayName: "Ada" }, { id: "b", displayName: "Ben" }] as [any, any] };
const pairCD = { pairId: "p2", players: [{ id: "c", displayName: "Cy" }, { id: "d", displayName: "Dee" }] as [any, any] };

function session(id: string, date: string, over: Partial<PublishBundle> = {}): PublishBundle {
  return {
    session: { sessionId: id, date, venue: "District Padel Club", attendanceCount: 4 },
    players: [],
    pairs: [pairAB, pairCD],
    results: [
      { gameId: `${id}-g1`, winnerPairId: "p1", loserPairId: "p2", completedAt: 1 },
      { gameId: `${id}-g2`, winnerPairId: "p2", loserPairId: "p1", completedAt: 2 },
    ],
    champions: [{ title: "Champion of the Week", points: 100, pair: pairAB }],
    finalists: [{ title: "Champion of the Week", points: 50, pair: pairCD }],
    practiceOnly: false,
    ...over,
  };
}

const noPrefs = new Map<string, MemberPrefs>();

describe("clubhouse view-model", () => {
  it("renders a complete empty state from zero published sessions", () => {
    const v = buildClubhouseView([], roster, noPrefs, "a");
    expect(v.publishedSessions).toBe(0);
    expect(v.recaps).toHaveLength(0);
    expect(v.boards.points).toHaveLength(0);
    expect(v.records).toHaveLength(0);
    expect(v.me?.sessions).toBe(0);
    expect(v.me?.nextClub).toEqual({ name: "The 10 Club", toGo: 10 });
    expect(v.profiles).toHaveLength(4); // PROF-1: every roster player
  });

  it("computes boards, honors and points from published sessions", () => {
    const v = buildClubhouseView([session("s1", "2026-08-02"), session("s2", "2026-08-05")], roster, noPrefs, "a");
    expect(v.publishedSessions).toBe(2);
    // Champions: Ada+Ben 100 each per session; finalists Cy+Dee 50 each.
    expect(v.boards.points[0].value).toBe(200);
    expect(v.boards.attendance.every((r) => r.value === 2)).toBe(true);
    expect(v.recaps[0].sessionId).toBe("s2"); // newest first
    expect(v.recaps[0].honors.some((h) => h.finalist && h.points === 50)).toBe(true);
    // Championships count titles only, never finalist honors.
    const cy = v.profiles.find((p) => p.name === "Cy")!;
    expect(cy.championships).toBe(0);
    expect(cy.ptoPoints).toBe(100);
  });

  it("keeps every board at ten rows or fewer (LB-1)", () => {
    const bigRoster: RosterEntry[] = Array.from({ length: 30 }, (_, i) => ({ playerId: `x${i}`, displayName: `X${i}` }));
    const pairs = Array.from({ length: 15 }, (_, i) => ({
      pairId: `bp${i}`,
      players: [
        { id: `x${2 * i}`, displayName: `X${2 * i}` },
        { id: `x${2 * i + 1}`, displayName: `X${2 * i + 1}` },
      ] as [any, any],
    }));
    const b = session("s1", "2026-08-02", {
      pairs,
      results: pairs.slice(1).map((p, i) => ({
        gameId: `g${i}`,
        winnerPairId: pairs[0].pairId,
        loserPairId: p.pairId,
        completedAt: i,
      })),
      champions: [],
      finalists: [],
    });
    const v = buildClubhouseView([b], bigRoster, noPrefs, null);
    for (const board of Object.values(v.boards)) expect(board.length).toBeLessThanOrEqual(10);
  });

  it("honors the Win% qualifier and the LB-3 opt-out", () => {
    // 4 sessions x 2 games = 8 games each: exactly at the qualifier.
    const sessions = ["01", "02", "03", "04"].map((d, i) => session(`s${i}`, `2026-08-${d}`));
    const optOut = new Map<string, MemberPrefs>([["a", { showWinpct: false, showRank: false }]]);
    const v = buildClubhouseView(sessions, roster, optOut, null);
    expect(v.boards.winpct.length).toBeGreaterThan(0);
    expect(v.boards.winpct.some((r) => r.playerId === "a")).toBe(false); // opted out
    expect(v.boards.winpct.every((r) => r.display.endsWith("%"))).toBe(true);
    const ada = v.profiles.find((p) => p.playerId === "a")!;
    expect(ada.winPctDisplay).toBeNull(); // hidden on profile too
    expect(ada.sessions).toBe(4); // accumulative stats stay visible (LB-3)
  });

  it("keeps private rank hidden until the member opts in (DASH-7)", () => {
    const sessions = [session("s1", "2026-08-02")];
    expect(buildClubhouseView(sessions, roster, noPrefs, "a").me?.rank).toBeNull();
    const optIn = new Map<string, MemberPrefs>([["a", { showWinpct: true, showRank: true }]]);
    expect(buildClubhouseView(sessions, roster, optIn, "a").me?.rank).toBe(1);
  });

  it("detects rivalries at three meetings and words them from each side", () => {
    const sessions = ["01", "02"].map((d, i) => session(`s${i}`, `2026-08-${d}`));
    const v = buildClubhouseView(sessions, roster, noPrefs, "a");
    const ada = v.profiles.find((p) => p.playerId === "a")!;
    // Ada met Cy in 4 games (2 per session), 2-2.
    const vsCy = ada.rivalries.find((r) => r.vsName === "Cy")!;
    expect(vsCy.meetings).toBe(4);
    expect(vsCy.wins).toBe(2);
    expect(vsCy.losses).toBe(2);
  });

  it("excludes practice sessions from every number (PIPE-3)", () => {
    const practice = session("s1", "2026-08-02", { practiceOnly: true });
    const v = buildClubhouseView([practice], roster, noPrefs, "a");
    expect(v.publishedSessions).toBe(0);
    expect(v.boards.points).toHaveLength(0);
    expect(v.me?.games).toBe(0);
    expect(v.me?.sessions).toBe(1); // attendance still counts — persistence over performance
    expect(v.recaps[0].practiceOnly).toBe(true);
  });

  it("lets a published pseudonym beat the roster's real name (PRIV-3)", () => {
    // Publish-time privacy renamed "a" to "The Wall"; the roster copy still
    // holds the legal name. The room must never undo that.
    const aka = {
      pairId: "p1",
      players: [{ id: "a", displayName: "The Wall" }, { id: "b", displayName: "Ben" }] as [any, any],
    };
    const b = session("s1", "2026-08-02", {
      pairs: [aka, pairCD],
      champions: [{ title: "Champion of the Week", points: 100, pair: aka }],
      finalists: [],
    });
    const v = buildClubhouseView([b], roster, noPrefs, "a");
    const json = JSON.stringify(v);
    expect(json.includes("Ada")).toBe(false); // the legal name never appears
    expect(v.recaps[0].honors[0].names).toContain("The Wall");
    expect(v.boards.points[0].name).toBe("The Wall");
    expect(v.me?.name).toBe("The Wall");
    expect(v.mosaic.flat().find((c) => c.playerId === "a")?.name).toBe("The Wall");
  });

  it("hides win rates for everyone when preferences cannot be read (LB-3 fails closed)", () => {
    const sessions = ["01", "02", "03", "04"].map((d, i) => session(`s${i}`, `2026-08-${d}`));
    const known = buildClubhouseView(sessions, roster, noPrefs, null, true);
    expect(known.boards.winpct.length).toBeGreaterThan(0);

    const unknown = buildClubhouseView(sessions, roster, new Map(), null, false);
    expect(unknown.boards.winpct).toHaveLength(0);
    expect(unknown.profiles.every((p) => p.winPctDisplay === null)).toBe(true);
    // Accumulative stats are unaffected — only the opt-in metric hides.
    expect(unknown.boards.attendance.length).toBeGreaterThan(0);
  });

  it("keeps practice nights out of boards and records but in your own count (PIPE-3)", () => {
    const real = session("s1", "2026-08-02");
    const practice = session("s2", "2026-08-09", { practiceOnly: true });
    const v = buildClubhouseView([real, practice], roster, noPrefs, "a");
    // Board and record count the competitive night only.
    expect(v.boards.attendance[0].value).toBe(1);
    const sessionsRecord = v.records.find((r) => r.label === "Most sessions attended");
    expect(sessionsRecord?.value).toBe(1);
    // Your own attendance still counts both — persistence over performance.
    expect(v.me?.sessions).toBe(2);
    expect(v.profiles.find((p) => p.playerId === "a")?.sessions).toBe(2);
  });

  it("lists milestone clubs alphabetically, never as an attendance ranking (LB-1)", () => {
    const sessions = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"].map((d, i) =>
      session(`s${i}`, `2026-08-${d}`)
    );
    // Give one pair fewer sessions so a ranking would be visible if sorted.
    const partial = sessions.map((s, i) =>
      i < 3 ? s : { ...s, pairs: [s.pairs[0]] }
    );
    const v = buildClubhouseView(partial, roster, noPrefs, null);
    const club10 = v.milestoneClubs.find((c) => c.threshold === 10)!;
    expect(club10.members).toEqual([...club10.members].sort((a, b) => a.localeCompare(b)));
  });

  it("never leaks tier data and never names hidden players", () => {
    const hiddenPair = {
      pairId: "p3",
      players: [{ displayName: "Club member" }, { id: "b", displayName: "Ben" }] as [any, any],
    };
    const b = session("s1", "2026-08-02", {
      pairs: [hiddenPair, pairCD],
      champions: [{ title: "Champion of the Week", points: 100, pair: hiddenPair }],
      finalists: [],
    });
    const v = buildClubhouseView([b], roster, noPrefs, null);
    const json = JSON.stringify(v);
    expect(json.includes('"tier"')).toBe(false);
    expect(json.includes('"division"')).toBe(false);
    const recapHonor = v.recaps[0].honors[0];
    expect(recapHonor.names).toContain("Club member");
    expect(recapHonor.names).toContain("Ben");
  });

  it("fills the mosaic in first-attended order with the viewer findable", () => {
    const v = buildClubhouseView([session("s1", "2026-08-02")], roster, noPrefs, "a");
    const flat = v.mosaic.flat();
    expect(flat.filter((c) => c.filled)).toHaveLength(4);
    expect(flat.some((c) => c.playerId === "a")).toBe(true);
  });

  it("grows the mosaic so every attendee gets a square (MOS-2)", () => {
    // 60 players is well past the base letterform's 17 cells.
    const big: RosterEntry[] = Array.from({ length: 60 }, (_, i) => ({
      playerId: `m${i}`,
      displayName: `M${i}`,
    }));
    const pairs = Array.from({ length: 30 }, (_, i) => ({
      pairId: `mp${i}`,
      players: [
        { id: `m${2 * i}`, displayName: `M${2 * i}` },
        { id: `m${2 * i + 1}`, displayName: `M${2 * i + 1}` },
      ] as [any, any],
    }));
    const v = buildClubhouseView(
      [session("s1", "2026-08-02", { pairs, results: [], champions: [], finalists: [] })],
      big,
      noPrefs,
      "m59"
    );
    const flat = v.mosaic.flat();
    expect(flat.filter((c) => c.filled)).toHaveLength(60); // nobody dropped
    expect(flat.some((c) => c.playerId === "m59")).toBe(true); // last player has a pixel
    // Rows stay rectangular so the CSS grid renders the letterform.
    expect(new Set(v.mosaic.map((r) => r.length)).size).toBe(1);
  });
});

// PROF-3 has two halves, and only one of them fails loudly. "Other members
// cannot see the hidden player" is the half everyone tests. The half that
// breaks in silence is the hidden player opening their own seat and finding
// a stranger there.
describe("a hidden player, from their own side", () => {
  const hiddenRoster: RosterEntry[] = [
    { playerId: "a", displayName: "Ada" },
    { playerId: "b", displayName: "Ben" },
    { playerId: "c", displayName: "Cy" },
    { playerId: "d", displayName: "Dee", hidden: true },
  ];

  it("still knows their own name in their own seat", () => {
    // Dee has never been published, so nameOf can only learn "Dee" from the
    // roster row. Drop that row and the seat greets her as "Club member".
    const v = buildClubhouseView([], hiddenRoster, noPrefs, "d");
    expect(v.me?.name).toBe("Dee");
    expect(v.me?.playerId).toBe("d");
    expect(v.me?.nextClub).toEqual({ name: "The 10 Club", toGo: 10 });
  });

  it("keeps their published stats, which hiding was never meant to erase", () => {
    const v = buildClubhouseView(
      [session("s1", "2026-08-02"), session("s2", "2026-08-05")],
      hiddenRoster,
      noPrefs,
      "d"
    );
    expect(v.me?.sessions).toBe(2);
    expect(v.me?.ptoPoints).toBe(100); // finalist twice
  });

  it("is absent from the players directory, including their own copy of it", () => {
    const v = buildClubhouseView([], hiddenRoster, noPrefs, "d");
    expect(v.profiles.map((p) => p.playerId)).toEqual(["a", "b", "c"]);
    // Hiding that still lists you back to yourself reads as hiding that failed.
    expect(v.profiles.some((p) => p.playerId === "d")).toBe(false);
  });

  it("is absent for every other member too", () => {
    const v = buildClubhouseView([], hiddenRoster, noPrefs, "a");
    expect(v.profiles.map((p) => p.playerId)).toEqual(["a", "b", "c"]);
  });

  // What the obvious fix would have done. A policy of `hidden = false`
  // alone, or the .eq("hidden", false) that used to sit in fetchRoster,
  // means Dee's row never reaches the browser — including Dee's browser.
  // Nothing throws. She just stops being herself.
  it("loses their name entirely when the row never arrives", () => {
    const withoutDee = hiddenRoster.filter((r) => r.playerId !== "d");
    const v = buildClubhouseView([], withoutDee, noPrefs, "d");
    expect(v.me?.name).toBe("Club member");
  });
});
