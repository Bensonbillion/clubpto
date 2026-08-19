// Frame 16, Correct or void a result.
//
// The card at the top is not decoration: the sheet's first job is to let the
// operator confirm they are looking at the right match, so the two pairs and
// the score they are about to change are stated before either action is.
//
// Neither action is filled. Frame 16 draws two ghosts, one of them outlined in
// terracotta, so nothing on the sheet reads as the happy path and the
// irreversible one costs a beat more attention than the reversible one. The
// explanation sits UNDER the buttons, where it is the last thing read before
// the tap rather than something scrolled past on the way in.

import { SecondaryButton, Sheet, T } from "../../ui/primitives";
import { pairName } from "./model";

export interface CorrectOrVoidMatch {
  id: string;
  /** The court's round, which is what frame 16's eyebrow names. */
  roundNumber: number;
  /** "Court 1". */
  courtLabel: string;
  sideA: [string, string];
  sideB: [string, string];
  scoreA: number;
  scoreB: number;
}

export interface CorrectOrVoidProps {
  match: CorrectOrVoidMatch;
  onChangeScore: () => void;
  /** Opens the confirmation (frame 28a, in the summary-states slice). Nothing
   *  is changed yet. */
  onVoid: () => void;
  onDismiss: () => void;
}

export const CorrectOrVoid = ({ match, onChangeScore, onVoid, onDismiss }: CorrectOrVoidProps) => (
  <Sheet onDismiss={onDismiss}>
    <p
      style={{
        font: `600 11.5px ${T.fontBody}`,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: T.mut,
        margin: 0,
      }}
    >
      Round {match.roundNumber} &middot; {match.courtLabel}
    </p>

    <div
      style={{
        background: T.raised,
        border: `1.5px solid ${T.line}`,
        borderRadius: T.radius,
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span style={{ font: `600 15px ${T.fontBody}`, flex: 1, minWidth: 0 }}>
        {pairName(match.sideA)}
      </span>
      <span
        style={{
          fontFamily: T.fontHead,
          fontWeight: 400,
          fontSize: 22,
          fontVariantNumeric: "tabular-nums",
          background: T.deep,
          borderRadius: T.pill,
          padding: "4px 14px",
          whiteSpace: "nowrap",
        }}
      >
        {/* Bare numbers, not padded. Games run to whatever they run to now, so
            a leading zero would be a digit the match never had. */}
        {match.scoreA}&nbsp;&nbsp;{match.scoreB}
      </span>
      <span
        style={{ font: `600 15px ${T.fontBody}`, color: T.soft, flex: 1, minWidth: 0, textAlign: "right" }}
      >
        {pairName(match.sideB)}
      </span>
    </div>

    <SecondaryButton onClick={onChangeScore}>Change the score</SecondaryButton>
    <SecondaryButton style={{ borderColor: T.bad, color: T.redInk }} onClick={onVoid}>
      Void this result
    </SecondaryButton>

    <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
      Voiding removes the game from the standings and returns all four to the queue at their
      previous counts.
    </p>
  </Sheet>
);
