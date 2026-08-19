// The match card — the hero of frame 10, one notch quieter on frame 12.
//
// The lime score slat is the brightest object on the screen and the only place
// the accent appears at size. The slat only ever holds a recorded result or 00;
// there is no live in-progress score.

import { Num, T } from "../../ui/primitives";
import { padScore, type PairSide } from "./model";

export interface MatchCardProps {
  sideA: PairSide;
  sideB: PairSide;
  /** 96 on frame 10, 78 on frame 12. Defaults follow `compact`. */
  slatSize?: number;
  /** Frame 12: smaller names, tighter rows, no Side A / Side B labels. */
  compact?: boolean;
}

const SideLabel = ({ children }: { children: string }) => (
  <span
    style={{
      font: "700 13px Inter, sans-serif",
      letterSpacing: ".08em",
      textTransform: "uppercase",
      color: "rgba(244,237,224,.4)",
    }}
  >
    {children}
  </span>
);

export const MatchCard = ({ sideA, sideB, slatSize, compact }: MatchCardProps) => {
  const nameSize = compact ? 20 : 22;
  const rowPadding = compact ? "14px 18px" : "16px 18px";
  const cellPadding = compact ? "8px 0" : "10px 0";
  const size = slatSize ?? (compact ? 78 : 96);

  const nameRow = (side: PairSide, label: "Side A" | "Side B") => (
    <div
      style={{
        padding: rowPadding,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ font: `700 ${nameSize}px Inter, sans-serif` }}>{side.pairLabel}</span>
      {!compact && <SideLabel>{label}</SideLabel>}
    </div>
  );

  const cell = (side: PairSide) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: cellPadding,
      }}
    >
      <Num size={size} style={{ lineHeight: 0.9, color: T.limeInk }}>
        {padScore(side.score)}
      </Num>
    </div>
  );

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: T.radius, overflow: "hidden" }}>
      {nameRow(sideA, "Side A")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", background: T.lime }}>
        {cell(sideA)}
        <div style={{ background: "rgba(10,24,16,.28)" }} />
        {cell(sideB)}
      </div>
      {nameRow(sideB, "Side B")}
    </div>
  );
};
