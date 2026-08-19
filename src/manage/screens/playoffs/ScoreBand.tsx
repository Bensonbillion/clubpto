// The lime score band — ONE component, used at three sizes.
//
//   48px  bracket row (frame 20)
//   96px  playoff match (frame 21)
//   104px champion (frame 22)
//
// Same fill, same `1fr 1px 1fr` grid, same rgba(10,24,16,.28) divider every
// time. If a fourth size ever appears it is a prop, not a second component:
// two score bands that drift apart is exactly the failure this file prevents.
//
// Dimming differs by frame and the difference is deliberate. On a bracket row
// the losing NAME dims and both numerals stay full strength; on the champion
// frame the losing NUMBER dims. `dimSide` is only ever set by the champion.

import type { CSSProperties } from "react";
import { Num, T } from "../../ui/primitives";
import { padScore } from "./model";

export interface ScoreBandProps {
  /** Null renders 00 — the pre-score state, never an editable field. */
  scoreA: number | null;
  scoreB: number | null;
  /** 48 on a bracket row, 96 on the playoff match, 104 on the champion. */
  size: number;
  /** Cell vertical padding: 4, 10 and 14 in that same order. */
  cellPadding?: number;
  /** Champion only: the losing numeral drops to rgba(10,24,16,.45). */
  dimSide?: "A" | "B" | null;
  /** The champion band is the only one that carries its own radius (4px). */
  radius?: number;
  /** Frame 21: a tap on a half picks that side as the winner. */
  onTapSide?: (side: "A" | "B") => void;
}

const DIM_INK = "rgba(10,24,16,.45)";

export const ScoreBand = ({
  scoreA,
  scoreB,
  size,
  cellPadding = 4,
  dimSide,
  radius,
  onTapSide,
}: ScoreBandProps) => {
  const cell = (side: "A" | "B") => {
    const value = padScore(side === "A" ? scoreA : scoreB);
    const numeral = (
      <Num
        size={size}
        style={{ lineHeight: 0.9, color: dimSide === side ? DIM_INK : T.limeInk }}
      >
        {value}
      </Num>
    );

    const box: CSSProperties = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: `${cellPadding}px 0`,
    };

    return onTapSide ? (
      <button
        type="button"
        onClick={() => onTapSide(side)}
        style={{ ...box, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}
      >
        {numeral}
      </button>
    ) : (
      <div style={box}>{numeral}</div>
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1px 1fr",
        background: T.lime,
        borderRadius: radius,
        overflow: radius == null ? undefined : "hidden",
      }}
    >
      {cell("A")}
      <div style={{ background: "rgba(10,24,16,.28)" }} />
      {cell("B")}
    </div>
  );
};

export default ScoreBand;
