// Frame 22 — the champion.
//
// The one playoff frame with no header bar, and the only one that reaches for
// Playfair: one court, two names, the final score, and the sentence that says
// who they beat. Left-aligned and vertically centred, because a centred block
// of type reads as a certificate and this is still a phone screen someone holds
// up to show the room.
//
// The dimming inverts here. A bracket row dims the losing NAME; this frame dims
// the losing NUMBER — the names on screen are the winners', so the only thing
// left to rank is the pair of numerals.
//
// Nothing on this frame edits the result. Correcting a final goes back through
// the bracket row.

import type { ReactNode } from "react";
import {
  Body,
  Eyebrow,
  FooterBar,
  PrimaryButton,
  Screen,
  T,
  TertiaryButton,
} from "../../ui/primitives";
import { ScoreBand } from "./ScoreBand";

const INK70 = "rgba(244,237,224,.7)";

export interface ChampionProps {
  courtNumber: number;
  /** Exactly two. Drawn as `{a}`, a hard line break, then `and {b}`. */
  championNames: [string, string];
  /** The final's numbers. The winner's is the champions'. */
  scoreWinner: number;
  scoreLoser: number;
  /** `Ade and Ayo` — already joined by the caller. */
  runnerUpTeamName: string;
  /**
   * Another court still playing, for the footer helper and the jump. Null when
   * this is the last court to finish: no false court status is ever printed.
   */
  otherCourtStillPlaying: number | null;
  /** Switches to the other court that is still live. */
  onGoToOtherCourt: () => void;
  /** Back to frame 20, every row complete. */
  onBackToBracket: () => void;
  /**
   * Last court to finish: the session summary takes the primary slot. Passed in
   * as a node because frame 22 draws no label for it — that control's copy
   * belongs to frame 23 in the summary-states slice, and none is invented here.
   */
  sessionSummaryAction?: ReactNode;
}

export const Champion = ({
  courtNumber,
  championNames,
  scoreWinner,
  scoreLoser,
  runnerUpTeamName,
  otherCourtStillPlaying,
  onGoToOtherCourt,
  onBackToBracket,
  sessionSummaryAction,
}: ChampionProps) => (
  <Screen>
    <Body
      style={{
        padding: "34px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        justifyContent: "center",
      }}
    >
      <Eyebrow style={{ font: "800 12px Inter, sans-serif", letterSpacing: ".14em" }}>
        Court {courtNumber} champions
      </Eyebrow>

      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 46,
          lineHeight: 1.05,
          fontWeight: 600,
        }}
      >
        {championNames[0]}
        <br />
        and {championNames[1]}
      </div>

      <ScoreBand
        scoreA={scoreWinner}
        scoreB={scoreLoser}
        size={104}
        cellPadding={14}
        dimSide="B"
        radius={4}
      />

      <div style={{ font: "400 17px/1.45 Inter, sans-serif", color: INK70 }}>
        Beat {runnerUpTeamName} in the final.
      </div>
    </Body>

    <FooterBar
      helper={
        otherCourtStillPlaying == null
          ? undefined
          : `Court ${otherCourtStillPlaying} is still playing its final.`
      }
    >
      {otherCourtStillPlaying != null ? (
        <PrimaryButton onClick={onGoToOtherCourt}>
          Go to Court {otherCourtStillPlaying}
        </PrimaryButton>
      ) : (
        // FLAG: with every court done there is no truthful court jump, and the
        // session-summary control that replaces it has no label on this frame.
        // The slot renders whatever the caller supplies, or nothing.
        sessionSummaryAction ?? null
      )}

      <TertiaryButton
        onClick={onBackToBracket}
        style={{
          minHeight: 50,
          textDecoration: "none",
          font: "600 17px Inter, sans-serif",
        }}
      >
        Back to bracket
      </TertiaryButton>
    </FooterBar>
  </Screen>
);

export default Champion;
