// Frame 20 — the bracket, as a VERTICAL STAGE LIST.
//
// Never a horizontal tree, never an SVG connector diagram. Each stage is a
// section with an uppercase label; each tie is a full-width row underneath it;
// the stages scroll as one group. A phone held one-handed at the side of a
// court cannot pan a tree, and a tree at 390px either shrinks the names to
// nothing or hides half the draw off-screen.
//
// The intro line and every row's seed label read the same stored pairing, so
// the sentence and the rows can never disagree about who was seeded with whom.

import { Fragment } from "react";
import { Body, FooterBar, Num, PrimaryButton, Screen, T } from "../../ui/primitives";
import { BracketRow } from "./BracketRow";
import { PlayoffHeader } from "./PlayoffHeader";
import { topHalfSeedPairs } from "./model";
import type { BracketStage, SeedPair } from "./model";

/** A skeleton row stands at the height of a formed row: two teams and a band. */
const SKELETON_ROW_HEIGHT = 132;

export interface BracketProps {
  courtNumber: number;
  /** The `8` in `All 8 players are in.` */
  playersInPlayoff: number;
  /**
   * The pairing rule as pairs of seed numbers, in row order:
   * `[[1,3],[6,8],[2,4],[5,7]]`. One source for the intro line and the labels.
   */
  seedPairs: SeedPair[];
  /** In play order. Stage names come from the court size. */
  stages: BracketStage[];
  /** The playoff match physically on court now. Null hides the footer bar. */
  matchOnCourtId: string | null;
  /**
   * What the row on court is: "Semifinal", "Play-in", "Final". The footer used
   * to say "The final is on court now" unconditionally, which was true only
   * while a bracket was a single match. A full court plays up to four.
   */
  liveStageName?: string;
  loading?: boolean;
  /** A live or next-up row opens frame 21. */
  onOpenMatch: (matchId: string) => void;
  /** A completed row opens the correct/void flow (frame 16, other slice). */
  onOpenResult?: (matchId: string) => void;
  /** Footer: jumps to whichever playoff match is on court. */
  onScoreMatchOnCourt: () => void;
}

// FLAG: no error state is rendered here. A partial bracket is worse than none,
// so a failed fetch is the states-slice error frame INSTEAD of this component.
// FLAG: no empty state exists either — frame 20 is unreachable before seeding.

const StageLabel = ({ children }: { children: string }) => (
  <div
    style={{
      font: "800 13px Inter, sans-serif",
      letterSpacing: ".1em",
      textTransform: "uppercase",
      color: T.ink45,
    }}
  >
    {children}
  </div>
);

export const Bracket = ({
  courtNumber,
  playersInPlayoff,
  seedPairs,
  stages,
  matchOnCourtId,
  liveStageName,
  loading,
  onOpenMatch,
  onOpenResult,
  onScoreMatchOnCourt,
}: BracketProps) => (
  <Screen>
    <PlayoffHeader title="Playoff" courtNumber={courtNumber} />

    <Body
      style={{
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* FLAG: the intro line is dropped while loading. It states counts that
          are not known yet, and no loading wording is drawn for it. */}
      {!loading && (
        <div style={{ font: "400 15px/1.4 Inter, sans-serif", color: T.ink60 }}>
          All <Num size={20}>{playersInPlayoff}</Num> players are in. Seeds pair{" "}
          {topHalfSeedPairs(seedPairs).map((pair, i) => (
            <Fragment key={`${pair[0]}+${pair[1]}`}>
              {i > 0 ? " and " : null}
              <Num size={20}>{pair[0]}</Num>+<Num size={20}>{pair[1]}</Num>
            </Fragment>
          ))}
          .
        </div>
      )}

      {stages.map((stage) => (
        <div key={stage.name} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <StageLabel>{stage.name}</StageLabel>

          {loading
            ? stage.matches.map((match) => (
                <div
                  key={match.matchId}
                  style={{
                    border: `1px solid ${T.line}`,
                    borderRadius: T.radius,
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
                      : match.status === "pending"
                        ? undefined
                        : () => onOpenMatch(match.matchId)
                  }
                />
              ))}
        </div>
      ))}
    </Body>

    {/* The whole bar goes when no playoff match is playable: all stages done
        means the champion frame is the destination, not a dead button. */}
    {!loading && matchOnCourtId != null && (
      <FooterBar
        helper={
          <span style={{ font: "600 16px/1.35 Inter, sans-serif", color: T.ink }}>
            {liveStageName ? `The ${liveStageName.toLowerCase()} is on court now.` : "A match is on court now."}
          </span>
        }
      >
        <PrimaryButton
          onClick={onScoreMatchOnCourt}
          style={{ height: 56, font: "700 18px Inter, sans-serif" }}
        >
          Score that match
        </PrimaryButton>
      </FooterBar>
    )}
  </Screen>
);

export default Bracket;
