// Confirm, carry on with somebody who cannot play. NEW, 2026-09-15.
//
// The fourth confirm, and the first that interrupts the wizard rather than a
// running night. Frame 07 has no sheet drawn for it, so the shape is the
// three next door and the words are this file's own.
//
// WHY IT ASKS RATHER THAN REFUSING. Frame 07 computed its warnings, drew them
// in red, and then offered a fully enabled "Next: matches each" underneath. An
// operator setting up at 8:05 with a queue at the desk taps it. The obvious
// fix is the disabled button MatchesEach.tsx uses, and the measurement says it
// is the wrong one here: over every A/B/C mix a night of five to twenty-six
// can take, 303 shapes have NO court count that clears both warnings, and one
// A at a beginners' night (1A/2B/9C) is one of them at every headcount from
// eight up. A disabled Next on that night stops it for the other eleven
// people. engine/standings.ts already records the cost of the app being the
// reason a night does not start, and this sheet is how that is avoided while
// the operator still hears the names.
//
// WHY IT IS NOT tone="danger". The terracotta rule and the DangerButton are
// this codebase's mark for the actions with no undo drawn anywhere: void a
// result, delete a bracket, end the night. Carrying on from here destroys
// nothing and is curable on the night in two taps, with the court switcher and
// the late-arrival sheet. Dressing it in terracotta would flatten the
// difference between "you can fix this at 8:20" and "the standings freeze",
// and a sheet that cries danger about the shape 303 real nights genuinely have
// teaches the operator to tap through red, which is the habit this whole
// change exists to break. So: the plain sage rule, and the weighting carried
// by which button is filled.
//
// THE BUTTON ORDER. Going back is the easy, safe one, so it is the filled
// PrimaryButton and it is where the scrim tap and the back gesture land. That
// inverts the usual reading of a filled button, and it is the same inversion
// DangerButton's comment describes: on a confirm sheet the safe action carries
// the fill. Carrying on is real and reachable in one tap, as a full-width
// ghost, because it is a beat more attention rather than a hidden door.

import { PrimaryButton, SecondaryButton, Sheet } from "../../ui/primitives";
import { ConfirmBody, ConfirmTitle } from "./confirm-sheet";

export interface ConfirmStartAnywayProps {
  /**
   * The paragraph, built by screens/setup/model.ts startBlockerWords from the
   * courts step's live notes. It arrives as a finished sentence rather than as
   * the notes, because the words belong to the setup slice (which owns every
   * other sentence on frame 07) and the sheet shell belongs here. The same
   * split ConfirmVoidResult makes with its `consequence` prop.
   *
   * Frame 26's rule is that the paragraph names exactly what will be lost, so
   * this string always carries the stranded people by name, the courts by
   * number, and a closing count of the people the laws leave with no game.
   *
   * Null when nothing blocks, which closes the sheet rather than drawing a
   * question with no subject.
   */
  whoCannotPlay: string | null;
  /**
   * Dismiss with no change: the sheet closes onto the split the operator was
   * already looking at. Scrim tap and back gesture both land here.
   */
  onBackToSplit: () => void;
  /** Forward to the target step, with the night exactly as the sheet described it. */
  onCarryOn: () => void;
}

export const ConfirmStartAnyway = ({
  whoCannotPlay, onBackToSplit, onCarryOn,
}: ConfirmStartAnywayProps) => {
  // A sheet with no paragraph would be a question with no subject, so an empty
  // string closes it rather than drawing it. The courts step already guards on
  // the same condition; this is the belt, and it is what lets the caller hand
  // over startBlockerWords' null result without inventing a placeholder.
  if (!whoCannotPlay) return null;
  return (
    // The title avoids "start" for the same reason the paragraph does: the
    // wizard is reachable mid-night, and Next goes to the target step rather
    // than starting anything. "Carry on" is also the word on the button it is
    // asking about, so the question and its answer use one vocabulary.
    <Sheet onDismiss={onBackToSplit}>
      <ConfirmTitle>Carry on with somebody who cannot play?</ConfirmTitle>
      <ConfirmBody>{whoCannotPlay}</ConfirmBody>
      <PrimaryButton onClick={onBackToSplit}>Back to the split</PrimaryButton>
      <SecondaryButton onClick={onCarryOn}>Carry on anyway</SecondaryButton>
    </Sheet>
  );
};
