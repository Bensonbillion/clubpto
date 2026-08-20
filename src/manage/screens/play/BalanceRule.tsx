// Frame 11, Balance rule, why this four.
//
// A real screen the operator reads out to a player who asked why they are
// sitting. Nothing here works out who is on or why: engine/rotation.ts already
// decided, and hands back a MatchReason describing what it did. This file only
// puts the frame's words around that. If the two ever disagree the engine is
// right and this screen is the thing to fix.
//
// Every claim is conditional on the reason supporting it. That is the point of
// the screen: an explanation the operator has to apologise for is worse than
// no explanation, so a sentence the match does not back up is not printed.

import type { ReactNode } from "react";
import type { MatchReason } from "../../engine/rotation";
import { Body, Card, Eyebrow, Screen, T, TertiaryButton } from "../../ui/primitives";
import { joinNames } from "./model";

export interface BalanceRuleProps {
  round: number;
  courtNumber: number;
  /** Straight off `NextMatch.reason`, or `explainMatch()` for a match already
   *  on court. Not re-derived here. */
  reason: MatchReason;
  /**
   * Frame 11 draws no way out, and a screen you cannot leave is a bug on a
   * phone. The label borrows frame 24's own construction, "Back to bracket".
   * Flagged as this file's copy rather than the frame's.
   */
  onDismiss?: () => void;
}

const CardTitle = ({ children }: { children: ReactNode }) => (
  <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 17, margin: 0 }}>{children}</p>
);

const CardBody = ({ children }: { children: ReactNode }) => (
  <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
    {children}
  </p>
);

export const BalanceRule = ({ round, courtNumber, reason, onDismiss }: BalanceRuleProps) => {
  const names = joinNames(reason.leastPlayed.map((p) => p.name));

  // The second sentence of the first card is a promise about the whole court,
  // so it is only printed when the court is actually keeping it. A court whose
  // counts have drifted, which takes someone arriving mid-night and being
  // marked away again, gets the first sentence alone. The frame draws no
  // wording for the drifted case and none is invented.
  const leastPlayed = reason.withinOneGame
    ? `${names} had played the fewest games, so they are on. Nobody on this court is ever more than one game behind.`
    : `${names} had played the fewest games, so they are on.`;

  // The balance card only has something to say when two Cs ended up on
  // opposite sides, which is the rule working. The frame draws no wording for
  // a match with no assessed C in it (the common case on this roster), for a
  // lone C the queue could not give a counterpart, or for two Cs a human put
  // on the same team, so in all three the card is simply absent.
  const cs = reason.balance.cPlayers;
  const first = cs[0];
  const counterpart = cs.find((c) => c.side !== first?.side);
  const balance =
    reason.balance.kind === "acrossTheNet" && first && counterpart
      ? `${first.name} is C-tier, so ${counterpart.name} is across the net rather than alongside. No game becomes three players hunting the weak fourth.`
      : null;

  return (
    <Screen>
      <div
        style={{
          padding: "24px 22px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <h2 style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 25, lineHeight: 1.15, margin: 0 }}>
          Why this four
        </h2>
        <Eyebrow>Round {round} &middot; Court {courtNumber}</Eyebrow>
      </div>

      <Body style={{ padding: "16px 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Card>
          <CardTitle>Least played, first on</CardTitle>
          <CardBody>{leastPlayed}</CardBody>
        </Card>

        {balance != null && (
          <Card>
            <CardTitle>Never the only newcomer</CardTitle>
            <CardBody>{balance}</CardBody>
          </Card>
        )}

        {/* The third card is unconditional. It is not a report on this match,
            it is the law stated for the configuration the operator is most
            likely to be asked about, and the frame draws it on a two-court
            night for exactly that reason. The frame's em dash before the last
            clause becomes a comma; no word changes. */}
        <Card>
          <CardTitle>One court for everyone</CardTitle>
          <CardBody>
            When the whole group shares a court, the A-and-B mixing stays as it is, and C plays
            only with other Cs or with one B, never in a game with an A.
          </CardBody>
        </Card>

        <p style={{ font: `400 14px/1.6 ${T.fontBody}`, color: T.soft, margin: 0, textWrap: "pretty" }}>
          This is why the courts do not need to be pure. A gradient court still gives everyone a
          good night.
        </p>
      </Body>

      {onDismiss && (
        <div style={{ padding: "0 18px 20px" }}>
          <TertiaryButton onClick={onDismiss}>Back to the match</TertiaryButton>
        </div>
      )}
    </Screen>
  );
};
