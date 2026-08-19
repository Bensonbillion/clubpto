// Who can still be taken out of the night, and who cannot.
//
// Once the roster is a catalogue of 66 names, the wizard's tick is no longer a
// form the operator fills before the night starts. It is a live view of who is
// in, reachable mid-night from Home, so an untick can now land on somebody who
// has already played three matches in front of everyone.
//
// Deleting that person does not undo their games. Match rows hold player IDS,
// and nothing removes an id from a match, so the result is a night that renders
// `p-ade` where a name belongs, a standings table missing a row while that
// player's wins still move everyone else's score difference, and a playoff that
// reseeds from a smaller pool than the one that played. None of it announces
// itself. That is what these tests hold shut.

import { describe, expect, it } from "vitest";
import { appearsInAMatch } from "../roster-guard";
import type { Match } from "../../types";

let seq = 0;
const match = (
  teamA: [string, string],
  teamB: [string, string],
  status: Match["status"] = "played",
): Match => ({
  id: `m${++seq}`, courtNumber: 1, matchIndex: seq,
  teamA, teamB, scoreA: status === "played" ? 21 : null, scoreB: status === "played" ? 9 : null,
  status, startedAt: seq, completedAt: status === "played" ? seq : null, stage: null,
});

describe("appearsInAMatch", () => {
  it("pins anyone whose id is in a played match", () => {
    seq = 0;
    const ms = [match(["ade", "ayo"], ["timi", "tumi"])];
    for (const id of ["ade", "ayo", "timi", "tumi"]) {
      expect(appearsInAMatch(ms, id)).toBe(true);
    }
  });

  it("pins the four people standing on court RIGHT NOW", () => {
    // The subtle one. Counting only completed matches would let the operator
    // delete somebody mid-rally, and the live match card would immediately
    // start rendering their raw id in front of the room.
    seq = 0;
    const ms = [match(["ade", "ayo"], ["timi", "tumi"], "onCourt")];
    expect(appearsInAMatch(ms, "ade")).toBe(true);
  });

  it("does NOT pin someone whose only match was voided", () => {
    // A voided match counts for nothing, so it holds nobody in the night.
    seq = 0;
    const ms = [match(["ade", "ayo"], ["timi", "tumi"], "voided")];
    expect(appearsInAMatch(ms, "ade")).toBe(false);
  });

  it("does not pin someone who has only been ticked in", () => {
    seq = 0;
    expect(appearsInAMatch([match(["ade", "ayo"], ["timi", "tumi"])], "hamid")).toBe(false);
  });

  it("is not fooled by an id that is merely a prefix of a real one", () => {
    // Roster ids are `p-timi` and `p-timi-olaoye`, two different people. A
    // substring test here would pin the wrong one, or free the wrong one.
    seq = 0;
    const ms = [match(["p-timi-olaoye", "p-ayo"], ["p-tumi", "p-ade"])];
    expect(appearsInAMatch(ms, "p-timi")).toBe(false);
    expect(appearsInAMatch(ms, "p-timi-olaoye")).toBe(true);
  });
});
