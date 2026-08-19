// Frame 10's second row: an arrow, where you are, an arrow.
//
// The arrows walk the schedule, and the schedule has no required order. That
// is why they are always live rather than clamped at the ends: a match the
// operator steps past is not lost, it goes back to waiting and the arrows
// bring it round again (frame 12b).
//
// "Match 3 of 6 · Round 2" carries both numbers because they answer different
// questions. The match number is where the court is in its own list; the round
// is how many games each player has had, which is the number anyone standing
// on the sideline actually asks about.

import { Eyebrow, T } from "../../ui/primitives";

export interface MatchNavProps {
  matchNumber: number;
  matchesTotal: number;
  round: number;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
  /**
   * Frame 11, "Why this four".
   *
   * No frame draws an entry point for it, so rather than invent a control with
   * words of its own this makes the line between the arrows the way in.
   * Nothing new appears on screen.
   */
  onExplain?: () => void;
}

const ARROW = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  padding: "4px 15px",
  borderRadius: T.pill,
  border: `1.5px solid ${T.lineChip}`,
  background: "transparent",
  fontFamily: T.fontHead,
  fontWeight: 400,
  fontSize: 17,
  cursor: "pointer",
} as const;

export const MatchNav = ({
  matchNumber,
  matchesTotal,
  round,
  onPreviousMatch,
  onNextMatch,
  onExplain,
}: MatchNavProps) => {
  const where = (
    <Eyebrow>
      Match {matchNumber} of {matchesTotal} &middot; Round {round}
    </Eyebrow>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 22px 0",
        gap: 10,
      }}
    >
      <button type="button" onClick={onPreviousMatch} aria-label="Previous match"
        style={{ ...ARROW, color: T.ink }}>
        &#8249;
      </button>

      {onExplain ? (
        <button type="button" onClick={onExplain}
          style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
          {where}
        </button>
      ) : (
        where
      )}

      <button type="button" onClick={onNextMatch} aria-label="Next match"
        style={{ ...ARROW, color: T.ink }}>
        &#8250;
      </button>
    </div>
  );
};
