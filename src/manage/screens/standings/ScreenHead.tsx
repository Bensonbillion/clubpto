// The `.hd` bar frames 17 and 18 share.
//
// A Caprasimo heading on the left, the sage eyebrow on the right, and no rule
// underneath: on Organic the heading and the eyebrow carry the separation, so
// a hairline here would draw a second line under a screen that already has one
// at the tab bar.
//
// This is deliberately not shared with the playoff slice's header. The frames
// let the two drift, frame 21 puts a Caprasimo court label where 17 and 18 put
// an eyebrow, so one component covering both would need a knob per frame and
// would describe neither screen honestly.

import type { ReactNode } from "react";
import { Eyebrow, T } from "../../ui/primitives";

export const ScreenHead = ({ title, step }: {
  title: ReactNode;
  /** Frame 17 draws "Court 2 · final", frame 18 draws "Court 2". */
  step?: ReactNode;
}) => (
  <div style={{
    padding: "24px 22px 8px",
    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10,
  }}>
    <h2 style={{
      fontFamily: T.fontHead, fontWeight: 400, fontSize: 25, lineHeight: 1.15,
      letterSpacing: "-.015em", margin: 0,
    }}>{title}</h2>
    {step != null && <Eyebrow>{step}</Eyebrow>}
  </div>
);

export default ScreenHead;
