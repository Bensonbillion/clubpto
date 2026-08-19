// Frame 02, Passcode failed.
//
// The error variant of frame 01, not a separate destination: same instruction
// line, same slots, same keypad, three deltas. The slot rules turn terracotta,
// the digits turn warm, and one sentence appears under them saying what
// happened and what to do.
//
// The typed digits STAY on screen. An earlier pass cleared the buffer and drew
// four empty rings, which told the operator nothing: the whole point of the
// frame is that they can see the code they actually entered and spot the digit
// they fumbled. No banner, no toast, no attempt counter.

import { Body, Dots, Keypad, Screen, T } from "../../ui/primitives";
import { PASSCODE_LENGTH } from "./Passcode";

export interface PasscodeFailedProps {
  /**
   * The code that was rejected, drawn as typed. Omit it and the slots render
   * empty under their terracotta rules, which is the honest fallback for a
   * caller that has already dropped the buffer.
   */
  digits?: string;
  /**
   * The error is transient. The first digit tap must take the caller back to
   * frame 01, normal slots, nothing under them.
   */
  onDigit: (digit: string) => void;
  onDelete: () => void;
}

export const PasscodeFailed = ({ digits, onDigit, onDelete }: PasscodeFailedProps) => (
  <Screen>
    <Body style={{
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "0 26px", gap: 24, boxSizing: "border-box",
    }}>
      <p style={{ font: `600 18px ${T.fontBody}`, textAlign: "center", margin: 0 }}>
        Enter tonight's passcode.
      </p>

      <Dots
        filled={Math.min(PASSCODE_LENGTH, digits?.length ?? 0)}
        of={PASSCODE_LENGTH}
        digits={digits ?? ""}
        tone="error"
      />

      <p style={{
        font: `400 15px/1.5 ${T.fontBody}`, textAlign: "center", margin: 0,
        textWrap: "pretty",
      }}>
        That passcode did not match. Check tonight's code and try again.
      </p>
    </Body>

    <Keypad onDigit={onDigit} onDelete={onDelete} />
  </Screen>
);
