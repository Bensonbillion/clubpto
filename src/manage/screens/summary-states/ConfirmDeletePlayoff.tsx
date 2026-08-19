// Frame 28b, Confirm, delete a bracket. Same sheet as 28a, different words.
//
// The reassurance is load-bearing and has grown a second half. It is not
// enough to say the standings survive; the frame also says the OTHER court is
// unaffected, because deleting a bracket at 9pm is exactly the moment an
// operator wonders whether they have just touched the court they are not
// standing on. Do not trim either clause.
//
// The component keeps its name while the copy follows the frame and says
// "bracket" throughout. That is the word every other frame uses too.

import { DangerButton, Sheet, TertiaryButton } from "../../ui/primitives";
import { ConfirmBody, ConfirmTitle } from "./confirm-sheet";

export interface ConfirmDeletePlayoffProps {
  courtNumber: number;
  /**
   * The court that is NOT affected, named in the second clause. Pass null on a
   * one-court night: the frame draws no wording for it, so the sentence closes
   * after "untouched" rather than gaining an invented clause.
   */
  otherCourtNumber?: number | null;
  /** Deletes the bracket and every playoff score on it. Group results survive. */
  onDelete: () => void;
  /** Dismiss with no change. Scrim tap and back gesture both land here. */
  onKeep: () => void;
}

export const ConfirmDeletePlayoff = ({
  courtNumber, otherCourtNumber, onDelete, onKeep,
}: ConfirmDeletePlayoffProps) => (
  <Sheet tone="danger" onDismiss={onKeep}>
    <ConfirmTitle>{`Delete the Court ${courtNumber} bracket?`}</ConfirmTitle>
    <ConfirmBody>
      {`The bracket and every playoff score on it are deleted. The night's standings are untouched${
        otherCourtNumber != null ? `, and Court ${otherCourtNumber} is unaffected` : ""}.`}
    </ConfirmBody>
    {/* FLAG: a bracket whose final already crowned a champion is not drawn.
        Deleting one would also remove the champion frames 23 and 25 show, and
        the sentence above does not say so. */}
    <DangerButton onClick={onDelete}>Delete the bracket</DangerButton>
    <TertiaryButton onClick={onKeep}>Keep the bracket</TertiaryButton>
  </Sheet>
);
