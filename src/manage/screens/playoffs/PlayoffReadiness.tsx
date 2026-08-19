// Frames 19a and 19b — Playoff readiness, blocked and ready.
//
// One component, because they are one screen: the same full-screen gate with
// the same checklist, and the only structural difference is whether a blocker
// exists. v2 draws only the blocked state; 19b is v1's copy in v2's language.
//
// Which element is bold moves with the state, and that is the whole design:
//   blocked → the 2px card, because the tap that matters is inside it.
//   ready   → the lime footer button, because the tap that matters is seeding.
// Never both. Lime appears once per screen.
//
// The second checklist row can never fail. Order comes from points, then score
// difference, then whoever reached the total first (engine/standings.ts), which
// is a fact about the night rather than a decision someone owes the app. There
// is no coin flip and no unresolved-tie gate anywhere here — the row exists to
// say so out loud, next to the checks that genuinely can block.

import type { CSSProperties, ReactNode } from "react";
import {
  Body,
  FooterBar,
  Num,
  PrimaryButton,
  Screen,
  T,
} from "../../ui/primitives";
import { PlayoffHeader } from "./PlayoffHeader";
import { joinNames } from "./model";

/** The disabled `Seed the playoff` fill, exactly as frame 19a draws it. */
const DISABLED_FILL = "rgba(244,237,224,.1)";
const DISABLED_INK = "rgba(244,237,224,.4)";

const DISABLED_STYLE: CSSProperties = {
  background: DISABLED_FILL,
  color: DISABLED_INK,
  opacity: 1,
};

const CARD_BODY_INK = "rgba(244,237,224,.7)";

/**
 * The first reason seeding is held, expanded into the card. Two exist, and both
 * are about the night's matches: a score still outstanding, or a player short of
 * games. Neither is about a tie.
 */
export type SeedingBlocker =
  | {
      kind: "owedMatches";
      /** Everyone on this court who is owed a match. Collapses into one card. */
      playerNames: string[];
      /** What everyone else on the court has played — the `3` in the body. */
      othersMatchesPlayed: number;
      /** False when the drawing engine cannot produce a match for them. */
      canDrawMatch: boolean;
    }
  | {
      kind: "liveMatch";
      /** The round the outstanding match belongs to. */
      round: number;
      /** `Ade and Seyi` — already joined by the caller. */
      teamA: string;
      /** `Dami and Lanre`. */
      teamB: string;
    };

export interface PlayoffReadinessProps {
  courtNumber: number;
  /**
   * Other courts still running. The reassurance line names one; it is dropped
   * rather than fudged when there is a different number of them.
   */
  otherCourtNumbers: number[];
  /** Row 1 fails while a match is on court or its score is outstanding. */
  liveMatchOnCourt: boolean;
  /** Names owed a match on this court. Empty passes row 3. */
  playersOwedMatches: string[];
  /** The first blocking reason. Null renders the ready gate (19b). */
  blocker: SeedingBlocker | null;
  /** First stage name for the ready helper: `Semifinals`, `Quarterfinals`. */
  firstStageName: string;
  /** Readiness has not resolved yet. */
  loading?: boolean;
  /**
   * Readiness failed to load. Do not guess: the states-slice failure line goes
   * in the helper slot, the checklist is not drawn, and seeding stays disabled.
   * A node rather than a string because that copy belongs to the states slice.
   */
  errorHelper?: ReactNode;
  /**
   * The in-card action. `Draw {name} a match` creates a regular round-robin
   * match on this court and returns to the court view; `Score that match` opens
   * score entry for the outstanding result.
   */
  onResolveBlocker: () => void;
  /** Freezes the standings order into seeds, builds the bracket, opens frame 20. */
  onSeedPlayoff: () => void;
}

const CheckRow = ({ ok, label }: { ok: boolean; label: string }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 0",
      borderBottom: `1px solid ${T.lineSoft}`,
    }}
  >
    {/* VT323 carries the markers as well as the numerals. */}
    <Num size={26} style={{ color: ok ? T.ink : T.redInk }}>{ok ? "OK" : "NO"}</Num>
    <span style={{ font: `${ok ? 400 : 600} 16px Inter, sans-serif`, flex: 1 }}>{label}</span>
  </div>
);

const SkeletonRows = () => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ height: 26, padding: "14px 0", borderBottom: `1px solid ${T.lineSoft}` }} />
    ))}
  </div>
);

interface CardCopy {
  heading: string;
  body: string;
  action: string | null;
  actionEnabled: boolean;
}

const cardCopy = (blocker: SeedingBlocker | null, courtNumber: number): CardCopy => {
  if (blocker == null) {
    return {
      heading: "Standings settled",
      body: "Every score is in. Everyone on this court is in the playoff, seeded from the table.",
      action: null,
      actionEnabled: false,
    };
  }

  if (blocker.kind === "liveMatch") {
    return {
      heading: "One score is still outstanding",
      body: `Round ${blocker.round}, ${blocker.teamA} against ${blocker.teamB}. Seeding needs it, because it changes who meets whom.`,
      action: "Score that match",
      actionEnabled: true,
    };
  }

  const names = joinNames(blocker.playerNames);
  const plural = blocker.playerNames.length > 1;
  // FLAG: the spec pluralises the HEADING for several owed players and says
  // nothing about the body, whose two `{name}` slots then read as the same
  // name-list twice. That plural body sentence is not drawn anywhere.
  return {
    heading: `${names} ${plural ? "are" : "is"} owed a match before seeding`,
    body: `Everyone else on Court ${courtNumber} has played ${blocker.othersMatchesPlayed}. Seeding now would place ${names} below players ${names} never got to face.`,
    action: `Draw ${names} a match`,
    actionEnabled: blocker.canDrawMatch,
  };
};

export const PlayoffReadiness = ({
  courtNumber,
  otherCourtNumbers,
  liveMatchOnCourt,
  playersOwedMatches,
  blocker,
  firstStageName,
  loading,
  errorHelper,
  onResolveBlocker,
  onSeedPlayoff,
}: PlayoffReadinessProps) => {
  const failed = errorHelper != null;
  const ready = blocker == null;
  const card = cardCopy(blocker, courtNumber);
  const owedNames = joinNames(playersOwedMatches);
  const owedPlural = playersOwedMatches.length > 1;

  const helper = failed
    ? errorHelper
    : loading
      ? // FLAG: no helper is drawn for the loading gate. Only the disabled
        // button is specified, so nothing is asserted about readiness yet.
        undefined
      : ready
        // The wireframes wrote this for a multi-round bracket. The playoff is
        // the top four in one final, so the sentence says that rather than
        // promising a round the night never plays.
        ? `${firstStageName}. Pairs are seeded top with bottom.`
        : "Seeding is held until games played are even.";

  return (
    <Screen>
      <PlayoffHeader title="Playoff" courtNumber={courtNumber} />

      <Body
        style={{
          padding: "20px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* FLAG: a failed readiness call draws no body. Readiness is not
            guessed, so no checklist and no card are rendered. */}
        {!failed &&
          (loading ? (
            <SkeletonRows />
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <CheckRow ok={!liveMatchOnCourt} label="No match is on court right now" />
                <CheckRow ok label="Every tie is settled by match order" />
                {/* FLAG: the third row is only drawn while someone is owed a
                    match. Neither wireframe writes a passing form of this label,
                    so the row is dropped rather than worded here. */}
                {playersOwedMatches.length > 0 && (
                  <CheckRow
                    ok={false}
                    label={`${owedNames} ${owedPlural ? "are" : "is"} owed a match`}
                  />
                )}
              </div>

              <div
                style={{
                  border: ready ? `1px solid ${T.line}` : `2px solid ${T.ink}`,
                  borderRadius: T.radius,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ font: "700 19px/1.3 Inter, sans-serif" }}>{card.heading}</div>
                <div style={{ font: "400 15px/1.45 Inter, sans-serif", color: CARD_BODY_INK }}>
                  {card.body}
                </div>
                {card.action != null && (
                  <PrimaryButton
                    onClick={onResolveBlocker}
                    disabled={!card.actionEnabled}
                    style={{
                      height: 52,
                      font: "700 17px Inter, sans-serif",
                      ...(card.actionEnabled ? null : DISABLED_STYLE),
                    }}
                  >
                    {card.action}
                  </PrimaryButton>
                )}
              </div>

              {/* FLAG: the line is written for exactly one other court. No copy
                  exists for none, or for two or more, so it is dropped. */}
              {otherCourtNumbers.length === 1 && (
                <div
                  style={{
                    font: "400 15px/1.4 Inter, sans-serif",
                    color: T.ink55,
                    marginTop: "auto",
                  }}
                >
                  Court {otherCourtNumbers[0]} seeds on its own and is unaffected.
                </div>
              )}
            </>
          ))}
      </Body>

      <FooterBar helper={helper}>
        <PrimaryButton
          onClick={onSeedPlayoff}
          disabled={!ready || loading === true || failed}
          style={!ready || loading === true || failed ? DISABLED_STYLE : undefined}
        >
          Seed the playoff
        </PrimaryButton>
      </FooterBar>
    </Screen>
  );
};

export default PlayoffReadiness;
