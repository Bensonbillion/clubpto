// Frame 28c, Confirm, end the night. NEW.
//
// The third sheet, and the only one with three actions. The order is the
// frame's and it is the argument the sheet is making: get the night out of the
// app first, then end it, or go back to playing. "Copy for WhatsApp first"
// sits ABOVE the destructive button because it is the thing the operator will
// wish they had done, and it does not end anything, so a stray tap on it costs
// nothing.
//
// Ending the night is the one action in the manager with no undo drawn
// anywhere, which is why it gets a sheet of its own rather than a line on the
// summary.

import { DangerButton, SecondaryButton, Sheet, TertiaryButton } from "../../ui/primitives";
import { ConfirmBody, ConfirmTitle } from "./confirm-sheet";

export interface ConfirmEndNightProps {
  /** "Wednesday". The question names the night rather than saying "this session". */
  dayLabel: string;
  /**
   * Copies the summary text and LEAVES THE SHEET OPEN. The frame keeps all
   * three actions on screen, so copying is a step inside the decision rather
   * than a way out of it.
   */
  onCopyFirst: () => void;
  /** Ends the night: unplayed games are cancelled, the standings freeze. */
  onEndNight: () => void;
  /** Dismiss with no change. Scrim tap and back gesture both land here. */
  onKeepPlaying: () => void;
}

export const ConfirmEndNight = ({
  dayLabel, onCopyFirst, onEndNight, onKeepPlaying,
}: ConfirmEndNightProps) => (
  <Sheet tone="danger" onDismiss={onKeepPlaying}>
    <ConfirmTitle>{`End ${dayLabel}?`}</ConfirmTitle>
    {/* FLAG: "both courts" is the frame's own wording and assumes the two-court
        night the whole set is drawn around. A one-court or three-court night
        has no drawn sentence, so this one ships as written. */}
    <ConfirmBody>
      Unplayed games on both courts are cancelled and the standings freeze as they are. The summary stays available to copy.
    </ConfirmBody>
    <SecondaryButton onClick={onCopyFirst}>Copy for WhatsApp first</SecondaryButton>
    <DangerButton onClick={onEndNight}>End the night</DangerButton>
    <TertiaryButton onClick={onKeepPlaying}>Keep playing</TertiaryButton>
  </Sheet>
);
