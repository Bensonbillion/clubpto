// Frame 02 — Passcode failed (v2 `1c`).
//
// This IS the error variant of frame 01, not a separate destination: same
// geometry, two deltas. The prompt line is REPLACED by the error sentence (the
// two never appear together), and the four dots render empty with a red
// outline — the buffer is cleared on failure. That outline is the only red on
// the screen. No red text, no banner, no toast, no attempt counter.

import { Body, FooterBar, Keypad, Screen, T } from "../../ui/primitives";
import { PASSCODE_LENGTH } from "./Passcode";

export interface PasscodeFailedProps {
  /**
   * Resolves the wireframe's `[[PASSCODE_SCOPE]]` token — where tonight's code
   * comes from, completing `The code is ___.` Omit it and the footer line is
   * dropped rather than guessed.
   */
  codeScope?: string | null;
  /**
   * The error is transient. The first digit tap must take the caller back to
   * frame 01 — normal dots, `Enter tonight's passcode.` restored.
   */
  onDigit: (digit: string) => void;
  onDelete: () => void;
}

/**
 * The failed row: four empty dots in red. Matches the Dots primitive's
 * geometry exactly; only the border colour differs, and the primitive has no
 * error tone to pass.
 */
const ErrorDots = () => (
  <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
    {Array.from({ length: PASSCODE_LENGTH }, (_, i) => (
      <div key={i} style={{
        width: 18, height: 18, borderRadius: 999, boxSizing: "border-box",
        background: "transparent", border: `2px solid ${T.red}`,
      }} />
    ))}
  </div>
);

export const PasscodeFailed = ({ codeScope, onDigit, onDelete }: PasscodeFailedProps) => (
  <Screen>
    <Body style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 26, padding: 24, boxSizing: "border-box",
    }}>
      <p style={{
        font: "600 17px/1.35 Inter, sans-serif", margin: 0, maxWidth: 300,
        textAlign: "center", textWrap: "pretty",
      }}>
        That passcode did not match. Check tonight's code and try again.
      </p>

      <ErrorDots />

      <Keypad onDigit={onDigit} onDelete={onDelete} />
    </Body>

    {/* FLAG: `[[PASSCODE_SCOPE]]` is unresolved in the wireframe. With no real
        phrasing the line is cut, not guessed. */}
    {codeScope ? (
      <FooterBar>
        <p style={{ fontSize: 14, color: T.ink50, textAlign: "center", margin: 0 }}>
          The code is {codeScope}.
        </p>
      </FooterBar>
    ) : null}
  </Screen>
);
