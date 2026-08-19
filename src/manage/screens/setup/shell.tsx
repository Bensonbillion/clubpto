// Shared shell for the setup wizard (frames 05 to 09).
//
// The wizard's top bar is the one piece of geometry every setup frame repeats
// and primitives.tsx does not carry it, so it lives here: Back on the left, the
// step counter on the right, one divider under it. Nothing here is a new style
// — it is the same T tokens arranged the way the frames arrange them.
//
// SETUP holds the handful of literal wireframe values T has no token for. They
// are the spec's own numbers, not invented colours.

import type { CSSProperties, ReactNode } from "react";
import { Num, T } from "../../ui/primitives";

export const SETUP = {
  /** Body helper copy. The spec's .65 sits between T.ink68 and T.ink60. */
  ink65: "rgba(244,237,224,.65)",
  /** Roster list row divider on frame 06, lighter than T.lineSoft. */
  lineRow: "rgba(244,237,224,.08)",
  /** Chip border on frame 07. */
  lineChip: "rgba(244,237,224,.2)",
  /** Unticked checkbox border on frame 06. */
  lineBox: "rgba(244,237,224,.25)",
  /** Dashed border: an unavailable target row, and a court with nobody on it. */
  lineDashed: "rgba(244,237,224,.22)",
} as const;

/** Frames 05 to 09 share this bar. Back is non-destructive at every step. */
export const TopBar = ({ onBack, right }: { onBack: () => void; right: ReactNode }) => (
  <div style={{
    padding: "14px 18px", borderBottom: `1px solid ${T.lineSoft}`,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  }}>
    <button type="button" onClick={onBack} style={{
      border: "none", background: "transparent", padding: 0, color: T.ink,
      font: "600 16px Inter, sans-serif", cursor: "pointer",
    }}>Back</button>
    <div style={{
      font: "700 13px Inter, sans-serif", letterSpacing: ".08em",
      textTransform: "uppercase", color: T.ink45,
    }}>{right}</div>
  </div>
);

/** "Step 1 of 4". Both numerals are values, so both are VT323. */
export const StepCounter = ({ step }: { step: number }) => (
  <>Step <Num size={19}>{step}</Num> of <Num size={19}>4</Num></>
);

export const H1 = ({ children }: { children: ReactNode }) => (
  <h1 style={{ font: "700 24px/1.2 Inter, sans-serif", margin: 0 }}>{children}</h1>
);

/** The one line under the question that says why it matters. */
export const Sub = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <p style={{ font: "400 15px/1.4 Inter, sans-serif", color: SETUP.ink65, margin: 0, ...style }}>
    {children}
  </p>
);

/** Deliberately quiet helper text (frames 07 and 08). */
export const QuietLine = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <p style={{ font: "400 14px/1.4 Inter, sans-serif", color: T.ink50, margin: 0, ...style }}>
    {children}
  </p>
);

/** Standalone display numerals are padded to two digits; in-sentence ones are not. */
export const pad2 = (n: number): string => (n < 10 && n >= 0 ? `0${n}` : String(n));
