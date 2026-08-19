// Frame 10 — Court view.
//
// The home screen of the night, on screen more than any other frame. First of
// the two taps: pick the winning side, which opens frame 11.

import {
  Body,
  FooterBar,
  Screen,
  SecondaryButton,
  T,
  TabBar,
  type Tab,
} from "../../ui/primitives";
import { MatchCard } from "./MatchCard";
import { RoundHeader } from "./RoundHeader";
import { WaitingBlock } from "./WaitingBlock";
import type { PairSide, WaitingPlayer } from "./model";

export interface CourtViewProps {
  round: number;
  totalRounds: number;
  courtNumber: number;
  sideA: PairSide;
  sideB: PairSide;
  waiting: WaitingPlayer[];
  /** Opens frame 11 with the other side as the score subject. */
  onPickWinner: (side: "A" | "B") => void;
  activeTab?: Tab;
  onTabChange: (tab: Tab) => void;
}

export const CourtView = ({
  round,
  totalRounds,
  courtNumber,
  sideA,
  sideB,
  waiting,
  onPickWinner,
  activeTab = "match",
  onTabChange,
}: CourtViewProps) => (
  <Screen>
    <RoundHeader round={round} totalRounds={totalRounds} courtNumber={courtNumber} />

    <Body
      style={{
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflow: "hidden",
      }}
    >
      <MatchCard sideA={sideA} sideB={sideB} />
      <WaitingBlock waiting={waiting} showOnNextLine />
    </Body>

    <FooterBar
      helper={
        <span style={{ font: "600 16px/1.35 Inter, sans-serif", color: T.ink }}>
          Tap the winning side to score.
        </span>
      }
    >
      <div style={{ display: "flex", gap: 10 }}>
        <SecondaryButton style={{ flex: 1, width: "auto" }} onClick={() => onPickWinner("A")}>
          {sideA.pairLabel}
        </SecondaryButton>
        <SecondaryButton style={{ flex: 1, width: "auto" }} onClick={() => onPickWinner("B")}>
          {sideB.pairLabel}
        </SecondaryButton>
      </div>
    </FooterBar>

    <TabBar active={activeTab} onChange={onTabChange} />
  </Screen>
);
