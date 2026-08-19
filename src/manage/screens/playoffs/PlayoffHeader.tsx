// The header bar frames 19a, 19b, 20 and 21 share.
//
// Left title / right court, `justify-content:space-between`, one hairline
// underneath. The court side is a LABEL, never a switcher: a playoff belongs to
// one court and this screen cannot hop to another one.
//
// v1 put a bottom tab bar on every playoff frame and stamped a `Round 4 done`
// chip beside the title. v2 drops both, and so does this: the playoff surface
// is a full-screen mode entered from the Standings tab and left through the
// header or `Back to bracket`.

import type { CSSProperties, ReactNode } from "react";
import { T } from "../../ui/primitives";

export interface PlayoffHeaderProps {
  /** Left side: `Playoff` on 19 and 20, the stage label on 21. */
  title: ReactNode;
  courtNumber: number;
  /** Frame 21 sets the left side as an uppercase stage label. */
  stage?: boolean;
}

const TITLE: CSSProperties = { font: "700 20px Inter, sans-serif" };

const STAGE_TITLE: CSSProperties = {
  font: "800 14px Inter, sans-serif",
  letterSpacing: ".1em",
  textTransform: "uppercase",
};

export const PlayoffHeader = ({ title, courtNumber, stage }: PlayoffHeaderProps) => (
  <div
    style={{
      padding: "14px 18px",
      borderBottom: `1px solid ${T.lineSoft}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <div style={stage ? STAGE_TITLE : TITLE}>{title}</div>
    {/* The numeral sits inside a label, so it stays in Inter. */}
    <div style={{ font: stage ? "700 17px Inter, sans-serif" : "600 16px Inter, sans-serif" }}>
      Court {courtNumber}
    </div>
  </div>
);

export default PlayoffHeader;
