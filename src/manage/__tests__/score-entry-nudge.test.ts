// Frame 12's two held lines, and the one that used to latch.
//
// Save on the score sheet has four outcomes: refuse a half-typed score, hold
// on a level one, ask about a number big enough to be a mistap, or record it.
// Two of those are questions the sheet has already asked, and a question about
// numbers that have since been retyped is not a question any more.
//
// The level line always knew that: write() and setSide() both cleared it. The
// big-score nudge did not. ScoreEntry.tsx declared `unNudge` with the comment
// "Any edit withdraws the nudge: the number it asked about no longer exists",
// and a repo-wide grep found no caller. So confirmBig latched for the sheet's
// whole life: nudge once on a mistyped 75, correct it, mistype 99, and the
// second one saved on a single tap with no nudge at all. Found 2026-09-15.
//
// The fix is not to remember to call the reset. It is to remember WHICH
// NUMBERS the nudge was raised about, so that editing them withdraws it
// because they no longer match, with nothing to remember and nothing to wire.
// That is what makes this testable at all: there is no DOM environment here
// (vitest.config.ts sets "node"), so a rule living in an onClick could only
// ever be verified by reading it.

import { describe, expect, it } from "vitest";
import { NOTHING_HELD, askedAbout, saveIntent } from "../screens/play/model";

describe("what a tap on Save should do", () => {
  it("refuses a half-typed score", () => {
    expect(saveIntent("7", "", NOTHING_HELD)).toBe("notReady");
    expect(saveIntent("", "7", NOTHING_HELD)).toBe("notReady");
    expect(saveIntent("", "", NOTHING_HELD)).toBe("notReady");
  });

  it("holds on a level score, because the writer refuses a draw", () => {
    expect(saveIntent("7", "7", NOTHING_HELD)).toBe("holdLevel");
  });

  it("records an ordinary score", () => {
    expect(saveIntent("7", "6", NOTHING_HELD)).toBe("save");
    expect(saveIntent("0", "7", NOTHING_HELD)).toBe("save");
  });

  it("asks about a number big enough to be a mistap", () => {
    // The live walk that put this here recorded 75-0 and left the night
    // carrying a score difference of +74 nobody meant.
    expect(saveIntent("75", "0", NOTHING_HELD)).toBe("askBigScore");
  });

  it("records it once the operator has answered for those exact numbers", () => {
    expect(saveIntent("75", "0", askedAbout("75", "0"))).toBe("save");
  });
});

describe("an answered nudge does not carry over to a different number", () => {
  it("asks again when the numbers have changed since it was asked", () => {
    // THE BUG. Nudge on 75-0, the operator corrects it, then mistypes 99-0.
    // The second big number used to save on one tap, because the sheet was
    // still holding the answer to a question about a score that no longer
    // existed.
    const answered = askedAbout("75", "0");
    expect(saveIntent("99", "0", answered)).toBe("askBigScore");
  });

  it("asks again when the other box is the one that changed", () => {
    const answered = askedAbout("0", "75");
    expect(saveIntent("0", "99", answered)).toBe("askBigScore");
  });

  it("asks again after an edit and a retype back to a different big number", () => {
    // The whole sequence, as the thumb does it.
    let held = NOTHING_HELD;
    expect(saveIntent("75", "0", held)).toBe("askBigScore");
    held = askedAbout("75", "0");
    expect(saveIntent("75", "0", held)).toBe("save");
    // ...operator backs out and types a different big score instead.
    expect(saveIntent("88", "0", held)).toBe("askBigScore");
  });

  it("still holds level ahead of the big-score question", () => {
    // A level score is refused by the writer whatever its size, so the level
    // line comes first and the nudge never gets a chance to be the answer.
    expect(saveIntent("75", "75", NOTHING_HELD)).toBe("holdLevel");
    expect(saveIntent("75", "75", askedAbout("75", "75"))).toBe("holdLevel");
  });
});
