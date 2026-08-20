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

import { useState } from "react";
import { Screen, Sheet, T } from "../../ui/primitives";
import { CourtHeader } from "./CourtHeader";
import type { CourtChip } from "./model";

export interface ScoreEntryProps {
  /** The header behind the sheet stays live: frame 12 keeps the chip row. */
  courts: CourtChip[];
  activeCourtNumber: number;
  onSelectCourt: (courtNumber: number) => void;
  onOpenNightMenu: () => void;
  /** The two pairs, in the order frame 10 drew them. */
  pairA: string;
  pairB: string;
  /** Which box the keypad starts on, from the card the operator tapped. */
  initialSide?: "A" | "B";
  /** Existing numbers when a recorded score is being corrected (frame 16). */
  scoreA?: number | null;
  scoreB?: number | null;
  /** Save. Both numbers, in pair order; the caller decides who won. */
  onSave: (scoreA: number, scoreB: number) => void;
  /** Frame 12 draws no cancel, so the scrim is the way out. */
  onDismiss: () => void;
}

const startValue = (score: number | null | undefined): string =>
  score == null ? "" : String(score);

export const ScoreEntry = ({
  courts,
  activeCourtNumber,
  onSelectCourt,
  onOpenNightMenu,
  pairA,
  pairB,
  initialSide = "A",
  scoreA,
  scoreB,
  onSave,
  onDismiss,
}: ScoreEntryProps) => {
  const [side, setSide] = useState<"A" | "B">(initialSide);
  const [a, setA] = useState(() => startValue(scoreA));
  const [b, setB] = useState(() => startValue(scoreB));

  const current = side === "A" ? a : b;
  const write = (next: string) => (side === "A" ? setA(next) : setB(next));

  // Two digits is the whole range a padel score reaches, and capping here is
  // what stops a stuck thumb turning 7 into 777 on a phone with no cursor.
  const digit = (d: string) => write((current + d).slice(0, 2));
  const back = () => write(current.slice(0, -1));

  // Nothing is saved until both boxes hold a number. A one-sided result would
  // score a match nobody played the other half of.
  const ready = a !== "" && b !== "";

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
        <p style={{ font: `400 14px/1.55 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
          Higher score takes the 3 points, so 7-6 wins like 7-0. The margin only feeds score
          difference.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => key(d, () => digit(d)))}
          {key("⌫", back, { font: `600 16px ${T.fontBody}` })}
          {key("0", () => digit("0"))}
          {key(
            "Save",
            () => { if (ready) onSave(Number(a), Number(b)); },
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
