// Frame 19: How this court ends.
//
// The choice between the doubles bracket and one more round, taken PER COURT.
// The other court is unaffected, and the screen says so in its own second line
// rather than leaving the operator to wonder.
//
// engine/endings.ts models the whole decision. This screen reads it and draws
// it: `oneMoreRound` arrives from `oneMoreRoundChange` already carrying the
// raised target and whether the raise divides into fours at all, so nothing is
// re-derived here. Ten a side is the case that bites, and the engine, not this
// file, is what knows it.
//
// WHY THERE ARE TWO CONTROLS AND ONE BUTTON. The frame highlights the bracket
// card and puts "Build the bracket" in the bar, so the bar's action is the
// bracket. It draws no label for a bar that would commit one more round, so
// none is invented: the "One more round" card is itself the tap that chooses
// it. Both endings are reachable and every word on screen is the frame's.

import type { ReactNode } from "react";
import {
  Body,
  Card,
  Eyebrow,
  FooterBar,
  PrimaryButton,
  Screen,
  T,
} from "../../ui/primitives";
import type { ChosenEnding, OneMoreRound } from "../../engine/endings";
import { Heading, PlayoffHeader } from "./PlayoffHeader";
import { ordinalWord } from "./model";

/**
 * What the bracket will actually be for this court's headcount, so the card
 * can say it instead of reciting frame 19's eight-player example. The frame's
 * sentence, "Four pairs, two semis, a final. Three matches", is only true for
 * eight; ten a side plays a play-in first and nine seeds a trio, and the app's
 * own promise is that it states the consequence rather than hiding the maths.
 */
export interface BracketShape {
  pairs: number;
  matches: number;
  hasPlayIn: boolean;
  hasTrio: boolean;
}

export interface HowThisCourtEndsProps {
  courtNumber: number;
  bracketShape: BracketShape;
  /**
   * Straight from engine/endings.ts `oneMoreRoundChange(courtSize, target)`.
   * `targetMatches` is the raised target, which is the "fourth" in "Everyone
   * plays a fourth match"; `possible` is false when the raise does not divide
   * into fours.
   */
  oneMoreRound: OneMoreRound;
  /**
   * The other court's decision, for the bar's line. Null while it has not
   * decided, and null on a one-court night.
   */
  otherCourt: { courtNumber: number; ending: ChosenEnding } | null;
  /** The bar's action, and a tap on the bracket card. */
  onChooseDoublesBracket: () => void;
  /** A tap on the "One more round" card. */
  onChooseOneMoreRound: () => void;
}

/** Frame 19 writes its numbers as words, so these follow suit. */
const wordFor = (n: number): string =>
  ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][n] ?? String(n);

const CardButton = ({ onClick, tone, children }: {
  onClick?: () => void; tone?: "plain" | "live"; children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={onClick == null}
    style={{
      display: "block", width: "100%", padding: 0, border: "none",
      background: "transparent", color: "inherit", textAlign: "left",
      cursor: onClick == null ? "default" : "pointer",
    }}
  >
    <Card tone={tone} style={{ gap: 0 }}>{children}</Card>
  </button>
);

const Title = ({ children }: { children: ReactNode }) => (
  <p style={{ fontFamily: T.fontHead, fontSize: 18, margin: "0 0 6px" }}>{children}</p>
);

const Detail = ({ children }: { children: ReactNode }) => (
  <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>
    {children}
  </p>
);

// Frame 19 writes one line about the other court, and it writes it for the one
// more round case: "Court 1 chose one more round."
// FLAG: no wording is drawn for a court that chose the doubles bracket, or for
// one that has not decided. Both render nothing rather than a sentence the
// owner never wrote.
const otherCourtLine = (
  other: HowThisCourtEndsProps["otherCourt"],
): string | undefined =>
  other != null && other.ending === "oneMoreRound"
    ? `Court ${other.courtNumber} chose one more round.`
    : undefined;

export const HowThisCourtEnds = ({
  courtNumber, oneMoreRound, otherCourt,
  onChooseDoublesBracket, onChooseOneMoreRound,
  bracketShape,
}: HowThisCourtEndsProps) => (
  <Screen>
    <PlayoffHeader
      left={<Heading>How should Court {courtNumber} end?</Heading>}
      right={<Eyebrow>Targets met</Eyebrow>}
    />

    <p style={{
      font: `400 15px/1.5 ${T.fontBody}`, color: T.mut,
      padding: "0 22px", margin: "8px 0 0", textWrap: "pretty",
    }}>
      Each court decides on the night. The other court is unaffected.
    </p>

    <Body style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
      <CardButton tone="live" onClick={onChooseDoublesBracket}>
        <Title>Doubles bracket</Title>
        <Detail>
          {wordFor(bracketShape.pairs)} pairs,{" "}
          {bracketShape.hasPlayIn ? "a play-in, two semis" : bracketShape.pairs === 2 ? "one final" : "two semis"}
          {bracketShape.pairs > 2 ? ", a final" : ""}.{" "}
          {wordFor(bracketShape.matches)} matches, everyone on court plays,
          about half an hour.
          {bracketShape.hasTrio ? " The last pair rotates three players so nobody watches." : ""}
        </Detail>
      </CardButton>

      {/* A court whose raised target does not divide into fours cannot give
          everyone one more game. The frames draw no wording for that, so the
          card is drawn and left inert rather than captioned with an excuse. */}
      <CardButton onClick={oneMoreRound.possible ? onChooseOneMoreRound : undefined}>
        <Title>One more round</Title>
        <Detail>
          Everyone plays a {ordinalWord(oneMoreRound.targetMatches)} match and whoever
          tops the table is the individual champion. Same length of evening,
          different flavour.
        </Detail>
      </CardButton>
    </Body>

    <FooterBar helper={otherCourtLine(otherCourt)}>
      <PrimaryButton onClick={onChooseDoublesBracket}>Build the bracket</PrimaryButton>
    </FooterBar>
  </Screen>
);

export default HowThisCourtEnds;
