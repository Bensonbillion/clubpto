// Frame 28a, Confirm, void a result.
//
// An overlay over the match list, which stays mounted and dimmed by the
// caller. The sheet brings its own scrim.
//
// The sentence names the court now. It did not before, and on a night where
// both courts are mid-session "removed from the standings" is one court short
// of telling the operator what they are about to change.

import { DangerButton, Sheet, TertiaryButton } from "../../ui/primitives";
import { ConfirmBody, ConfirmTitle } from "./confirm-sheet";
import { joinPair, pad2 } from "./format";

export interface ConfirmVoidResultProps {
  pairA: [string, string];
  scoreA: number;
  pairB: [string, string];
  scoreB: number;
  /** The court this result sits on. Named in the sentence. */
  courtNumber: number;
  /** Removes the result: standings recompute, all four `played` counts drop by one. */
  onVoid: () => void;
  /** Dismiss with no change. Scrim tap and back gesture both land here. */
  onKeep: () => void;
}

export const ConfirmVoidResult = ({
  pairA, scoreA, pairB, scoreB, courtNumber, onVoid, onKeep,
}: ConfirmVoidResultProps) => (
  <Sheet tone="danger" onDismiss={onKeep}>
    <ConfirmTitle>Void this result?</ConfirmTitle>
    <ConfirmBody>
      {`${joinPair(pairA[0], pairA[1])} ${pad2(scoreA)}, ${joinPair(pairB[0], pairB[1])} ${pad2(scoreB)} is removed from the Court ${courtNumber} standings. All four return to the queue.`}
    </ConfirmBody>
    {/* FLAG: voiding a playoff match rather than a group match is not drawn,
        and this sentence would be wrong for one: a voided semifinal takes a
        bracket row with it, not a row of the standings. */}
    <DangerButton onClick={onVoid}>Void the result</DangerButton>
    <TertiaryButton onClick={onKeep}>Keep it</TertiaryButton>
  </Sheet>
);
