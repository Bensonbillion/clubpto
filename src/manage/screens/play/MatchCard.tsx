// The match, as frame 10 draws it: two pair cards with the score slat between.
//
// The pair card IS the button, and both cards do the same thing. There is no
// winner to pick first any more: the score sheet takes both numbers and the
// higher one takes the points, so tapping a card only says which side's box
// the keypad should start on. That is worth keeping, because the operator taps
// the pair whose score they were told first.
//
// The cards are outlined, not filled. The screen's one fill is spent on Save,
// one sheet later.

import { T } from "../../ui/primitives";
import { ScoreSlat } from "./ScoreSlat";
import { padScore, type PairSide } from "./model";

export interface MatchCardProps {
  sideA: PairSide;
  sideB: PairSide;
  /** Opens frame 12 with that side's box focused. */
  onScore: (side: "A" | "B") => void;
}

export const MatchCard = ({ sideA, sideB, onScore }: MatchCardProps) => {
  const pairCard = (side: PairSide, which: "A" | "B", margin: string) => (
    <button
      type="button"
      onClick={() => onScore(which)}
      style={{
        margin,
        padding: 22,
        textAlign: "center",
        border: `1.5px solid ${T.lineChip}`,
        borderRadius: T.radius,
        background: "transparent",
        color: T.ink,
        cursor: "pointer",
        display: "block",
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 29, lineHeight: 1.15 }}>
        {side.pairLabel}
      </span>
      <p
        style={{
          font: `600 12px ${T.fontBody}`,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: T.soft,
          margin: "8px 0 0",
        }}
      >
        Tap to score
      </p>
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {pairCard(sideA, "A", "14px 14px 12px")}
      <ScoreSlat left={padScore(sideA.score)} right={padScore(sideB.score)} />
      {pairCard(sideB, "B", "12px 14px 14px")}
    </div>
  );
};
