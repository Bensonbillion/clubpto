// Frame 01 — Passcode (v2 `1b`).
//
// Four dots, no submit. The fourth digit verifies. The dot row is the only
// thing that moves, so it is the one bold element; there is no title bar and
// no spinner anywhere in this design.

import { Body, Dots, FooterBar, Keypad, Screen, T } from "../../ui/primitives";

/** Four dots, four slots. */
export const PASSCODE_LENGTH = 4;

export interface PasscodeProps {
  /** How many digits are in the buffer, 0 to 4. Dots fill left to right. */
  entered: number;
  /**
   * The instant between the fourth tap and the result. Holds the four filled
   * dots and kills the keypad. No spinner.
   */
  verifying?: boolean;
  /** Appends one digit. On the fourth, the caller auto-verifies. */
  onDigit: (digit: string) => void;
  /** Removes the last digit. No-op at zero. */
  onDelete: () => void;
}

export const Passcode = ({ entered, verifying, onDigit, onDelete }: PasscodeProps) => {
  const filled = Math.max(0, Math.min(PASSCODE_LENGTH, entered));

  return (
    <Screen>
      <Body style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 26, padding: 24, boxSizing: "border-box",
      }}>
        <p style={{ font: "600 17px Inter, sans-serif", margin: 0, textAlign: "center" }}>
          Enter tonight's passcode.
        </p>

        <Dots filled={filled} of={PASSCODE_LENGTH} />

        {/* FLAG: the spec asks for a sub-120ms press state on the digit keys.
            That belongs in the Keypad primitive, which this slice does not own. */}
        <Keypad onDigit={onDigit} onDelete={onDelete} disabled={verifying} />
      </Body>

      <FooterBar>
        <p style={{ fontSize: 14, color: T.ink50, textAlign: "center", margin: 0 }}>
          Court view and check-in need no code.
        </p>
      </FooterBar>
    </Screen>
  );
};
