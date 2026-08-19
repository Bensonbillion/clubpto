// Frame 16, confirm step — Void this result?
//
// Carried over from v1 frame 26a, which v2 dropped. v2 shows the void action
// but never shows what happens after the tap, and v1 is explicit that a
// confirmation stands between the tap and the deletion. Nothing is destroyed
// until Void the result.
//
// Rendered INSTEAD of CorrectOrVoid while the confirmation is up, with the
// same `behind`. Keep it returns the parent to CorrectOrVoid, unchanged.

import type { ReactNode } from "react";
import { Screen, Body, Sheet, DangerButton, TertiaryButton } from "../../ui/primitives";
import { pairName, padScore } from "./CorrectOrVoid";
import type { CorrectOrVoidMatch } from "./CorrectOrVoid";

export interface VoidConfirmProps {
  match: CorrectOrVoidMatch;
  /** Commits the void. Removes it from standings, decrements all four players. */
  onConfirm: () => void;
  /** Closes the confirmation, nothing changed. */
  onKeep: () => void;
  behind?: ReactNode;
}

export const VoidConfirm = ({ match, onConfirm, onKeep, behind }: VoidConfirmProps) => (
  <Screen>
    <Body style={{ opacity: 0.35 }}>{behind}</Body>
    {/*
      The primitives note that a destructive sheet gives the filled weight to
      the SAFE action. Here the spec fixes both roles instead: Void the result
      is the danger button and Keep it is the muted dismiss, so no fill appears
      on this sheet at all. Flagged as a deliberate divergence.
    */}
    <Sheet tone="danger" onDismiss={onKeep}>
      <h2 style={{ font: "800 17px Inter, sans-serif", margin: 0 }}>Void this result?</h2>
      {/*
        FLAG: v1 joined the pairs with "&". Converted to "and" for consistency
        with v2 throughout, per the spec. Needs sign-off.
      */}
      <p style={{ font: "400 14.5px/1.5 Inter, sans-serif", margin: 0 }}>
        {pairName(match.sideA)} {padScore(match.scoreA)}, {pairName(match.sideB)}{" "}
        {padScore(match.scoreB)} is removed from the standings. All four return to the queue.
      </p>
      <DangerButton onClick={onConfirm}>Void the result</DangerButton>
      <TertiaryButton onClick={onKeep}>Keep it</TertiaryButton>
    </Sheet>
  </Screen>
);

export default VoidConfirm;
