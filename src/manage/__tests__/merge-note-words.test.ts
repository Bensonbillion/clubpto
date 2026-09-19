// The sentences a phone reads after a merge, tested as sentences.
//
// They used to be built inside a useEffect in useSession.ts, a closure over
// the session, so nothing could read them without rendering the app. That is
// how three of them came to print "null-null" without anyone noticing: a
// knockout walkover carries no scores by design (types.ts, Match.walkover),
// and the result sentence interpolated scoreA and scoreB regardless.
//
//   row walkover, this phone scored:
//     "another phone scored A & B against C & D null-null first. Your 7-5 was not kept"
//   row scored, this phone recorded a walkover:
//     "another phone scored A & B against C & D 7-5 first. Your null-null was not kept"
//
// Both are real conflicts and deserve their note. They deserve true words.

import { describe, expect, it } from "vitest";
import type { Match } from "../types";
import type { MergeNote } from "../sync/merge";
import { mergeNoteWords } from "../sync/noteWords";

const nameOf = (id: string) => id.toUpperCase();

const game = (over: Partial<Match> = {}): Match => ({
  id: "g", courtNumber: 1, matchIndex: 1,
  teamA: ["a", "b"], teamB: ["c", "d"],
  scoreA: null, scoreB: null, status: "played", startedAt: 1000, completedAt: 2000, stage: null,
  ...over,
});
const scored = (a: number, b: number) => game({ scoreA: a, scoreB: b });
const walkover = (side: "A" | "B") => game({ walkover: side, stage: "semi" });
const kept = (k: Match, d: Match): MergeNote => ({ kind: "resultKept", courtNumber: 1, kept: k, dropped: d });

describe("the sentences that were already right stay word for word", () => {
  it("two different scores", () => {
    expect(mergeNoteWords(kept(scored(7, 4), scored(7, 2)), nameOf)).toBe(
      "Court 1: another phone scored A & B against C & D 7-4 first. Your 7-2 was not kept; tap the result to correct it.",
    );
  });

  it("a score over this phone's void", () => {
    expect(mergeNoteWords(kept(scored(7, 4), game({ status: "voided" })), nameOf)).toBe(
      "Court 1: another phone scored A & B against C & D 7-4 first, so your void was not kept. Void it again from the result if that is right.",
    );
  });

  it("a void over this phone's score", () => {
    expect(mergeNoteWords(kept(game({ status: "voided", scoreA: 7, scoreB: 5 }), scored(7, 6)), nameOf)).toBe(
      "Court 1: another phone voided A & B against C & D. Your score for it was not kept.",
    );
  });

  it("the other kinds", () => {
    expect(mergeNoteWords({ kind: "nightReplaced" }, nameOf)).toBe(
      "Another phone restarted the night. Your last change was not kept.",
    );
    expect(mergeNoteWords({ kind: "walkInFolded", name: "Tomi" }, nameOf)).toBe(
      "Tomi was added on both phones and is now one player.",
    );
    expect(mergeNoteWords({ kind: "leaverDealtAround", courtNumber: 2, playerId: "e" }, nameOf)).toBe(
      "Court 2: E left on another phone. The game they were in was dealt again without them.",
    );
    expect(mergeNoteWords({ kind: "fieldKept", entity: "player", id: "a", field: "tier" }, nameOf)).toBe(
      "Another phone set A's tier first.",
    );
  });
});

describe("a walkover is said as a walkover", () => {
  it("the row's walkover: no null-null, and it says who went through", () => {
    const words = mergeNoteWords(kept(walkover("A"), scored(7, 5)), nameOf);
    expect(words).not.toMatch(/null|undefined/);
    expect(words).toMatch(/walkover/i);
    expect(words).toContain("A & B");
    expect(words).toContain("7-5");
  });

  it("this phone's walkover, lost to the row's score: said as a walkover", () => {
    const words = mergeNoteWords(kept(scored(7, 5), walkover("B")), nameOf);
    expect(words).not.toMatch(/null|undefined/);
    expect(words).toMatch(/your walkover/i);
    expect(words).toContain("7-5");
  });

  it("walkover against walkover the other way round", () => {
    const words = mergeNoteWords(kept(walkover("B"), walkover("A")), nameOf);
    expect(words).not.toMatch(/null|undefined/);
    expect(words).toContain("C & D");
  });
});

describe("no note, of any kind, ever prints null, undefined or an em dash", () => {
  it("across every result shape a merge can hand over", () => {
    const shapes = [scored(7, 4), scored(0, 7), walkover("A"), walkover("B"), game({ status: "voided" }),
      game({ status: "voided", scoreA: 7, scoreB: 5 })];
    for (const k of shapes) for (const d of shapes) {
      const words = mergeNoteWords(kept(k, d), nameOf);
      expect(words, JSON.stringify({ k, d })).not.toMatch(/null|undefined|—/);
    }
  });
});
