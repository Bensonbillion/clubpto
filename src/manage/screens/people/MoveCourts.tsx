// Frame 16b, Move courts mid-night.
//
// The sheet exists because the split is done by feel at 7:00 and by 8:00 one
// court is plainly the wrong room for somebody. Moving them has to cost
// nothing: the paragraph says so in the two facts that would otherwise worry
// an operator, that the night they have already had travels with them, and
// that both courts re-derive their target guide rather than one of them
// silently ending short.
//
// The chips show the counts AFTER the move, not before. That is frame 16b's
// own arithmetic, 8 and 8 drawn as 7 and 9, and it is the whole reason to draw
// them: the operator is choosing between two shapes of the rest of the night,
// not reading a report of the present one.
//
// COPY NOTE. Frame 16b writes "His played games", "queues him next", "Keep him
// on Court 1". The roster is not all men, so the pronouns are dropped and the
// name carries the sentence instead. Every other word is the frame's.

import { PrimaryButton, Sheet, T, TertiaryButton } from "../../ui/primitives";

export interface MoveCourtsCourt {
  courtNumber: number;
  /** "Court 1". */
  label: string;
  /** Players on that court ONCE THE MOVE LANDS. */
  countAfterMove: number;
}

export interface MoveCourtsProps {
  playerName: string;
  /** The court they are on now. It names the way out, "Keep Kayode on Court 1",
   *  so it has to be one of `courts`. */
  fromCourtNumber: number;
  /** Every court, including the one they are leaving. */
  courts: MoveCourtsCourt[];
  /** The destination. The sheet is opened with one already chosen, because
   *  frame 16b's title and its button both name it. */
  selectedCourtNumber: number;
  onSelectCourt: (courtNumber: number) => void;
  onMove: () => void;
  /** Dismisses without moving. */
  onKeep: () => void;
}

export const MoveCourts = ({
  playerName,
  fromCourtNumber,
  courts,
  selectedCourtNumber,
  onSelectCourt,
  onMove,
  onKeep,
}: MoveCourtsProps) => {
  const to = courts.find((c) => c.courtNumber === selectedCourtNumber) ?? null;
  const from = courts.find((c) => c.courtNumber === fromCourtNumber) ?? null;

  return (
    <Sheet onDismiss={onKeep}>
      <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
        Move {playerName}{to ? ` to ${to.label}` : ""}
      </p>

      <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
        Played games and points travel with {playerName}.
        {from != null && ` ${from.label} drops to ${from.countAfterMove}, so its target guide updates;`}
        {to != null && ` ${to.label} queues them next at their current count.`}
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        {courts.map((court) => {
          const on = court.courtNumber === selectedCourtNumber;
          return (
            <button
              key={court.courtNumber}
              type="button"
              onClick={() => onSelectCourt(court.courtNumber)}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 52,
                padding: "6px 16px",
                borderRadius: T.pill,
                border: `1.5px solid ${on ? T.acc : T.lineChip}`,
                background: on ? T.acc : "transparent",
                color: on ? T.accInk : T.ink,
                font: `600 15px ${T.fontBody}`,
                cursor: "pointer",
              }}
            >
              {court.label} &middot; {court.countAfterMove}
            </button>
          );
        })}
      </div>

      <PrimaryButton onClick={onMove}>Move {playerName}</PrimaryButton>
      {/* The frame's way out names the court they would stay on. With that
          court missing from the list there is no sentence to write, so the
          escape falls back to the bare verb. */}
      <TertiaryButton onClick={onKeep}>
        {from != null ? `Keep ${playerName} on ${from.label}` : `Keep ${playerName} where they are`}
      </TertiaryButton>
    </Sheet>
  );
};
