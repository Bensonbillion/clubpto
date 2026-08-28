import type { ReactNode } from "react";
// Frame 21: the bracket, as a VERTICAL STAGE LIST.
//
// Never a horizontal tree, never an SVG connector diagram. Each stage is a
// section with a muted uppercase label, each tie is a full-width row under it,
// and the stages scroll as one group. A phone held one-handed at the side of a
// court cannot pan a tree, and a tree at 390px either shrinks the names to
// nothing or hides half the draw off screen.
//
// The stage label is the one place the eyebrow is not sage. Sage on a section
// heading would read as a place in the flow, and these are just labels over
// rows.
//
// The screen ends on the card that explains the pairing, because the pairing is
// the thing an operator gets asked about at the net. Splitting adjacent seeds
// looks arbitrary until someone says why, so frame 21 says why on the screen
// where the question comes up.

import {
  Body,
  Card,
  Eyebrow,
  FooterBar,
  PrimaryButton,
  Screen,
  T,
  TabBar,
  type Tab,
} from "../../ui/primitives";
import { BracketRow } from "./BracketRow";
import { CourtLabel, Heading, PlayoffHeader } from "./PlayoffHeader";
import type { BracketStage } from "./model";

/** A skeleton row stands at the height of a formed row: two sides and a column. */
const SKELETON_ROW_HEIGHT = 92;

export interface BracketProps {
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
  /** In play order. Stage names come from the court size. */
  stages: BracketStage[];
  /** The playoff match physically on court now. Null drops the bar. */
  matchOnCourtId: string | null;
  /**
   * The singular stage word for the row on court: `Semifinal`, `Play-in`,
   * `Final`. It is the only part of the bar's label that is not fixed, and
   * without it the bar is dropped rather than guessing a stage.
   */
  liveStageName?: string;
  loading?: boolean;
  /** A live or next row opens frame 22. */
  onOpenMatch: (matchId: string) => void;
  /** A completed row opens the correct or void flow, which is another slice. */
  onOpenResult?: (matchId: string) => void;
  /** The bar: jumps to whichever playoff match is on court. */
  onScoreMatchOnCourt: () => void;
  onSelectTab: (t: Tab) => void;
  /** Reworded tabs, e.g. Bracket where a knockout night has no standings. */
  tabLabels?: Partial<Record<Tab, string>>;
}

// FLAG: no error state is rendered here. A partial bracket is worse than none,
// so a failed read is the states-slice error frame INSTEAD of this component.
// FLAG: no empty state exists either. Frame 21 is unreachable before seeding.

export const Bracket = ({
  header,
  courtNumber,
  stages,
  matchOnCourtId,
  liveStageName,
  loading,
  onOpenMatch,
  onOpenResult,
  onScoreMatchOnCourt,
  onSelectTab,
  tabLabels,
}: BracketProps) => (
  <Screen>
    {header}
    <PlayoffHeader
      left={<Heading>Playoff</Heading>}
      right={<CourtLabel>Court {courtNumber}</CourtLabel>}
    />

    <Body style={{ padding: "16px 22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      {stages.map((stage) => (
        <div key={stage.name}>
          <Eyebrow style={{ color: T.mut, margin: "0 0 10px" }}>{stage.name}</Eyebrow>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading
              ? stage.matches.map((match) => (
                  <div
                    key={match.matchId}
                    style={{
                      border: `1.5px solid ${T.line}`,
                      borderRadius: T.radiusPanel,
                      height: SKELETON_ROW_HEIGHT,
                    }}
                  />
                ))
              : stage.matches.map((match) => (
                  <BracketRow
                    key={match.matchId}
                    match={match}
                    onOpen={
                      match.status === "complete"
                        ? onOpenResult && (() => onOpenResult(match.matchId))
                        : () => onOpenMatch(match.matchId)
                    }
                  />
                ))}
          </div>
        </div>
      ))}

      {!loading && (
        <Card>
          <p style={{ fontFamily: T.fontHead, fontSize: 17, margin: "0 0 8px" }}>
            Why 1 and 2 are not partners
          </p>
          <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>
            Pairing the top two builds a superteam and makes the final a coronation.
            Splitting adjacent seeds gives every pair one high seed and one lower, so
            any pair can beat any pair.
          </p>
        </Card>
      )}
    </Body>

    {/* The whole bar goes when no playoff match is playable: every stage done
        means the champion frame is the destination, not a dead button. */}
    {!loading && matchOnCourtId != null && liveStageName != null && (
      <FooterBar>
        <PrimaryButton onClick={onScoreMatchOnCourt}>
          Score the live {liveStageName.toLowerCase()}
        </PrimaryButton>
      </FooterBar>
    )}

    <TabBar active={tabLabels ? "standings" : "match"} onChange={onSelectTab} labels={tabLabels} />
  </Screen>
);

export default Bracket;
