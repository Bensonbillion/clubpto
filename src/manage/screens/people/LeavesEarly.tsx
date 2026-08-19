// Frame 16c, Someone leaves early.
//
// The sheet the "Mark left" ghost on frame 14 opens. Its whole job is to say
// that leaving costs the table nothing and costs the others nothing, because
// the operator's instinct at 8:40 is that pulling a name out will break the
// round robin. It does not: the games already played stay scored, and the ones
// not yet drawn rebalance across whoever is still on the court.
//
// The second line matters as much as the first. Somebody stepping out for a
// phone call is the common case, so the sheet says up front that coming back
// is one tap rather than a decision.
//
// COPY NOTES, both flagged. Frame 16c writes "His played games", "If he comes
// back", "He is staying"; the roster is not all men, so the pronouns give way
// to the name or to "they". The frame also joins its first two clauses with an
// em dash, which the house voice does not use, so it is a full stop instead.
// Every other word is the frame's.

import { PrimaryButton, Sheet, T, TertiaryButton } from "../../ui/primitives";
import { countWord } from "./model";

export interface LeavesEarlyProps {
  playerName: string;
  /** How many are left on that court once this one goes. Spelled out, because
   *  frame 16c writes "across the seven still here". */
  playersStillHere: number;
  onMarkLeft: () => void;
  /** Dismisses without marking anyone left. */
  onKeep: () => void;
}

export const LeavesEarly = ({
  playerName,
  playersStillHere,
  onMarkLeft,
  onKeep,
}: LeavesEarlyProps) => (
  <Sheet onDismiss={onKeep}>
    <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
      {playerName} is leaving
    </p>

    <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
      Played games and points stay on the table. Unplayed games rebalance across the{" "}
      {countWord(playersStillHere)} still here. Nobody else loses a match.
    </p>

    <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
      If they come back, one tap returns them to the queue.
    </p>

    <PrimaryButton onClick={onMarkLeft}>Mark {playerName} left</PrimaryButton>
    <TertiaryButton onClick={onKeep}>{playerName} is staying</TertiaryButton>
  </Sheet>
);
