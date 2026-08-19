// Frame 16 — Correct or void a result.
//
// The lime score band is the one bold element, because the sheet's first job
// is to let you confirm you are looking at the right match. There is no lime
// BUTTON here on purpose: a cream outline and a red outline, so neither action
// reads as the happy path, and the destructive one is boxed off so it cannot
// be hit while aiming for Change the score.

import type { ReactNode } from "react";
import { Num, Screen, Body, Sheet, Card, SecondaryButton, DangerButton, T } from "../../ui/primitives";

export interface CorrectOrVoidMatch {
  id: string;
  /** Per-night match number used in the title. Not a round number. */
  matchNumber: number;
  /** "Court 1". */
  courtLabel: string;
  sideA: [string, string];
  sideB: [string, string];
  scoreA: number;
  scoreB: number;
}

export interface CorrectOrVoidProps {
  match: CorrectOrVoidMatch;
  onChangeScore: () => void;
  /** Opens the Void this result? confirmation. Nothing is changed yet. */
  onVoid: () => void;
  onDismiss: () => void;
  /** The played-matches list, rendered dimmed behind the sheet. */
  behind?: ReactNode;
}

/** Pair names join with the word "and", never an ampersand. */
export const pairName = (pair: readonly [string, string]): string => `${pair[0]} and ${pair[1]}`;

/** Scores render two-digit: 21, 14, 09. */
export const padScore = (n: number): string => String(n).padStart(2, "0");

const SideName = ({ children }: { children: ReactNode }) => (
  <div style={{ padding: "12px 14px", font: "700 17px Inter, sans-serif" }}>{children}</div>
);

export const CorrectOrVoid = ({
  match, onChangeScore, onVoid, onDismiss, behind,
}: CorrectOrVoidProps) => (
  // FLAG: the dimmed background is the court's played-matches list. Neither
  // wireframe specifies that list beyond its header string, and no copy exists
  // for its empty case, so it is passed in rather than drawn here.
  <Screen>
    <Body style={{ opacity: 0.35 }}>{behind}</Body>
    <Sheet onDismiss={onDismiss}>
      <h2 style={{ font: "700 22px Inter, sans-serif", margin: 0 }}>
        Match <Num size={26}>{match.matchNumber}</Num>, {match.courtLabel}
      </h2>

      <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
        <SideName>{pairName(match.sideA)}</SideName>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", background: T.lime }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 0" }}>
            <Num size={56} style={{ lineHeight: 0.9, color: T.limeInk }}>{padScore(match.scoreA)}</Num>
          </div>
          <div style={{ background: "rgba(10,24,16,.28)" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 0" }}>
            <Num size={56} style={{ lineHeight: 0.9, color: T.limeInk }}>{padScore(match.scoreB)}</Num>
          </div>
        </div>
        <SideName>{pairName(match.sideB)}</SideName>
      </Card>

      <SecondaryButton onClick={onChangeScore}>Change the score</SecondaryButton>

      <Card tone="danger">
        <div style={{ font: "700 17px Inter, sans-serif", color: T.redInk }}>Void this match</div>
        <p style={{ font: "400 15px/1.45 Inter, sans-serif", margin: 0 }}>
          All four players go back into the queue and this match counts for nothing. Games played
          drops by one each.
        </p>
        <DangerButton onClick={onVoid}>Void it</DangerButton>
      </Card>
    </Sheet>
  </Screen>
);

export default CorrectOrVoid;
