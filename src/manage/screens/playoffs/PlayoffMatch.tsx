// Frame 21 — a playoff match on court.
//
// The same three-band anatomy as a bracket row, scaled up until it reads from
// the bench: 22px names, a 96px score band. It is the one bold element and the
// only thing on the screen.
//
// Scoring is two taps and this frame is tap one: pick the winning side, by the
// named button or by that side's half of the band, and score entry (frame 11,
// other slice) attaches the numbers. The `00 / 00` band is the pre-score state,
// not an editable field — nothing on this frame types a number.
//
// v1 had no winner buttons and no way back; it relied on hitting a 108px score
// half. v2 names both sides explicitly and adds `Back to bracket`, because a
// mis-tap on a playoff match is the most expensive mis-tap of the night.

import type { ReactNode } from "react";
import {
  Body,
  FooterBar,
  Num,
  Screen,
  SecondaryButton,
  T,
  TertiaryButton,
} from "../../ui/primitives";
import { PlayoffHeader } from "./PlayoffHeader";
import { ScoreBand } from "./ScoreBand";
import { countWord, winnerFromScores } from "./model";
import type { PlayoffTeam } from "./model";

/** Long pair names drop a point so both buttons keep one line. */
const LONG_NAME = 15;

export interface PlayoffMatchProps {
  courtNumber: number;
  /** `Semifinal`, `Final` — the singular stage word, not the stage list's. */
  stageLabel: string;
  /** The `2` in `Semifinal 2`. Null on a stage that holds one match. */
  stageMatchNumber: number | null;
  teamA: PlayoffTeam;
  teamB: PlayoffTeam;
  /** Null until the result is recorded. The band renders null as 00. */
  scoreA: number | null;
  scoreB: number | null;
  /**
   * The side already through, for `Winner meets {team} in the final.` Null on a
   * final: nothing feeds off it, so the sentence is dropped rather than reworded.
   */
  winnerMeetsTeamName: string | null;
  /**
   * How many players are on the other court right now. Null when they are not
   * all on one other court — the sentence must be true or absent.
   */
  othersOnSecondCourt: number | null;
  /** Tap one of two: picks the winning side and hands off to score entry. */
  onPickWinner: (side: "A" | "B") => void;
  /** Back to frame 20. No state change. */
  onBackToBracket: () => void;
}

const TeamLine = ({ team, dim }: { team: PlayoffTeam; dim: boolean }) => (
  <div
    style={{
      padding: "16px 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    }}
  >
    <span style={{ font: "700 22px Inter, sans-serif", color: dim ? T.ink55 : T.ink }}>
      {team.name}
    </span>
    <Num size={22} style={{ color: T.ink50 }}>{team.seedLabel}</Num>
  </div>
);

export const PlayoffMatch = ({
  courtNumber,
  stageLabel,
  stageMatchNumber,
  teamA,
  teamB,
  scoreA,
  scoreB,
  winnerMeetsTeamName,
  othersOnSecondCourt,
  onPickWinner,
  onBackToBracket,
}: PlayoffMatchProps) => {
  const winner = winnerFromScores(scoreA, scoreB);
  const scored = winner != null;

  const title: ReactNode =
    stageMatchNumber == null ? (
      stageLabel
    ) : (
      <>
        {stageLabel} <Num size={20}>{stageMatchNumber}</Num>
      </>
    );

  const sentences = [
    winnerMeetsTeamName == null ? null : `Winner meets ${winnerMeetsTeamName} in the final.`,
    othersOnSecondCourt == null
      ? null
      : `Nobody sits out: the other ${countWord(othersOnSecondCourt)} are on the second court.`,
  ].filter((s): s is string => s != null);

  return (
    <Screen>
      <PlayoffHeader title={title} courtNumber={courtNumber} stage />

      <Body
        style={{
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ border: `1px solid ${T.line}`, borderRadius: T.radius, overflow: "hidden" }}>
          <TeamLine team={teamA} dim={winner === "B"} />
          <ScoreBand
            scoreA={scoreA}
            scoreB={scoreB}
            size={96}
            cellPadding={10}
            onTapSide={scored ? undefined : onPickWinner}
          />
          <TeamLine team={teamB} dim={winner === "A"} />
        </div>

        {sentences.length > 0 && (
          <div style={{ font: "400 15px/1.4 Inter, sans-serif", color: T.ink60 }}>
            {sentences.join(" ")}
          </div>
        )}
      </Body>

      {/* FLAG: revisiting a match whose score is already in drops the whole
          footer bar. `Tap the winning side to score.` is no longer true, and the
          correct/void entry point the spec puts here has no drawn label on this
          frame — its copy belongs to frame 16. Nothing is worded in its place;
          `Back to bracket` stays. */}
      {!scored && (
        <FooterBar
          helper={
            <span style={{ font: "600 16px/1.35 Inter, sans-serif", color: T.ink }}>
              Tap the winning side to score.
            </span>
          }
        >
          <div style={{ display: "flex", gap: 10 }}>
            <SecondaryButton
              onClick={() => onPickWinner("A")}
              style={{
                flex: 1,
                width: "auto",
                height: 56,
                font: `700 ${teamA.name.length > LONG_NAME ? 16 : 17}px Inter, sans-serif`,
              }}
            >
              {teamA.name}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => onPickWinner("B")}
              style={{
                flex: 1,
                width: "auto",
                height: 56,
                font: `700 ${teamB.name.length > LONG_NAME ? 16 : 17}px Inter, sans-serif`,
              }}
            >
              {teamB.name}
            </SecondaryButton>
          </div>
        </FooterBar>
      )}

      <TertiaryButton
        onClick={onBackToBracket}
        style={{
          minHeight: 0,
          padding: "12px 18px 18px",
          textDecoration: "none",
          font: "600 15px Inter, sans-serif",
        }}
      >
        Back to bracket
      </TertiaryButton>
    </Screen>
  );
};

export default PlayoffMatch;
