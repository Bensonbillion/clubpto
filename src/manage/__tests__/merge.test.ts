// Two phones, one night: the merge, rule by rule.

import { describe, expect, it } from "vitest";
import type { Match, Player, Session } from "../types";
import { mergeSessions } from "../sync/merge";

const player = (id: string, court: number | null = null, extra: Partial<Player> = {}): Player =>
  ({ id, name: id.toUpperCase(), walkIn: false, courtNumber: court, away: false, joinedAtMatchIndex: null, ...extra });

const live = (id: string, court: number, slot: number, four: [string, string, string, string], extra: Partial<Match> = {}): Match => ({
  id, courtNumber: court, matchIndex: slot,
  teamA: [four[0], four[1]], teamB: [four[2], four[3]],
  scoreA: null, scoreB: null, status: "onCourt", startedAt: 1000, completedAt: null, stage: null,
  ...extra,
});

const night = (): Session => ({
  id: "night-2026-09-13", dayLabel: "Wednesday", date: "2026-09-13", status: "running",
  players: [player("a", 1), player("b", 1), player("c", 1), player("d", 1), player("e", 2), player("f", 2), player("g", 2), player("h", 2)],
  courts: [
    { number: 1, targetMatches: 4, playoffSeeded: false, champion: null },
    { number: 2, targetMatches: 4, playoffSeeded: false, champion: null },
  ],
  matches: [live("m1", 1, 1, ["a", "b", "c", "d"]), live("m2", 2, 1, ["e", "f", "g", "h"])],
  startedAt: 500, endedAt: null,
});

const score = (s: Session, id: string, a: number, b: number, at = 2000): Session => ({
  ...s,
  matches: s.matches.map((m) => m.id === id ? { ...m, scoreA: a, scoreB: b, status: "played" as const, completedAt: at } : m),
});
const voided = (s: Session, id: string): Session => ({
  ...s, matches: s.matches.map((m) => m.id === id ? { ...m, status: "voided" as const } : m),
});
const deal = (s: Session, m: Match): Session => ({ ...s, matches: [...s.matches, m] });
const without = (s: Session, id: string): Session => ({ ...s, matches: s.matches.filter((m) => m.id !== id) });
const match = (s: Session, id: string) => s.matches.find((m) => m.id === id);

describe("identities", () => {
  it("nothing changed anywhere: the row; the row unchanged: local; local unchanged: the row", () => {
    const b = night();
    const l = score(b, "m1", 7, 5);
    const r = score(b, "m2", 6, 7);
    expect(mergeSessions(b, b, r).state).toBe(r);
    expect(mergeSessions(b, l, b).state).toBe(l);
    expect(mergeSessions(b, l, l).state).toBe(l);
  });

  it("is idempotent on its own output", () => {
    const b = night();
    const l = score(b, "m1", 7, 5);
    const r = score(b, "m2", 6, 7);
    const once = mergeSessions(b, l, r).state;
    expect(mergeSessions(r, once, r).state).toEqual(once);
    expect(mergeSessions(once, once, once).state).toEqual(once);
  });
});

describe("rule 2 and 3: the defect, and results as one value", () => {
  it("a score on each court from the same base: both land", () => {
    const b = night();
    const l = score(b, "m1", 7, 5);
    const r = score(b, "m2", 6, 7);
    const { state, notes } = mergeSessions(b, l, r);
    expect(match(state, "m1")?.scoreA).toBe(7);
    expect(match(state, "m2")?.scoreB).toBe(7);
    expect(notes).toEqual([]);
  });

  it("the same game scored the same on both phones is one result, no note", () => {
    const b = night();
    const { state, notes } = mergeSessions(b, score(b, "m1", 7, 5), score(b, "m1", 7, 5, 2500));
    expect(match(state, "m1")?.status).toBe("played");
    expect(state.matches).toHaveLength(2);
    expect(notes).toEqual([]);
  });

  it("the same game scored differently: the row's number stands and the note carries both", () => {
    const b = night();
    const { state, notes } = mergeSessions(b, score(b, "m1", 7, 5), score(b, "m1", 3, 7));
    expect([match(state, "m1")?.scoreA, match(state, "m1")?.scoreB]).toEqual([3, 7]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: "resultKept", courtNumber: 1 });
  });

  it("a score beats a void of the same unplayed game, either way round", () => {
    const b = night();
    const scoredLocally = mergeSessions(b, score(b, "m1", 7, 5), voided(b, "m1")).state;
    expect(match(scoredLocally, "m1")?.status).toBe("played");
    const scoredOnRow = mergeSessions(b, voided(b, "m1"), score(b, "m1", 7, 5)).state;
    expect(match(scoredOnRow, "m1")?.status).toBe("played");
  });

  it("a score beats a redraw that deleted the same unplayed game", () => {
    const b = night();
    const redrawn = deal(without(b, "m1"), live("m1b", 1, 1, ["a", "c", "b", "d"]));
    const { state } = mergeSessions(b, score(b, "m1", 7, 5), redrawn);
    expect(match(state, "m1")?.status).toBe("played");
    // The fresh unscored deal at the same slot is the same game twice.
    expect(match(state, "m1b")).toBeUndefined();
  });

  it("a redraw of an untouched unplayed game stands: the old game is gone", () => {
    const b = night();
    const redrawn = deal(without(b, "m1"), live("m1b", 1, 1, ["a", "c", "b", "d"]));
    const { state } = mergeSessions(b, redrawn, b);
    expect(match(state, "m1")).toBeUndefined();
    expect(match(state, "m1b")).toBeDefined();
    const other = mergeSessions(b, b, redrawn).state;
    expect(match(other, "m1")).toBeUndefined();
  });

  it("a void on one phone and a correction on the other of a played game: the row's stands, with a note", () => {
    const b = score(night(), "m1", 7, 5);
    const corrected = score(b, "m1", 7, 6);
    const v = voided(b, "m1");
    const rowVoided = mergeSessions(b, corrected, v);
    expect(match(rowVoided.state, "m1")?.status).toBe("voided");
    expect(rowVoided.notes[0]).toMatchObject({ kind: "resultKept" });
    const rowCorrected = mergeSessions(b, v, corrected);
    expect(match(rowCorrected.state, "m1")?.scoreB).toBe(6);
  });

  it("a score brings its four when the other phone swapped a seat in the unplayed game", () => {
    const b = night();
    const swapped: Session = { ...b, matches: b.matches.map((m) => m.id === "m1" ? { ...m, teamA: ["a", "e"] as [string, string] } : m) };
    const { state } = mergeSessions(b, score(b, "m1", 7, 5), swapped);
    expect(match(state, "m1")?.teamA).toEqual(["a", "b"]);
  });

  it("a seat swap alone merges like any field", () => {
    const b = night();
    const swapped: Session = { ...b, matches: b.matches.map((m) => m.id === "m1" ? { ...m, teamA: ["a", "e"] as [string, string] } : m) };
    const { state } = mergeSessions(b, swapped, score(b, "m2", 6, 7));
    expect(match(state, "m1")?.teamA).toEqual(["a", "e"]);
    expect(match(state, "m2")?.status).toBe("played");
  });
});

describe("rule 4 and 5: one game, one court, one player", () => {
  it("both phones dealt the next game on a court: the row's copy stays", () => {
    const b = score(night(), "m1", 7, 5);
    const l = deal(b, live("m-1-2-local", 1, 2, ["a", "c", "b", "d"]));
    const r = deal(b, live("m-1-2-row", 1, 2, ["a", "d", "b", "c"]));
    const { state, notes } = mergeSessions(b, l, r);
    expect(state.matches.filter((m) => m.courtNumber === 1 && m.status === "onCourt").map((m) => m.id)).toEqual(["m-1-2-row"]);
    expect(notes[0]).toMatchObject({ kind: "gameDropped", courtNumber: 1, matchId: "m-1-2-local" });
  });

  it("both dealt, this phone scored its copy: the score stays and the row's live copy goes", () => {
    const b = score(night(), "m1", 7, 5);
    const l = score(deal(b, live("m-1-2-local", 1, 2, ["a", "c", "b", "d"])), "m-1-2-local", 7, 2);
    const r = deal(b, live("m-1-2-row", 1, 2, ["a", "d", "b", "c"]));
    const { state } = mergeSessions(b, l, r);
    expect(state.matches.filter((m) => m.matchIndex === 2).map((m) => m.id)).toEqual(["m-1-2-local"]);
    expect(match(state, "m-1-2-local")?.status).toBe("played");
  });

  it("both scored their own copy of the same four: one game, the row's number, a note", () => {
    const b = score(night(), "m1", 7, 5);
    const l = score(deal(b, live("m-1-2-local", 1, 2, ["a", "c", "b", "d"])), "m-1-2-local", 7, 2);
    const r = score(deal(b, live("m-1-2-row", 1, 2, ["c", "a", "d", "b"])), "m-1-2-row", 7, 4);
    const { state, notes } = mergeSessions(b, l, r);
    expect(state.matches.filter((m) => m.matchIndex === 2).map((m) => m.id)).toEqual(["m-1-2-row"]);
    expect(notes[0]).toMatchObject({ kind: "resultKept" });
  });

  it("both scored different fours into the same slot: both results stay", () => {
    const b = score(night(), "m1", 7, 5);
    const l = score(deal(b, live("m-1-2-local", 1, 2, ["a", "c", "b", "d"])), "m-1-2-local", 7, 2);
    const r = score(deal(b, live("m-1-2-row", 1, 2, ["a", "b", "c", "d"])), "m-1-2-row", 7, 4);
    const { state } = mergeSessions(b, l, r);
    expect(state.matches.filter((m) => m.matchIndex === 2)).toHaveLength(2);
  });

  it("the same knockout tie dealt to two courts collapses to the row's court", () => {
    const b: Session = { ...night(), format: "knockout", matches: [] };
    const tie = (id: string, court: number) => live(id, court, 1, ["a", "b", "c", "d"], { stage: "semi" });
    const { state } = mergeSessions(b, deal(b, tie("po-1-semi-1-x", 1)), deal(b, tie("po-2-semi-1-y", 2)));
    expect(state.matches.map((m) => m.id)).toEqual(["po-2-semi-1-y"]);
  });

  it("a later rematch of the same teams tie is not a duplicate of the first meeting", () => {
    const first = live("tm-1-aaa", 1, 1, ["a", "b", "c", "d"]);
    const b: Session = { ...night(), format: "teams", matches: [{ ...first, status: "played", scoreA: 7, scoreB: 5, completedAt: 900 }] };
    const l = deal(b, live("tm-1-bbb", 1, 2, ["a", "b", "c", "d"]));
    const { state } = mergeSessions(b, l, b);
    expect(state.matches).toHaveLength(2);
  });

  it("a live game fielding someone the other phone marked as left comes down, and the deal without them stays", () => {
    const b: Session = { ...night(), matches: [] };
    const r = deal(b, live("m-2-1-r", 2, 1, ["e", "f", "g", "h"]));
    const l: Session = deal(
      { ...b, players: b.players.map((p) => p.id === "h" ? { ...p, away: true } : p) },
      live("m-2-1-l", 2, 1, ["e", "f", "g", "a"]),
    );
    const { state, notes } = mergeSessions(b, l, r);
    expect(state.players.find((p) => p.id === "h")?.away).toBe(true);
    expect(state.matches.map((m) => m.id)).toEqual(["m-2-1-l"]);
    expect(notes).toContainEqual({ kind: "leaverDealtAround", courtNumber: 2, playerId: "h" });
    // The other way round: the row marked them left and this phone dealt them.
    const flipped = mergeSessions(b, r, l);
    expect(flipped.state.matches.map((m) => m.id)).toEqual(["m-2-1-l"]);
  });

  it("a player standing in two live games after the merge keeps only the row's", () => {
    const b: Session = { ...night(), matches: [] };
    const l = deal(b, live("m-1-1-l", 1, 1, ["a", "b", "c", "d"]));
    const r = deal(b, live("m-2-1-r", 2, 1, ["a", "e", "f", "g"]));
    const { state } = mergeSessions(b, l, r);
    expect(state.matches.map((m) => m.id)).toEqual(["m-2-1-r"]);
  });
});

describe("players, courts and the night's fields", () => {
  it("one phone marks a player away, the other moves another: both", () => {
    const b = night();
    const l: Session = { ...b, players: b.players.map((p) => p.id === "a" ? { ...p, away: true } : p) };
    const r: Session = { ...b, players: b.players.map((p) => p.id === "e" ? { ...p, courtNumber: 1 } : p) };
    const { state } = mergeSessions(b, l, r);
    expect(state.players.find((p) => p.id === "a")?.away).toBe(true);
    expect(state.players.find((p) => p.id === "e")?.courtNumber).toBe(1);
  });

  it("both change the same field differently: the row's, with a note for a typed field", () => {
    const b = night();
    const l: Session = { ...b, players: b.players.map((p) => p.id === "a" ? { ...p, tier: "A" as const } : p) };
    const r: Session = { ...b, players: b.players.map((p) => p.id === "a" ? { ...p, tier: "C" as const } : p) };
    const { state, notes } = mergeSessions(b, l, r);
    expect(state.players.find((p) => p.id === "a")?.tier).toBe("C");
    expect(notes[0]).toMatchObject({ kind: "fieldKept", entity: "player", id: "a", field: "tier" });
  });

  it("a tier cleared on the row stays cleared, as an absent key", () => {
    const b: Session = { ...night(), players: night().players.map((p) => p.id === "a" ? { ...p, tier: "B" as const } : p) };
    const l: Session = { ...b, players: b.players.map((p) => p.id === "a" ? { ...p, tier: "A" as const } : p) };
    const r: Session = { ...b, players: b.players.map((p) => { if (p.id !== "a") return p; const { tier: _t, ...rest } = p; void _t; return rest; }) };
    const { state } = mergeSessions(b, l, r);
    expect("tier" in state.players.find((p) => p.id === "a")!).toBe(false);
  });

  it("a player removed on one phone and untouched on the other is gone; removed but dealt is restored", () => {
    const b: Session = { ...night(), matches: [] };
    const l: Session = { ...b, players: b.players.filter((p) => p.id !== "h") };
    expect(mergeSessions(b, l, b).state.players.some((p) => p.id === "h")).toBe(false);
    const r = deal(b, live("m-2-1", 2, 1, ["e", "f", "g", "h"]));
    const { state } = mergeSessions(b, l, r);
    expect(state.players.some((p) => p.id === "h")).toBe(true);
    expect(state.matches).toHaveLength(1);
  });

  it("a walk-in typed on both phones is one person, and the local game follows the row's id", () => {
    const b: Session = { ...night(), matches: [] };
    const l: Session = { ...b, players: [...b.players, player("w-local", 1, { name: " sam ", walkIn: true })] };
    const lWithGame = deal(l, live("m-1-1-l", 1, 1, ["a", "b", "c", "w-local"]));
    const r: Session = { ...b, players: [...b.players, player("w-row", null, { name: "Sam", walkIn: true })] };
    const { state, notes } = mergeSessions(b, lWithGame, r);
    expect(state.players.filter((p) => p.walkIn).map((p) => p.id)).toEqual(["w-row"]);
    expect(state.players.find((p) => p.id === "w-row")?.courtNumber).toBe(1);
    expect(match(state, "m-1-1-l")?.teamB).toEqual(["c", "w-row"]);
    expect(notes[0]).toMatchObject({ kind: "walkInFolded", name: "Sam" });
  });

  it("ending the night on one phone keeps the score typed on the other", () => {
    const b = night();
    const l: Session = { ...b, status: "ended", endedAt: 9000 };
    const { state } = mergeSessions(b, l, score(b, "m1", 7, 5));
    expect(state.status).toBe("ended");
    expect(match(state, "m1")?.status).toBe("played");
  });

  it("starting from setup on one phone keeps the walk-in added on the other", () => {
    const b: Session = { ...night(), status: "setup", startedAt: null, matches: [] };
    const l: Session = { ...b, status: "running", startedAt: 777 };
    const r: Session = { ...b, players: [...b.players, player("w-1", 2, { name: "Zed", walkIn: true })] };
    const { state } = mergeSessions(b, l, r);
    expect(state.status).toBe("running");
    expect(state.players.some((p) => p.id === "w-1")).toBe(true);
  });
});

describe("rule 1: a restarted night stands whole", () => {
  const startedOver = (s: Session): Session => ({ ...s, matches: [], startedAt: 999, teamsEnding: null });

  it("start over on this phone beats a score on the row", () => {
    const b = score(night(), "m1", 7, 5);
    const { state, notes } = mergeSessions(b, startedOver(b), score(b, "m2", 6, 7));
    expect(state.matches).toEqual([]);
    expect(notes).toEqual([]);
  });

  it("start over on the row beats a score on this phone, and says so", () => {
    const b = score(night(), "m1", 7, 5);
    const { state, notes } = mergeSessions(b, score(b, "m2", 6, 7), startedOver(b));
    expect(state.matches).toEqual([]);
    expect(notes).toEqual([{ kind: "nightReplaced" }]);
  });

  it("both restarted: the row's night", () => {
    const b = score(night(), "m1", 7, 5);
    const l = startedOver(b);
    const r = { ...startedOver(b), startedAt: 1234 };
    expect(mergeSessions(b, l, r).state).toBe(r);
  });

  it("back to setup on the row drops this phone's taps with a note", () => {
    const b = score(night(), "m1", 7, 5);
    const r: Session = { ...b, status: "setup", startedAt: null, matches: [] };
    const { state, notes } = mergeSessions(b, score(b, "m2", 6, 7), r);
    expect(state.status).toBe("setup");
    expect(notes).toEqual([{ kind: "nightReplaced" }]);
  });

  it("a new night with a new id replaces the old one", () => {
    const b = night();
    const r: Session = { ...b, id: "night-2026-09-20", date: "2026-09-20", status: "setup", startedAt: null, matches: [] };
    expect(mergeSessions(b, score(b, "m1", 7, 5), r).state.id).toBe("night-2026-09-20");
  });

  it("tearing down the night's only live game is not a restart", () => {
    const b: Session = { ...night(), matches: [night().matches[0]] };
    const l = without(b, "m1");
    const r: Session = { ...b, players: b.players.map((p) => p.id === "h" ? { ...p, away: true } : p) };
    const { state } = mergeSessions(b, l, r);
    expect(state.matches).toEqual([]);
    expect(state.players.find((p) => p.id === "h")?.away).toBe(true);
  });
});

describe("without a base", () => {
  it("keeps everything this phone has and everything the row has, and deletes nothing", () => {
    const l = score(night(), "m1", 7, 5);
    const r: Session = { ...score(night(), "m2", 6, 7), players: night().players.filter((p) => p.id !== "h") };
    const { state } = mergeSessions(null, l, r);
    expect(match(state, "m1")?.status).toBe("played");
    expect(match(state, "m2")?.status).toBe("played");
    expect(state.players.some((p) => p.id === "h")).toBe(true);
  });

  it("a blank night started offline never rolls the row's running night back to setup", () => {
    const l: Session = { ...night(), status: "setup", startedAt: null, players: [], courts: [], matches: [] };
    const r = score(night(), "m1", 7, 5);
    const { state } = mergeSessions(null, l, r);
    expect(state.status).toBe("running");
    expect(state.startedAt).toBe(500);
    expect(state.players).toHaveLength(8);
    expect(match(state, "m1")?.status).toBe("played");
  });

  it("a different night on the row replaces this phone's", () => {
    const l = night();
    const r: Session = { ...night(), id: "night-2026-09-20" };
    expect(mergeSessions(null, l, r).state).toBe(r);
  });

  it("a recorded score on the row is never overwritten by this phone's unplayed copy", () => {
    const l = night();
    const r = score(night(), "m1", 7, 5);
    expect(mergeSessions(null, l, r).state.matches.find((m) => m.id === "m1")?.status).toBe("played");
  });
});
