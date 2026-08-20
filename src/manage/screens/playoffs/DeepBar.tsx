// The footer bar the two celebration frames use, on the --deep ground.
//
// Same geometry as the FooterBar primitive, one rule and one difference: the
// rule is BOX_LINE rather than --line. --line is a paper rule, and on the
// near-black ground of frames 23 and 24 it glows instead of separating. The
// frames draw the darker one, so this exists rather than a knob on the shared
// primitive that only two screens would ever set.

import type { ReactNode } from "react";
import { T } from "../../ui/primitives";

/** The rule and the box outline frames 23 and 24 share. */
export const BOX_LINE = "#322d28";

export const DeepBar = ({ helper, children }: {
  /** Frame 23 draws one. Frame 24 draws none, so it is optional. */
  helper?: ReactNode;
  children: ReactNode;
}) => (
  <div style={{
    marginTop: "auto", padding: "16px 18px 20px", borderTop: `1px solid ${BOX_LINE}`,
    display: "flex", flexDirection: "column", gap: 10,
  }}>
    {helper != null && (
      <p style={{
        font: `400 14.5px/1.45 ${T.fontBody}`, color: T.mut, margin: 0,
        textAlign: "center", textWrap: "pretty",
      }}>{helper}</p>
    )}
    {children}
  </div>
);

export default DeepBar;
