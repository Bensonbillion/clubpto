// `.slat`. The near-black score bar frame 22 puts between the two sides.
//
// It used to be a sage band, and sage is now the fill the screen spends on its
// one forward action, so the slat drops the floor out instead: --deep ground,
// white numerals, a 20px corner and 44px of air between the two numbers. That
// is the same move frames 12 and 23 make, and it is why a score reads from the
// bench without competing with a button.
//
// Nothing here is tappable. Frame 22 puts the taps on the two named cards, so
// the slat is a display, not a control.

import { T } from "../../ui/primitives";
import { scoreText } from "./model";

export interface ScoreBandProps {
  /** Null renders 00, the pre-score state, never an editable field. */
  scoreA: number | null;
  scoreB: number | null;
  /** 86 on the playoff match. A prop rather than a second component. */
  size: number;
  /** Vertical padding inside the slat. */
  cellPadding?: number;
}

export const ScoreBand = ({ scoreA, scoreB, size, cellPadding = 10 }: ScoreBandProps) => {
  const numeral = (value: string) => (
    <span style={{
      fontFamily: T.fontHead, fontWeight: 400, fontSize: size, lineHeight: 0.9,
      fontVariantNumeric: "tabular-nums", color: "#fff",
    }}>{value}</span>
  );

  return (
    <div style={{
      background: T.deep, borderRadius: T.radiusPanel, margin: "0 14px",
      padding: `${cellPadding}px 0`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 44,
    }}>
      {numeral(scoreText(scoreA))}
      {numeral(scoreText(scoreB))}
    </div>
  );
};

export default ScoreBand;
