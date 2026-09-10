// Frame 10, Court view.
//
// The home screen of the night, on screen more than any other frame. The
// footer holds no button: the taps are the pair cards themselves and the
// arrows above them, so the bar is one sentence saying what the screen is for.

import { Body, Eyebrow, FooterBar, Screen, T, TabBar, type Tab } from "../../ui/primitives";
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
  /**
   * The merge with another phone, when it set something of this phone's
   * aside. Found on the two-phone walk: the pairing screens showed it and
   * this one, the screen the night lives on, did not.
   */
  note?: string | null;
  onDismissNote?: () => void;
  /** Position in this court's schedule, which is not the round. */
  matchNumber: number;
  matchesTotal: number;
  round: number;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
  /** See MatchNav. Set by the shell while the pager is off the live match. */
  pagerFlag?: string;
  sideA: PairSide;
  sideB: PairSide;
  waiting: WaitingPlayer[];
  /**
   * The next games as the card projects them, in order. Frame 12b keeps the
   * whole card one tap away on the schedule; this is the operator's own
   * request for the next four or five under the live match, because people
   * who have not turned up are decided here, not on a list.
   */
  upNext?: { slot: number; a: string; b: string }[];
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
  note,
  onDismissNote,
  matchNumber,
  matchesTotal,
  round,
  onPreviousMatch,
  onNextMatch,
  pagerFlag,
  sideA,
  sideB,
  waiting,
  upNext = [],
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
      note={note}
      onDismissNote={onDismissNote}
    />

    <MatchNav
      matchNumber={matchNumber}
      matchesTotal={matchesTotal}
      round={round}
      onPreviousMatch={onPreviousMatch}
      onNextMatch={onNextMatch}
      flag={pagerFlag}
      onExplain={onWhyThisFour}
    />

    {/* The match is centred in whatever is left between header and bench, which
        is what keeps the slat at thumb height on a 390x844 phone. */}
    <Body style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <MatchCard sideA={sideA} sideB={sideB} onScore={onScore} />
    </Body>

    {upNext.length > 0 && (
      <div style={{ padding: "0 22px 14px" }}>
        <Eyebrow style={{ color: T.mut, margin: "0 0 8px" }}>Up next</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {upNext.map((g) => (
            <div key={g.slot} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontFamily: T.fontHead, fontSize: 14, minWidth: 16, color: T.soft, fontVariantNumeric: "tabular-nums" }}>{g.slot}</span>
              <span style={{ font: `400 14.5px/1.4 ${T.fontBody}`, color: T.mut }}>
                {g.a} <span style={{ color: T.soft }}>v</span> {g.b}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
    <WaitingBlock waiting={waiting} />

    {/* The frame joins these with an em dash. The house voice does not use one,
        so it is three sentences instead and no word changes. */}
    <FooterBar helper="Arrows move through the schedule. Skip a game and it waits. Enter both scores when it ends.">
      {null}
    </FooterBar>

    <TabBar active={activeTab} onChange={onTabChange} />
  </Screen>
);
