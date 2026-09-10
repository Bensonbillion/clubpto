// Frame 10, Court view.
//
// The home screen of the night, on screen more than any other frame. The
// footer holds no button: the taps are the pair cards themselves and the
// arrows above them, so the bar is one sentence saying what the screen is for.

import { Body, Eyebrow, FooterBar, PrimaryButton, Screen, T, TabBar, TertiaryButton, type Tab } from "../../ui/primitives";
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
  /**
   * Games stepped past and not yet played. They wait in the list, and the
   * card says so, because a skipped game that is out of sight is a game
   * that gets forgotten until the standings look wrong.
   */
  skipped?: { slot: number; a: string; b: string }[];
  /** Opens frame 12 with that side's score box focused. */
  onScore: (side: "A" | "B") => void;
  /**
   * On a projected row: put THIS game on court now, and the game that was
   * on court waits in the list. Found on a Wednesday: the operator paged to
   * the next game because somebody was not there, and there was nothing to
   * tap. Absent on the live match and on a result.
   */
  onPlayThisNow?: () => void;
  /**
   * On the live match: step past it. It waits in the list and the next game
   * comes on. Absent while paged, and absent when nothing else can come on.
   */
  onSkip?: () => void;
  /**
   * On the live match: swap somebody who is not here for the next in the
   * queue, or draw the four again. Opens the change sheet. Absent while paged.
   */
  onChangeMatch?: () => void;
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
  skipped = [],
  onScore,
  onPlayThisNow,
  onSkip,
  onChangeMatch,
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
    {/* The match is centred in whatever is left between header and bench; the
        controls that act on it live in the footer's slot, so the Body never
        grows and the tab bar stays where a thumb expects it. */}
    <Body style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <MatchCard sideA={sideA} sideB={sideB} onScore={onScore} />
    </Body>

    {skipped.length > 0 && (
      <div style={{ padding: "0 22px 14px" }}>
        <Eyebrow style={{ color: T.warm, margin: "0 0 8px" }}>Skipped, still to play</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {skipped.map((g) => (
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
        so it is three sentences instead and no word changes. On a projected
        row the slot holds Play this game now; on the live match it holds the
        two quiet controls that act on the game. */}
    <FooterBar helper={onPlayThisNow
      ? "The game on court waits in the list."
      : "Arrows move through the schedule. Skip a game and it waits. Enter both scores when it ends."}>
      {onPlayThisNow
        ? <PrimaryButton onClick={onPlayThisNow}>Play this game now</PrimaryButton>
        : (onSkip || onChangeMatch)
          ? (
            <div style={{ display: "flex", justifyContent: "center", gap: 18 }}>
              {onChangeMatch && <TertiaryButton onClick={onChangeMatch}>Change this game</TertiaryButton>}
              {onSkip && <TertiaryButton onClick={onSkip}>Skip this game</TertiaryButton>}
            </div>
          )
          : null}
    </FooterBar>

    <TabBar active={activeTab} onChange={onTabChange} />
  </Screen>
);
