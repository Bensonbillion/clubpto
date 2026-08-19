// Frame 15 — Extend.
//
// A bottom sheet over the dimmed court view. The whole decision is the two
// VT323 numbers in the ledger, so they are the second-loudest thing on the
// sheet after the lime Add the round.
//
// There is no stepper. One confirmation adds one round, and only one.

import type { ReactNode } from "react";
import { Num, Screen, Body, Sheet, PrimaryButton, TertiaryButton, T } from "../../ui/primitives";

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
  /** The live court view, rendered dimmed behind the sheet. */
  behind?: ReactNode;
}

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];

/** "Leave it at three" spells the current target, so it is generated. */
export const targetWord = (n: number): string =>
  n >= 0 && n < WORDS.length ? WORDS[n] : String(n);

const LedgerRow = ({ label, value, last }: { label: string; value: number; last?: boolean }) => (
  <div style={{
    display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "12px 0",
    borderTop: `1px solid ${T.lineSoft}`,
    borderBottom: last ? `1px solid ${T.lineSoft}` : undefined,
  }}>
    <span style={{ font: "400 16px Inter, sans-serif", color: T.ink60 }}>{label}</span>
    <Num size={28}>{value}</Num>
  </div>
);

export const Extend = ({
  courtLabel, targetNow, otherCourtLabels, minutesPerRound, onAddRound, onDismiss, behind,
}: ExtendProps) => {
  const targetAfter = targetNow + 1;

  // FLAG: the wireframe only covers two courts. With none or more than one
  // other court running, the "is untouched" clause has no agreed wording, so
  // it is dropped rather than guessed at.
  const untouched = otherCourtLabels.length === 1 ? `${otherCourtLabels[0]} is untouched.` : "";
  // If the estimate is unavailable the caveat degrades to the untouched
  // clause alone rather than printing an empty placeholder.
  const minutes = minutesPerRound == null ? "" : `About ${minutesPerRound} more minutes.`;
  const caveat = [untouched, minutes].filter(Boolean).join(" ");

  return (
    <Screen>
      <Body style={{ opacity: 0.35 }}>{behind}</Body>
      <Sheet onDismiss={onDismiss}>
        <h2 style={{ font: "700 22px Inter, sans-serif", margin: 0 }}>Add a round?</h2>
        <p style={{ font: "400 17px/1.45 Inter, sans-serif", margin: 0 }}>
          Everyone on {courtLabel} gets one more match.
        </p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <LedgerRow label="Target now" value={targetNow} />
          <LedgerRow label="Target after" value={targetAfter} last />
        </div>
        {caveat !== "" && (
          <p style={{ font: "400 15px/1.4 Inter, sans-serif", color: T.ink60, margin: 0 }}>{caveat}</p>
        )}
        <PrimaryButton onClick={onAddRound}>Add the round</PrimaryButton>
        <TertiaryButton onClick={onDismiss}>Leave it at {targetWord(targetNow)}</TertiaryButton>
      </Sheet>
    </Screen>
  );
};

export default Extend;
