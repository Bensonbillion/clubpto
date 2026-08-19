// Frame 26a — Confirm, void a result. v1 only.
//
// An overlay: render it OVER the match list, which stays mounted and dimmed to
// opacity .35 by the caller. The sheet supplies its own light scrim.
//
// FLAG (copy sign-off): v1 joins the pair with `&`, v2's language everywhere
// joins with `and`. This follows v2 rather than shipping both conventions.
//
// FLAG (flow): v2 folded voiding into frame 16 as an inline red panel with no
// second confirm. Keep this sheet only if a void needs two steps.
//
// FLAG: voiding a playoff match rather than a group match is not drawn.

import { DangerButton, Sheet, T, TertiaryButton } from "../../ui/primitives";
import { joinPair, pad2 } from "./format";

export interface ConfirmVoidResultProps {
  pairA: [string, string];
  scoreA: number;
  pairB: [string, string];
  scoreB: number;
  /** Removes the result: standings recompute, all four `played` counts drop by one. */
  onVoid: () => void;
  /** Dismiss with no change. Scrim tap and back gesture both land here. */
  onKeep: () => void;
}

export const ConfirmVoidResult = ({
  pairA, scoreA, pairB, scoreB, onVoid, onKeep,
}: ConfirmVoidResultProps) => (
  <Sheet tone="danger" onDismiss={onKeep}>
    <div style={{ font: "700 22px Inter, sans-serif", color: T.redInk }}>
      Void this result?
    </div>
    <div style={{ font: "400 16px/1.45 Inter, sans-serif" }}>
      {`${joinPair(pairA[0], pairA[1])} ${pad2(scoreA)}, ${joinPair(pairB[0], pairB[1])} ${pad2(scoreB)} is removed from the standings. All four return to the queue.`}
    </div>
    <DangerButton onClick={onVoid}>Void the result</DangerButton>
    <TertiaryButton onClick={onKeep}>Keep it</TertiaryButton>
  </Sheet>
);
