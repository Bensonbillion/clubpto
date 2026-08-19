// Frame 26b — Confirm, delete a playoff. v1 only, same sheet pattern as 26a.
//
// An overlay: the caller keeps the underlying screen mounted at opacity .35.
//
// The reassurance clause (`The night's standings are untouched.`) is
// load-bearing. Do not trim it.
//
// FLAG: a playoff final that already crowned a champion is not drawn. Deleting
// would also remove a champion that frames 22 and 23 display.

import { DangerButton, Sheet, T, TertiaryButton } from "../../ui/primitives";

export interface ConfirmDeletePlayoffProps {
  courtNumber: number;
  /** Deletes the bracket and every playoff score on it. Group results survive. */
  onDelete: () => void;
  /** Dismiss with no change. Scrim tap and back gesture both land here. */
  onKeep: () => void;
}

export const ConfirmDeletePlayoff = ({ courtNumber, onDelete, onKeep }: ConfirmDeletePlayoffProps) => (
  <Sheet tone="danger" onDismiss={onKeep}>
    <div style={{ font: "700 22px Inter, sans-serif", color: T.redInk }}>
      {`Delete the Court ${courtNumber} playoff?`}
    </div>
    <div style={{ font: "400 16px/1.45 Inter, sans-serif" }}>
      The bracket and every playoff score on it are deleted. The night's standings are untouched.
    </div>
    <DangerButton onClick={onDelete}>Delete the playoff</DangerButton>
    <TertiaryButton onClick={onKeep}>Keep the bracket</TertiaryButton>
  </Sheet>
);
