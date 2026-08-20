// Frame 22: a playoff match on court.
//
// Two named cards with the slat between them, filling the middle of the screen.
// The cards ARE the scoring control: "Tap to score" is written under each name,
// and a tap hands that side to score entry. There is no button in the bar,
// because a third way to say the same thing is a third way to mis-tap.
//
// The 00 / 00 slat is the pre-score state, not an editable field. Nothing on
// this frame types a number.
//
// Playoff games score exactly like league games, which the bar says out loud.
// It is the one sentence on the screen and it exists because the operator has
// spent two hours in a different flow and is about to wonder whether this one
// is different.

import type { CSSProperties } from "react";
import {
  Eyebrow,
  FooterBar,
  Screen,
  T,
  TabBar,
  type Tab,
} from "../../ui/primitives";
import { CourtChip, PlayoffHeader } from "./PlayoffHeader";
import { ScoreBand } from "./ScoreBand";
import { winnerFromScores } from "./model";
import type { PlayoffTeam } from "./model";

/** The slat's numerals, at the size frame 22 draws them. */
const SLAT_SIZE = 86;

export interface PlayoffMatchProps {
  courtNumber: number;
  /** `Semifinal`, `Play-in`, `Final`: the singular stage word. */
  stageLabel: string;
  /** The "2" in "Semifinal 2". Null on a stage that holds one match. */
  stageMatchNumber: number | null;
  teamA: PlayoffTeam;
  teamB: PlayoffTeam;
  /** Null until the result is recorded. The slat renders null as 00. */
  scoreA: number | null;
  scoreB: number | null;
  /**
   * A tap on one of the two cards. The side says which card was tapped, not
   * who won: score entry types BOTH numbers and the higher one takes the
   * points, so nothing is decided here.
   */
  onScoreSide: (side: "A" | "B") => void;
  onSelectTab: (t: Tab) => void;
  /** The court chip is the switcher on this frame. Omit it and it is a label. */
  onOpenCourtSwitcher?: () => void;
}

const SideCard = ({ team, dim, onPick, style }: {
  team: PlayoffTeam; dim: boolean; onPick?: () => void; style: CSSProperties;
}) => (
  <button
    type="button"
    onClick={onPick}
    disabled={onPick == null}
    style={{
      ...style,
      padding: 22, textAlign: "center",
      border: `1.5px solid ${T.lineChip}`, borderRadius: T.radius,
      background: "transparent", color: dim ? T.soft : T.ink,
      cursor: onPick == null ? "default" : "pointer",
      display: "block", width: "auto",
    }}
  >
    <span style={{ fontFamily: T.fontHead, fontSize: 28, lineHeight: 1.15 }}>
      {team.name}
    </span>
    {/* "Tap to score", not "Tap if they won". The tap opens score entry, where
        BOTH numbers are typed and the higher one takes the points, so a prompt
        promising the tap records a win would be describing the old flow.
        FLAG: a match whose score is already in draws no replacement for this
        line. The prompt disappears with the tap it describes. */}
    {onPick != null && (
      <p style={{
        font: `600 12px ${T.fontBody}`, letterSpacing: ".08em",
        textTransform: "uppercase", color: T.soft, margin: "8px 0 0",
      }}>Tap to score</p>
    )}
  </button>
);

export const PlayoffMatch = ({
  courtNumber,
  stageLabel,
  stageMatchNumber,
  teamA,
  teamB,
  scoreA,
  scoreB,
  onScoreSide,
  onSelectTab,
  onOpenCourtSwitcher,
}: PlayoffMatchProps) => {
  const winner = winnerFromScores(scoreA, scoreB);
  const scored = winner != null;

  return (
    <Screen>
      <PlayoffHeader
        flush
        left={
          <Eyebrow>
            {stageMatchNumber == null ? stageLabel : `${stageLabel} ${stageMatchNumber}`}
          </Eyebrow>
        }
        right={<CourtChip onClick={onOpenCourtSwitcher}>Court {courtNumber}</CourtChip>}
      />

      {/* The match takes the middle of the screen rather than sitting under the
          header, so the slat lands where a thumb rests. */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <SideCard
          team={teamA}
          dim={winner === "B"}
          onPick={scored ? undefined : () => onScoreSide("A")}
          style={{ margin: "14px 14px 12px" }}
        />
        <ScoreBand scoreA={scoreA} scoreB={scoreB} size={SLAT_SIZE} />
        <SideCard
          team={teamB}
          dim={winner === "A"}
          onPick={scored ? undefined : () => onScoreSide("B")}
          style={{ margin: "12px 14px 14px" }}
        />
      </div>

      {/* The bar carries a sentence and no action. Frame 22 draws no button
          here, so the slot is empty rather than filled with one. */}
      <FooterBar helper="Playoff games score exactly like league games.">{null}</FooterBar>

      <TabBar active="match" onChange={onSelectTab} />
    </Screen>
  );
};

export default PlayoffMatch;
