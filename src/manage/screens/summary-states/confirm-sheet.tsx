// The two lines every confirmation sheet opens with.
//
// Frames 28a, 28b and 28c draw the same sheet three times: a heading in
// Caprasimo at 18px, then one paragraph in full-strength cream, then the
// actions. The paragraph is the part frame 26 is strict about, "every
// destructive action names exactly what will be lost", and it is deliberately
// NOT muted: on these three sheets the consequence is the thing you are meant
// to read, not a caption under the question.
//
// Kept in one internal module rather than typed out three times, because three
// copies of a style is how the heaviest sentence in the manager quietly
// becomes grey on one sheet and not the others. Nothing here is exported from
// the slice's index; these are shapes for the sheets next door.

import type { ReactNode } from "react";
import { T } from "../../ui/primitives";

export const ConfirmTitle = ({ children }: { children: ReactNode }) => (
  <p style={{
    fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, lineHeight: 1.2,
    letterSpacing: "-.015em", margin: 0,
  }}>{children}</p>
);

export const ConfirmBody = ({ children }: { children: ReactNode }) => (
  <p style={{
    font: `400 14.5px/1.6 ${T.fontBody}`, color: T.ink, margin: 0, textWrap: "pretty",
  }}>{children}</p>
);
