// Frames 20a and 20b: Playoff readiness, blocked and ready.
//
// One component, because they are one screen: the same gate, the same bar, and
// the only difference is whether a score is still outstanding.
//
// Which element is bold moves with the state, and that is the whole design:
//   blocked  the sage 2px card, because the tap that matters is inside it
//   ready    the sage bar button, because the tap that matters is building
// Never both. The one fill appears once per screen.
//
// Nothing here gates on a tie. Order comes from points, then score difference,
// then whoever reached the total first, which is a fact about the night rather
// than a decision someone owes the app. The blocked bar says exactly that, out
// loud, next to the one thing that genuinely can block.
//
// THE COPY THAT CHANGED. The ready bar used to promise "Straight to the final.
// Pairs are seeded top with bottom", which was true only while seeding took the
// top four. Every player on the court is in the playoff now, and pairs SPLIT
// ADJACENT SEEDS. Frame 20b's own sentence replaces it and reads the real
// pairing rather than restating a rule.

import type { CSSProperties, ReactNode } from "react";
import {
  Body,
  Card,
  Eyebrow,
  FooterBar,
  PrimaryButton,
  Screen,
  SecondaryButton,
  T,
  TabBar,
  type Tab,
} from "../../ui/primitives";
import { Heading, PlayoffHeader } from "./PlayoffHeader";
import { countWord, seedPairLabel } from "./model";
import type { SeedPair } from "./model";

/**
 * Why seeding is held.
 *
 * Frame 20a draws exactly one reason, an outstanding score, and expands it into
 * the card. Everything else engine/playoff.ts can report is undrawn, and the
 * "undrawn" member exists so a court can be held without this file inventing a
 * card for it.
 */
export type SeedingBlocker =
  | {
      kind: "outstandingScore";
      /** The round that match belongs to: the "3" in "Round 3". */
      round: number;
      /** `Hamid and Chibuike`, already joined by the caller. */
      teamA: string;
      /** `Fiyin and David`. */
      teamB: string;
    }
  | {
      /**
       * Held for a reason the frames do not draw: too few players on the court,
       * or games still owed with nothing on court to score. The card is dropped
       * and the button stays spent, because a card here would put words on
       * screen the owner never wrote.
       */
      kind: "undrawn";
    };

export interface PlayoffReadinessProps {
  /**
   * The court chip row and the night menu, rendered above everything else.
   *
   * Found on a live walk: once a bracket existed, the operator was TRAPPED on
   * that court. Every playoff screen drew its own head and none carried the
   * court header, so there were no tabs to flip with and no menu to end the
   * night from. Frame A13 promises "flip mid-match, mid-score, mid-anything"
   * and frame 25b promises the menu "from any screen, either court, all
   * night", and a champion screen is a screen.
   */
  header?: ReactNode;
  courtNumber: number;
  /** Null renders the ready gate, frame 20b. */
  blocker: SeedingBlocker | null;
  /** The "eight" in "All eight played three." */
  playersOnCourt: number;
  /** The "three". */
  matchesEach: number;
  /**
   * The pairs seeding will make, in row order: `[[1,3],[2,4],[5,7],[6,8]]`.
   * The bar lists every one of them, because the split is the thing the
   * operator is about to be asked to trust.
   */
  seedPairs: SeedPair[];
  /** Readiness has not resolved yet. */
  loading?: boolean;
  /**
   * Readiness failed to load. Do not guess: the states-slice failure line goes
   * in the helper slot, the card is not drawn, and the button stays spent. A
   * node rather than a string because that copy belongs to the states slice.
   */
  errorHelper?: ReactNode;
  /** The in-card ghost: opens score entry for the outstanding result. */
  onResolveBlocker: () => void;
  /** Freezes the table into seeds, builds the bracket, opens frame 21. */
  onSeedPlayoff: () => void;
  onSelectTab: (t: Tab) => void;
}

const CardTitle = ({ children }: { children: ReactNode }) => (
  <p style={{ fontFamily: T.fontHead, fontSize: 17, margin: "0 0 8px" }}>{children}</p>
);

const CardBody = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, ...style }}>
    {children}
  </p>
);

const Skeleton = () => (
  <div style={{ border: `1.5px solid ${T.line}`, borderRadius: T.radius, height: 128 }} />
);

export const PlayoffReadiness = ({
  header,
  courtNumber,
  blocker,
  playersOnCourt,
  matchesEach,
  seedPairs,
  loading,
  errorHelper,
  onResolveBlocker,
  onSeedPlayoff,
  onSelectTab,
}: PlayoffReadinessProps) => {
  const failed = errorHelper != null;
  const ready = blocker == null;
  const outstanding = blocker != null && blocker.kind === "outstandingScore" ? blocker : null;

  // The eyebrow reports the state the body is about. A court held for a reason
  // the frames do not draw gets no eyebrow, because "Targets met" would be a
  // lie and "Round 3" is only true of an outstanding score.
  const step = failed || loading
    ? undefined
    : ready
      ? "Targets met"
      : outstanding != null
        ? `Round ${outstanding.round}`
        : undefined;

  const helper = failed
    ? errorHelper
    : loading
      // FLAG: no helper is drawn for the loading gate. Only the spent button is
      // specified, so nothing is asserted about readiness yet.
      ? undefined
      : ready
        ? `Pairs come straight from the table, splitting adjacent seeds: ${seedPairs.map(seedPairLabel).join(", ")}.`
        // Frame 20a joins these two clauses with an em dash. The owner's voice
        // rule has no em dashes, so the clause becomes its own sentence and
        // every word stays the frame's.
        : "Ties do not block anything. They settle themselves on who got there first.";

  return (
    <Screen>
    {header}
      <PlayoffHeader
        left={<Heading>Playoff, Court {courtNumber}</Heading>}
        right={step != null ? <Eyebrow>{step}</Eyebrow> : undefined}
      />

      <Body style={{ padding: "18px 22px" }}>
        {/* FLAG: a failed readiness call draws no body. Readiness is never
            guessed, so no card is rendered at all. */}
        {failed ? null : loading ? (
          <Skeleton />
        ) : ready ? (
          <Card>
            <CardTitle>Every score is in</CardTitle>
            <CardBody>
              All {countWord(playersOnCourt)} played {countWord(matchesEach)}. The table
              is final, so the seeds are final.
            </CardBody>
          </Card>
        ) : outstanding != null ? (
          <Card tone="live">
            <CardTitle>One score is still outstanding</CardTitle>
            <CardBody style={{ marginBottom: 14 }}>
              Round {outstanding.round}, {outstanding.teamA} against {outstanding.teamB}.
              Seeding needs it, because the order decides who meets whom.
            </CardBody>
            <SecondaryButton
              onClick={onResolveBlocker}
              style={{ minHeight: 48, fontSize: 15 }}
            >
              Score that match
            </SecondaryButton>
          </Card>
        ) : null}
      </Body>

      <FooterBar helper={helper}>
        <PrimaryButton
          onClick={onSeedPlayoff}
          disabled={!ready || loading === true || failed}
        >
          Build the bracket
        </PrimaryButton>
      </FooterBar>

      <TabBar active="standings" onChange={onSelectTab} />
    </Screen>
  );
};

export default PlayoffReadiness;
