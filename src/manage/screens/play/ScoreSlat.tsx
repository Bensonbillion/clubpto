// `.slat`. The band the two scores sit in, on frames 10 and 12.
//
// It is the only object in the manager that drops to --deep and prints in pure
// white. That is deliberate in the frames: the slat has to read from the far
// side of a court, and cream on paper does not carry that far. There is no
// token for the white because there is no second place it is used.

import type { CSSProperties } from "react";
import { T } from "../../ui/primitives";

export interface ScoreSlatProps {
  left: string;
  right: string;
  /** 86 on frame 10, 68 on frame 12. */
  size?: number;
  /**
   * The number the operator has not entered yet, held at .35.
   *
   * Frame 12 draws the winner's 16 solid and the loser's 00 faded, so the slat
   * says which of the two numbers the keypad below is asking for.
   */
  pending?: "left" | "right";
  style?: CSSProperties;
}

export const ScoreSlat = ({ left, right, size = 86, pending, style }: ScoreSlatProps) => {
  const digits = (value: string, which: "left" | "right") => (
    <span
      style={{
        fontFamily: T.fontHead,
        fontWeight: 400,
        fontSize: size,
        lineHeight: 0.9,
        color: "#fff",
        fontVariantNumeric: "tabular-nums",
        opacity: pending === which ? 0.35 : 1,
      }}
    >
      {value}
    </span>
  );

  return (
    <div
      style={{
        background: T.deep,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 44,
        borderRadius: T.radiusPanel,
        margin: "0 14px",
        padding: "10px 0",
        ...style,
      }}
    >
      {digits(left, "left")}
      {digits(right, "right")}
    </div>
  );
};
