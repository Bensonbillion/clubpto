// Frame 27b, Empty, third court.
//
// This was a whole screen once: court switcher, a big count, a rationale
// paragraph and a pinned footer, on the live court view. Frame 27b moves it
// back into setup and shrinks it to one dashed card inside frame 07, "Split
// the courts", so it is built as that card and nothing more.
//
// Replacing the screen would be the wrong shape here even though the frame is
// drawn on a phone body. The card says "Drag names across", and the names to
// drag are in the OTHER courts' cards on the same screen. Take those away and
// the instruction has nothing to point at.

import { SecondaryButton, T } from "../../ui/primitives";

/**
 * How many courts you drop back TO, spelled the way the frame spells it.
 *
 * The frame draws the three-court case, "drop back to two courts". Frame 07
 * offers one, two or three courts, so the only other empty court possible is
 * Court 2, and it drops back to one. Anything outside that loses the clause
 * rather than gaining an invented one; the sentence still closes cleanly on
 * "Drag names across."
 */
const DROP_BACK_TO: Record<number, string> = { 2: "one court", 3: "two courts" };

export interface EmptyCourtUnassignedProps {
  /** The court with nobody on it. Named three times in the drawn copy. */
  courtNumber: number;
  /**
   * Opens whatever the caller uses to move players onto this court. The frame
   * draws one control, so dropping back to fewer courts is left to the court
   * count chips at the top of frame 07 rather than duplicated here.
   */
  onAssignPlayers: (courtNumber: number) => void;
}

export const EmptyCourtUnassigned = ({ courtNumber, onAssignPlayers }: EmptyCourtUnassignedProps) => {
  const dropBack = DROP_BACK_TO[courtNumber];

  return (
    <div style={{
      background: T.raised, border: `1.5px dashed ${T.line}`, borderRadius: T.radius,
      padding: "28px 18px", display: "flex", flexDirection: "column",
      alignItems: "center", gap: 12, boxSizing: "border-box",
    }}>
      <span style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18 }}>
        {`Court ${courtNumber}`}
      </span>

      <p style={{
        font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0,
        textAlign: "center", textWrap: "pretty",
      }}>
        {`Nobody on Court ${courtNumber} yet. Drag names across${dropBack ? `, or drop back to ${dropBack}` : ""}.`}
      </p>

      <SecondaryButton
        onClick={() => onAssignPlayers(courtNumber)}
        style={{ width: "auto", minHeight: 46, padding: "8px 24px" }}
      >Assign players</SecondaryButton>
    </div>
  );
};
