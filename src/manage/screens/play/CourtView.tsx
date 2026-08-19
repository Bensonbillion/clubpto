// Frame 10, Court view.
//
// The home screen of the night, on screen more than any other frame. The
// footer holds no button: the taps are the pair cards themselves and the
// arrows above them, so the bar is one sentence saying what the screen is for.

import { Body, FooterBar, Screen, TabBar, type Tab } from "../../ui/primitives";
import { CourtHeader } from "./CourtHeader";
import { MatchCard } from "./MatchCard";
import { MatchNav } from "./MatchNav";
import { WaitingBlock } from "./WaitingBlock";
import type { CourtChip, PairSide, WaitingPlayer } from "./model";

export interface CourtViewProps {
  /** Every court, as header chips. The one carrying a dot owes a score. */
  courts: CourtChip[];
  activeCourtNumber: number;
  onSelectCourt: (courtNumber: number) => void;
  /** The ellipsis chip. Opens the night menu, frame 25b. */
  onOpenNightMenu: () => void;
  /** Position in this court's schedule, which is not the round. */
  matchNumber: number;
  matchesTotal: number;
  round: number;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
  sideA: PairSide;
  sideB: PairSide;
  waiting: WaitingPlayer[];
  /** Opens frame 12 with that side's score box focused. */
  onScore: (side: "A" | "B") => void;
  /** Opens frame 11 off the match line. See MatchNav for why it hangs there. */
  onWhyThisFour?: () => void;
  activeTab?: Tab;
  onTabChange: (tab: Tab) => void;
}

export const CourtView = ({
  courts,
  activeCourtNumber,
  onSelectCourt,
  onOpenNightMenu,
  matchNumber,
  matchesTotal,
  round,
  onPreviousMatch,
  onNextMatch,
  sideA,
  sideB,
  waiting,
  onScore,
  onWhyThisFour,
  activeTab = "match",
  onTabChange,
}: CourtViewProps) => (
  <Screen>
    <CourtHeader
      courts={courts}
      activeCourtNumber={activeCourtNumber}
      onSelectCourt={onSelectCourt}
      onOpenNightMenu={onOpenNightMenu}
    />

    <MatchNav
      matchNumber={matchNumber}
      matchesTotal={matchesTotal}
      round={round}
      onPreviousMatch={onPreviousMatch}
      onNextMatch={onNextMatch}
      onExplain={onWhyThisFour}
    />

    {/* The match is centred in whatever is left between header and bench, which
        is what keeps the slat at thumb height on a 390x844 phone. */}
    <Body style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <MatchCard sideA={sideA} sideB={sideB} onScore={onScore} />
    </Body>

    <WaitingBlock waiting={waiting} />

    {/* The frame joins these with an em dash. The house voice does not use one,
        so it is three sentences instead and no word changes. */}
    <FooterBar helper="Arrows move through the schedule. Skip a game and it waits. Enter both scores when it ends.">
      {null}
    </FooterBar>

    <TabBar active={activeTab} onChange={onTabChange} />
  </Screen>
);
