// @vitest-environment jsdom
//
// Frame 12, the score sheet, driven the way a thumb drives it.
//
// The first test in this repo that CLICKS something. Everything before it
// either called an engine function or server-rendered a page to a string, so
// six hundred tests could not have told you whether a button was wired to the
// rule underneath it. That gap is not hypothetical: ScoreEntry.tsx declares
// `unNudge`, with a comment saying what it is for, and nothing calls it.
//
// The sheet is a controlled component. `a`, `b` and `side` live in the shell
// so that flipping to the other court keeps a half-typed score staged, so the
// harness below holds them exactly as ManageApp does. That is the point of
// testing it this way round: the wiring between the sheet and its caller is
// the part that was never covered.

import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreEntry } from "../screens/play/ScoreEntry";

/** The shell, as far as this sheet can tell. */
const Sheet = ({ onSave }: { onSave: (a: number, b: number) => void }) => {
  const [entry, setEntry] = useState<{ side: "A" | "B"; a: string; b: string }>({
    side: "A", a: "", b: "",
  });
  return (
    <ScoreEntry
      courts={[{ number: 1, scoreDue: false }]}
      activeCourtNumber={1}
      onSelectCourt={() => {}}
      onOpenNightMenu={() => {}}
      pairA="Kate & Sam"
      pairB="Ben & Priya"
      side={entry.side}
      a={entry.a}
      b={entry.b}
      onEntry={setEntry}
      onSave={onSave}
      onDismiss={() => {}}
    />
  );
};

/** Tap digits into the focused box. */
const type = async (user: ReturnType<typeof userEvent.setup>, digits: string) => {
  for (const d of digits) await user.click(screen.getByRole("button", { name: d }));
};
const tap = async (user: ReturnType<typeof userEvent.setup>, name: string | RegExp) =>
  user.click(screen.getByRole("button", { name }));

const openSheet = (onSave = vi.fn()) => {
  const user = userEvent.setup();
  render(<Sheet onSave={onSave} />);
  return { user, onSave };
};

describe("both numbers go in", () => {
  it("refuses to save a half-typed score", async () => {
    const { user, onSave } = openSheet();
    await type(user, "7");                    // only side A
    await tap(user, "Save");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves the two numbers in pair order once both boxes hold one", async () => {
    const { user, onSave } = openSheet();
    await type(user, "7");
    await tap(user, /Ben & Priya/);           // move the keypad to side B
    await type(user, "6");
    await tap(user, "Save");
    expect(onSave).toHaveBeenCalledWith(7, 6);
  });

  it("caps a box at two digits, because a stuck thumb turns 1 into 1111", async () => {
    // Kept under the big-score line on purpose. Anything past twenty raises
    // the nudge instead of saving, which is the next describe's business.
    const { user, onSave } = openSheet();
    await type(user, "1234");
    await tap(user, /Ben & Priya/);
    await type(user, "0");
    await tap(user, "Save");
    expect(onSave).toHaveBeenCalledWith(12, 0);
  });
});

describe("a level score is held, not saved", () => {
  it("says what to do instead of silently losing the numbers", async () => {
    const { user, onSave } = openSheet();
    await type(user, "7");
    await tap(user, /Ben & Priya/);
    await type(user, "7");
    await tap(user, "Save");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Level score/i)).toBeInTheDocument();
  });

  it("takes the line back down as soon as the operator edits", async () => {
    const { user } = openSheet();
    await type(user, "7");
    await tap(user, /Ben & Priya/);
    await type(user, "7");
    await tap(user, "Save");
    expect(screen.getByText(/Level score/i)).toBeInTheDocument();
    await tap(user, "⌫");
    expect(screen.queryByText(/Level score/i)).not.toBeInTheDocument();
  });
});

describe("the big-score nudge", () => {
  it("asks before a number big enough to be a mistap lands", async () => {
    const { user, onSave } = openSheet();
    await type(user, "75");
    await tap(user, /Ben & Priya/);
    await type(user, "0");
    await tap(user, "Save");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/big score for one game/i)).toBeInTheDocument();
  });

  it("keeps the score on the second tap, because it is a nudge and not a wall", async () => {
    const { user, onSave } = openSheet();
    await type(user, "75");
    await tap(user, /Ben & Priya/);
    await type(user, "0");
    await tap(user, "Save");
    await tap(user, /Keep 75-0/);
    expect(onSave).toHaveBeenCalledWith(75, 0);
  });

  it("puts the operator back on the pad when they choose to fix it", async () => {
    const { user, onSave } = openSheet();
    await type(user, "75");
    await tap(user, /Ben & Priya/);
    await type(user, "0");
    await tap(user, "Save");
    await tap(user, /Fix the score/);
    expect(screen.queryByText(/big score for one game/i)).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
