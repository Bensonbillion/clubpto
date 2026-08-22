// Frame 01, Passcode.
//
// Four slots, no submit: the fourth digit verifies. One line of instruction
// above them and the keypad below, and nothing else on the screen. There is no
// title, no footer bar and no spinner in this design, so the only thing that
// moves while the operator types is the row of slots.

import { Body, Dots, Eyebrow, Keypad, Screen, T } from "../../ui/primitives";

/** Four slots, four digits. */
export const PASSCODE_LENGTH = 4;

export interface PasscodeProps {
  /** How many digits are in the buffer, 0 to 4. Slots fill left to right. */
  entered: number;
  /**
   * The buffer itself, drawn unmasked. Frame 01 shows the typed digits rather
   * than dots, so pass this and the screen matches the frame. Omit it and a
   * filled slot shows a mark instead, which is what a code being read over
   * someone's shoulder in a sports hall wants.
   */
  digits?: string;
  /**
   * The instant between the fourth tap and the result. Holds the four filled
   * slots and kills the keypad. No spinner.
   */
  verifying?: boolean;
  /** Appends one digit. On the fourth, the caller auto-verifies. */
  onDigit: (digit: string) => void;
  /** Removes the last digit. No-op at zero. */
  onDelete: () => void;
  /**
   * "Manager 2" on the second manager's door, so two tabs on one phone can be
   * told apart before either has a night. The first manager passes nothing
   * and the door is frame 01 exactly.
   */
  instanceLabel?: string;
}

export const Passcode = ({ entered, digits, verifying, onDigit, onDelete, instanceLabel }: PasscodeProps) => {
  const filled = Math.max(0, Math.min(PASSCODE_LENGTH, digits?.length ?? entered));

  return (
    <Screen>
      <Body style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "0 26px", gap: 28, boxSizing: "border-box",
      }}>
        {instanceLabel && (
          <Eyebrow style={{ textAlign: "center", marginBottom: -12 }}>{instanceLabel}</Eyebrow>
        )}
        <p style={{ font: `600 18px ${T.fontBody}`, textAlign: "center", margin: 0 }}>
          Enter tonight's passcode.
        </p>

        <Dots filled={filled} of={PASSCODE_LENGTH} digits={digits} />
      </Body>

      <Keypad onDigit={onDigit} onDelete={onDelete} disabled={verifying} />
    </Screen>
  );
};
