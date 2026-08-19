// Frame 12 — Court switcher.
//
// Not a modal. It is the court view with the persistent court strip in place of
// the round header, plus a footer nudge toward the court that owes a score.
// Switching preserves state on the court you leave, including a half-open
// score sheet — that is the caller's job, not this component's.

import {
  Body,
  FooterBar,
  PrimaryButton,
  Screen,
  T,
  TabBar,
  type Tab,
} from "../../ui/primitives";
import { CourtStrip } from "./CourtStrip";
import { MatchCard } from "./MatchCard";
import { WaitingBlock } from "./WaitingBlock";
import type { CourtSummary, PairSide, WaitingPlayer } from "./model";

export interface CourtSwitcherProps {
  /** Every court, not just the focused one — the strip renders the whole list. */
  courts: CourtSummary[];
  activeCourtNumber: number;
  sideA: PairSide;
  sideB: PairSide;
  waiting: WaitingPlayer[];
  onSelectCourt: (courtNumber: number) => void;
  activeTab?: Tab;
  onTabChange: (tab: Tab) => void;
}

export const CourtSwitcher = ({
  courts,
  activeCourtNumber,
  sideA,
  sideB,
  waiting,
  onSelectCourt,
  activeTab = "match",
  onTabChange,
}: CourtSwitcherProps) => {
  // The first other court with a score due drives both the sentence and the
  // button label. With none, the footer band collapses.
  const due = courts.find((court) => court.scoreDue && court.number !== activeCourtNumber);

  return (
    <Screen>
      <CourtStrip
        courts={courts}
        activeCourtNumber={activeCourtNumber}
        onSelectCourt={onSelectCourt}
      />

      <Body style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <MatchCard sideA={sideA} sideB={sideB} compact slatSize={78} />
        <WaitingBlock waiting={waiting} />
      </Body>

      {due != null && (
        <FooterBar
          helper={
            <span style={{ font: "600 16px Inter, sans-serif", color: T.ink }}>
              Court {due.number} has a score to record.
            </span>
          }
        >
          <PrimaryButton onClick={() => onSelectCourt(due.number)}>
            Go to Court {due.number}
          </PrimaryButton>
        </FooterBar>
      )}

      <TabBar active={activeTab} onChange={onTabChange} />
    </Screen>
  );
};
