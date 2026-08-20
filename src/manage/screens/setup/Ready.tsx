// Frame 09, Ready. The review step.
//
// Read-only on purpose. Nothing in the table is tappable, because the only
// decision left is whether these five lines match the room, and every one of
// them is reachable again through Back with the choices intact.
//
// The frame folds what used to be a "Points for a win" row into the paragraph
// underneath, and that is the better shape: the number only means anything
// beside the two facts either side of it, that partners rotate and that
// everyone is ranked as an individual.

import type { ReactNode } from "react";
import { Body, FooterBar, PrimaryButton, Screen, T } from "../../ui/primitives";
import { SetupHeader } from "./shell";

export interface ReadyProps {
  /** "Wednesday". Fills the Night row. */
  dayName: string;
  /** Everyone in the night, walk-ins included. */
  playersIn: number;
  /**
   * Players per court, in court order. Reads "2 × 8" when the courts are even,
   * which is what frame 07 spends its whole screen keeping true, and lists the
   * sizes when they are not.
   */
  courtSizes: number[];
  /** The step 4 target. */
  matchesEach: number;
  /** Matches every court plays, summed. */
  matchesInTotal: number;
  /** From config, not hard-coded: the standings screens quote the same number. */
  pointsForAWin: number;
  /** In flight while the session is being written. */
  starting?: boolean;
  /** Back returns to frame 08 with every choice intact. */
  onBack?: () => void;
  onStart: () => void;
}

const Row = ({ label, children, last }: {
  label: string; children: ReactNode; last?: boolean;
}) => (
  <div style={{
    display: "flex", alignItems: "baseline", gap: 12, padding: "15px 0",
    borderBottom: last ? "none" : `1px solid ${T.line}`,
  }}>
    <span style={{ flex: 1, minWidth: 0, font: `400 15px ${T.fontBody}`, color: T.mut }}>
      {label}
    </span>
    {children}
  </div>
);

/** A value in the table: display face, tabular, 22px. */
const Value = ({ children }: { children: ReactNode }) => (
  <span style={{
    fontFamily: T.fontHead, fontWeight: 400, fontSize: 22,
    fontVariantNumeric: "tabular-nums",
  }}>{children}</span>
);

export const Ready = ({
  dayName, playersIn, courtSizes, matchesEach, matchesInTotal, pointsForAWin,
  starting, onBack, onStart,
}: ReadyProps) => {
  const even = courtSizes.length > 0 && courtSizes.every((n) => n === courtSizes[0]);
  // "2 × 8" is the frame's own shorthand for an even split. An uneven one has
  // no drawn wording, so it lists the courts in the same register rather than
  // claiming a multiplication that is not true.
  const courts = even ? `${courtSizes.length} × ${courtSizes[0]}` : courtSizes.join(" + ");

  return (
    <Screen>
      <SetupHeader title="Ready to start" step="Setup done" onBack={onBack} />

      <Body style={{ padding: "14px 22px 0" }}>
        <Row label="Night">
          <span style={{ font: `600 16px ${T.fontBody}` }}>{dayName}</span>
        </Row>
        <Row label="Players"><Value>{playersIn}</Value></Row>
        <Row label="Courts"><Value>{courts}</Value></Row>
        <Row label="Matches each"><Value>{matchesEach}</Value></Row>
        <Row label="Matches in total" last><Value>{matchesInTotal}</Value></Row>

        <p style={{
          font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: "16px 0 0",
          textWrap: "pretty",
        }}>
          Partners rotate every round, everyone is ranked as an individual, a win is{" "}
          {pointsForAWin} points. Each court runs and finishes on its own.
        </p>
      </Body>

      <FooterBar helper="Nothing here is locked. Extend, add or correct all night.">
        {/* The frame draws no in-flight label, so the button keeps its own copy
            and only stops answering. */}
        <PrimaryButton disabled={starting} onClick={onStart}>Start the night</PrimaryButton>
      </FooterBar>
    </Screen>
  );
};

export default Ready;
