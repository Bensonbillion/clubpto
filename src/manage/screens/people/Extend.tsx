// Add a round to one court.
//
// NO v3 FRAME DRAWS THIS. It is carried forward from the v2 set, restyled onto
// the Organic tokens with its copy untouched, because the shell still reaches
// it and deleting a live path to match a gap in the frames would remove a
// capability rather than a drawing. The v3 set answers the neighbouring
// question instead, on frame 19, where a court that has met its targets
// chooses a bracket or one more round for everybody. If frame 19 is meant to
// replace this sheet outright, this file is what gets deleted.
//
// The whole decision is the two numbers in the ledger, so they are the
// second-loudest thing on the sheet after the sage action. There is no
// stepper: one confirmation adds one round, and only one.

import { Num, PrimaryButton, Sheet, T, TertiaryButton } from "../../ui/primitives";
import { countWord } from "./model";

export interface ExtendProps {
  /** The acting court, e.g. "Court 1". */
  courtLabel: string;
  /** Current target matches per player on that court. */
  targetNow: number;
  /** Every other running court, e.g. ["Court 2"]. */
  otherCourtLabels: string[];
  /** Estimated added wall-clock minutes for one more round. Null when unknown. */
  minutesPerRound: number | null;
  onAddRound: () => void;
  onDismiss: () => void;
}

const LedgerRow = ({ label, value, last }: { label: string; value: number; last?: boolean }) => (
  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      padding: "12px 0",
      borderTop: `1px solid ${T.line}`,
      borderBottom: last ? `1px solid ${T.line}` : undefined,
    }}
  >
    <span style={{ font: `400 16px ${T.fontBody}`, color: T.mut }}>{label}</span>
    <Num size={28}>{value}</Num>
  </div>
);

export const Extend = ({
  courtLabel,
  targetNow,
  otherCourtLabels,
  minutesPerRound,
  onAddRound,
  onDismiss,
}: ExtendProps) => {
  const targetAfter = targetNow + 1;

  // With no other court, or with more than one, the "is untouched" clause has
  // no agreed wording, so it is dropped rather than guessed at.
  const untouched = otherCourtLabels.length === 1 ? `${otherCourtLabels[0]} is untouched.` : "";
  // An unavailable estimate degrades to the untouched clause alone rather than
  // printing an empty placeholder.
  const minutes = minutesPerRound == null ? "" : `About ${minutesPerRound} more minutes.`;
  const caveat = [untouched, minutes].filter(Boolean).join(" ");

  return (
    <Sheet onDismiss={onDismiss}>
      <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>Add a round?</p>
      <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
        Everyone on {courtLabel} gets one more match.
      </p>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <LedgerRow label="Target now" value={targetNow} />
        <LedgerRow label="Target after" value={targetAfter} last />
      </div>

      {caveat !== "" && (
        <p style={{ font: `400 14px/1.5 ${T.fontBody}`, color: T.soft, margin: 0 }}>{caveat}</p>
      )}

      <PrimaryButton onClick={onAddRound}>Add the round</PrimaryButton>
      <TertiaryButton onClick={onDismiss}>Leave it at {countWord(targetNow)}</TertiaryButton>
    </Sheet>
  );
};
