// Frame 12, Score entry, both sides.
//
// BOTH NUMBERS GO IN. There is no winner tapped first and no fixed target
// score: the higher number takes the 3 points, so 7-6 wins exactly like 7-0,
// and the margin only ever feeds score difference. That is the rule the sheet
// exists to make un-mistakable, which is why the sentence explaining it sits
// between the boxes and the pad rather than under them.
//
// The two boxes are one control. Tapping a box moves the keypad to it, which
// is why the sage 2px border is on the focused one rather than on a winner:
// nothing on this sheet knows who won until Save.
//
// The digits are local state on purpose. A half-typed score is not part of the
// night, it belongs to this sheet, and useSession stays the only thing that
// writes a result.
//
// What a tap on Save MEANS is not in this file any more (2026-09-15). The rule
// and the two held lines live in model.ts, where a test can reach them. They
// used to be two booleans and an if-ladder inside the Save key's onClick, and
// one of the two booleans was never cleared because the function that cleared
// it was never called. Nothing in a node test run can open this sheet, so that
// caller could only have been missed by reading, and it was.

import { useState } from "react";
import { PrimaryButton, SecondaryButton, Screen, Sheet, T } from "../../ui/primitives";
import { CourtHeader } from "./CourtHeader";
import {
  NOTHING_HELD,
  askedAbout,
  bigScoreHeld,
  heldLevel,
  levelLineHeld,
  saveIntent,
} from "./model";
import type { CourtChip, HeldLines } from "./model";

export interface ScoreEntryProps {
  /** The header behind the sheet stays live: frame 12 keeps the chip row. */
  courts: CourtChip[];
  activeCourtNumber: number;
  onSelectCourt: (courtNumber: number) => void;
  onOpenNightMenu: () => void;
  /** The two pairs, in the order frame 10 drew them. */
  pairA: string;
  pairB: string;
  /**
   * The whole entry lives in the CALLER, not here. Script 2's demand: flip to
   * the other court with one number typed, and the sheet must come back with
   * that number still staged. Component state dies with the flip, so the
   * digits are the shell's per-court memory and this screen just draws them.
   */
  side: "A" | "B";
  a: string;
  b: string;
  onEntry: (next: { side: "A" | "B"; a: string; b: string }) => void;
  /** Save. Both numbers, in pair order; the caller decides who won. */
  onSave: (scoreA: number, scoreB: number) => void;
  /** Frame 12 draws no cancel, so the scrim is the way out. */
  onDismiss: () => void;
}

/** Exported for the shell, which now owns the draft it seeds from a score. */
export const startValue = (score: number | null | undefined): string =>
  score == null ? "" : String(score);

export const ScoreEntry = ({
  courts,
  activeCourtNumber,
  onSelectCourt,
  onOpenNightMenu,
  pairA,
  pairB,
  side,
  a,
  b,
  onEntry,
  onSave,
  onDismiss,
}: ScoreEntryProps) => {
  /**
   * The two lines this sheet can hold up instead of the margin sentence, in
   * ONE piece of state.
   *
   * The big-score nudge came from a live walk: a mistap recorded 75-0 and the
   * night carried a +74 score difference nobody meant. Games at the club go to
   * about seven, so anything past that line is far more often a typo than a
   * result. It is a nudge and never a wall, because the app does not get to
   * overrule a score the room saw. The level line is the other one: a draw is
   * refused by the writer, and refusing silently looked like a save that lost
   * the numbers, so the sentence says what to do instead.
   *
   * Both are stored as the entry they were raised over rather than as a flag,
   * so an edit withdraws them by moving the numbers out from under them. That
   * is why write() and setSide() below clear nothing. Before 2026-09-15 they
   * each cleared the level flag by hand and neither cleared the nudge, and the
   * nudge then latched for the life of the sheet: nudge on a mistyped 75, fix
   * it, mistype 99, and the second one saved on a single tap. The reset that
   * was supposed to stop that existed, with a comment, and had no caller.
   */
  const [held, setHeld] = useState<HeldLines>(NOTHING_HELD);
  const levelHeld = levelLineHeld(a, b, side, held);
  const confirmBig = bigScoreHeld(a, b, held);

  const current = side === "A" ? a : b;
  const write = (next: string) => {
    onEntry(side === "A" ? { side, a: next, b } : { side, a, b: next });
  };
  const setSide = (which: "A" | "B") => {
    onEntry({ side: which, a, b });
  };

  // Two digits is the whole range a padel score reaches, and capping here is
  // what stops a stuck thumb turning 7 into 777 on a phone with no cursor.
  const digit = (d: string) => write((current + d).slice(0, 2));
  const back = () => write(current.slice(0, -1));

  // What the next tap on Save would do. The key is lit off the same answer
  // that the key acts on, so the dead Save key and the refusal to save can
  // never disagree: nothing is saved until both boxes hold a number, because
  // a one-sided result would score a match nobody played the other half of.
  const intent = saveIntent(a, b, held);
  const ready = intent !== "notReady";

  const box = (label: string, value: string, which: "A" | "B") => {
    const on = side === which;
    return (
      <button
        type="button"
        onClick={() => setSide(which)}
        style={{
          flex: 1,
          border: `2px solid ${on ? T.acc : T.lineDot}`,
          borderRadius: T.radiusPanel,
          padding: 12,
          textAlign: "center",
          background: "transparent",
          color: T.ink,
          cursor: "pointer",
        }}
      >
        <p style={{ font: `600 14px ${T.fontBody}`, color: on ? T.ink : T.mut, margin: "0 0 4px" }}>
          {label}
        </p>
        <span
          style={{
            fontFamily: T.fontHead,
            fontWeight: 400,
            fontSize: 44,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            // An empty box shows a dimmed 0 rather than nothing, so the two
            // boxes never sit at different heights while the first number is
            // being typed, and it is legible as a placeholder rather than as a
            // score already entered.
            color: value === "" ? T.dim : T.ink,
          }}
        >
          {value === "" ? "0" : value}
        </span>
      </button>
    );
  };

  const key = (
    label: string,
    onClick: () => void,
    style?: { background?: string; color?: string; border?: string; font?: string },
  ) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        minHeight: 50,
        border: `1px solid ${T.line}`,
        borderRadius: T.pill,
        background: "transparent",
        color: T.ink,
        fontFamily: T.fontHead,
        fontWeight: 400,
        fontSize: 22,
        cursor: "pointer",
        ...style,
      }}
    >
      {label}
    </button>
  );

  return (
    <Screen>
      <CourtHeader
        courts={courts}
        activeCourtNumber={activeCourtNumber}
        onSelectCourt={onSelectCourt}
        onOpenNightMenu={onOpenNightMenu}
      />
      <div style={{ flex: 1 }} />

      <Sheet onDismiss={onDismiss}>
        <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
          Enter both scores
        </p>

        <div style={{ display: "flex", alignItems: "stretch", gap: 10 }}>
          {box(pairA, a, "A")}
          {box(pairB, b, "B")}
        </div>

        {/* The frame joins the first two clauses with an em dash. The house
            voice does not use one, so it takes the night spec's own "so". */}
        {levelHeld ? (
          <p style={{ font: `600 14.5px/1.5 ${T.fontBody}`, color: T.ink, margin: 0 }}>
            Level score. Tap the side that won and set its number.
          </p>
        ) : confirmBig ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* No frame draws this state. The sentence names the number and
                what to do, and never apologises. Fixing is the filled action
                because keeping a typo is the one that costs the standings. */}
            <p style={{ font: `600 14.5px/1.5 ${T.fontBody}`, color: T.ink, margin: 0 }}>
              {Number(a) > Number(b) ? a : b} points is a big score for one game.
              Keep it, or fix it before it lands in the standings.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <PrimaryButton
                style={{ flex: 1, minHeight: 48 }}
                onClick={() => setHeld(NOTHING_HELD)}
              >
                Fix the score
              </PrimaryButton>
              <SecondaryButton
                style={{ flex: 1, minHeight: 48 }}
                onClick={() => onSave(Number(a), Number(b))}
              >
                Keep {a}-{b}
              </SecondaryButton>
            </div>
          </div>
        ) : (
          <p style={{ font: `400 14px/1.55 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
            Higher score takes the 3 points, so 7-6 wins like 7-0. The margin only feeds score
            difference.
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => key(d, () => digit(d)))}
          {key("⌫", back, { font: `600 16px ${T.fontBody}` })}
          {key("0", () => digit("0"))}
          {key(
            "Save",
            () => {
              // Four outcomes, and the sheet only decides which line to hold
              // up. `onSave` is untouched: the same two numbers in the same
              // pair order, and the caller still decides who won.
              switch (intent) {
                case "notReady":
                  return;
                case "holdLevel":
                  setHeld(heldLevel(a, b, side));
                  return;
                case "askBigScore":
                  setHeld(askedAbout(a, b));
                  return;
                case "save":
                  onSave(Number(a), Number(b));
              }
            },
            {
              font: `700 16px ${T.fontBody}`,
              border: "none",
              background: ready ? T.acc : T.offBg,
              color: ready ? T.accInk : T.offInk,
            },
          )}
        </div>
      </Sheet>
    </Screen>
  );
};
