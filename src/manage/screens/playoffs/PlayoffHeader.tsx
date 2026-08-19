// The `.hd` bar frames 19, 20, 21 and 22 share.
//
// Left side, right side, baseline aligned, no rule underneath. What sits on
// each side changes per frame and the frames are not consistent about it, so
// this takes nodes rather than trying to name every combination:
//
//   19, 20  a heading, and the sage eyebrow on the right
//   21      a heading, and the court in Caprasimo on the right
//   22      the sage eyebrow on the left, and the court chip on the right
//
// The court side is a LABEL on 19, 20 and 21: a playoff belongs to one court
// and those screens cannot hop to another. Frame 22 is the exception and draws
// the switcher chip, which is why `CourtChip` lives here with a callback.

import type { CSSProperties, ReactNode } from "react";
import { T } from "../../ui/primitives";

const H1: CSSProperties = {
  fontFamily: T.fontHead, fontWeight: 400, fontSize: 25, lineHeight: 1.15,
  letterSpacing: "-.015em", margin: 0,
};

/** `.h1`. The Caprasimo heading frames 19, 20 and 21 open on. */
export const Heading = ({ children }: { children: ReactNode }) => (
  <h2 style={H1}>{children}</h2>
);

/** Frame 21's right side: the court, in Caprasimo, at heading weight but small. */
export const CourtLabel = ({ children }: { children: ReactNode }) => (
  <span style={{ fontFamily: T.fontHead, fontSize: 18 }}>{children}</span>
);

/**
 * Frame 22's right side: the court switcher, as a chip with a caret.
 *
 * The frame shrinks the chip to 38px tall. The system's own `.chip` floor is
 * 42 and a thumb finds 42 more reliably at the side of a court, so the floor
 * wins over the frame's local override.
 */
export const CourtChip = ({ children, onClick }: {
  children: ReactNode; onClick?: () => void;
}) => {
  const style: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, minHeight: 42,
    padding: "4px 14px", border: `1.5px solid ${T.lineChip}`, borderRadius: T.pill,
    background: "transparent", color: T.ink,
    fontFamily: T.fontHead, fontWeight: 400, fontSize: 16,
  };
  return onClick ? (
    <button type="button" onClick={onClick} style={{ ...style, cursor: "pointer" }}>
      {children} &#9662;
    </button>
  ) : (
    <span style={style}>{children} &#9662;</span>
  );
};

export interface PlayoffHeaderProps {
  left: ReactNode;
  right?: ReactNode;
  /** Frame 22 drops the bottom padding so the match card can take the middle. */
  flush?: boolean;
}

export const PlayoffHeader = ({ left, right, flush }: PlayoffHeaderProps) => (
  <div style={{
    padding: flush ? "24px 22px 0" : "24px 22px 8px",
    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10,
  }}>
    {left}
    {right}
  </div>
);

export default PlayoffHeader;
