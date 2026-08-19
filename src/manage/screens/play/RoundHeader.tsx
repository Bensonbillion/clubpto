// Round header — shared by frame 10 and frame 11.
//
// Both numerals are VT323 values inside an otherwise-Inter line. The court
// label is NOT interactive here; court switching lives on frame 12's strip.

import { Num, T } from "../../ui/primitives";

export interface RoundHeaderProps {
  round: number;
  totalRounds: number;
  courtNumber: number;
  /** Frame 11 renders the header behind the sheet at .35. */
  dimmed?: boolean;
}

export const RoundHeader = ({ round, totalRounds, courtNumber, dimmed }: RoundHeaderProps) => (
  <div
    style={{
      padding: "14px 18px",
      borderBottom: `1px solid ${T.lineSoft}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      opacity: dimmed ? 0.35 : 1,
    }}
  >
    <p
      style={{
        font: "700 14px Inter, sans-serif",
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: T.ink45,
        margin: 0,
      }}
    >
      Round <Num size={20}>{round}</Num> of <Num size={20}>{totalRounds}</Num>
    </p>
    <p style={{ font: "700 17px Inter, sans-serif", margin: 0 }}>Court {courtNumber}</p>
  </div>
);
