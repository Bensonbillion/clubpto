// Frame 27c, Error, score did not save.
//
// The version before this one described an offline queue: the score held on
// the phone, a list of writes waiting to go up, "keep scoring". Frame 27c says
// the opposite in its second line, "The match card is unchanged", so the write
// did not land anywhere and the match is still waiting for its result. The
// frame outranks the code, so the queue, the round header and the pending list
// are gone with it.
//
// What is left is frame 26's rule for errors, drawn as literally as it can be:
// say what happened, say what to do, do not apologise. Two sentences and one
// button. There is no dismiss, because a match with no score is not a state
// the operator should be able to walk away from by accident.

import { Body, FooterBar, PrimaryButton, Screen, T } from "../../ui/primitives";

export interface ErrorScoreNotSavedProps {
  /**
   * Returns to score entry with the match card as it was. Named for what the
   * operator is doing rather than for the network: the button says "Tap the
   * score again", and that is a second attempt at entering it, not a silent
   * replay of the write that failed.
   */
  onRetry: () => void;
}

export const ErrorScoreNotSaved = ({ onRetry }: ErrorScoreNotSavedProps) => (
  <Screen>
    <Body style={{
      display: "flex", flexDirection: "column", justifyContent: "center",
      gap: 10, padding: "0 26px",
    }}>
      <p style={{
        fontFamily: T.fontHead, fontWeight: 400, fontSize: 22, lineHeight: 1.15,
        letterSpacing: "-.015em", margin: 0,
      }}>That score did not save.</p>
      <p style={{ font: `400 15px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
        The connection dropped mid save. The match card is unchanged.
      </p>
    </Body>

    {/* FLAG: a second failure has no drawn wording. The screen stays where it
        is and the operator taps again. */}
    <FooterBar>
      <PrimaryButton onClick={onRetry}>Tap the score again</PrimaryButton>
    </FooterBar>
  </Screen>
);
