// Frame 31, Courts available. A count, not an assignment.
//
// One draw feeds every court and each tie goes to whichever court is free,
// so nobody is placed anywhere and there is no divisibility math in this
// branch: any headcount works. The Set teammate branch reuses this screen
// when it lands.

import { Body, FooterBar, PrimaryButton, Screen } from "../../ui/primitives";
import { Chip, SetupHeader, Why } from "../setup/shell";

export interface CourtsFreeProps {
  count: number;
  onCount: (n: number) => void;
  onBack?: () => void;
  onNext: () => void;
}

export const CourtsFree = ({ count, onCount, onBack, onNext }: CourtsFreeProps) => (
  <Screen>
    <SetupHeader title="How many courts are free?" step="Setup · Sunday · Playoff" onBack={onBack} />
    <Why>One draw feeds every court. Each tie goes to whichever court is free.</Why>

    <Body style={{ padding: "18px 22px 8px" }}>
      <div style={{ display: "flex", gap: 10 }}>
        {[1, 2, 3].map((n) => (
          <Chip
            key={n}
            radio
            on={count === n}
            onClick={() => onCount(n)}
            style={{ minHeight: 48, padding: "4px 22px", fontSize: 16 }}
          >{n}</Chip>
        ))}
      </div>
      <Why style={{ padding: 0, marginTop: 16 }}>
        No player assignment here. Ties queue for the next free court in draw
        order.
      </Why>
    </Body>

    <FooterBar helper="No divisibility math in this branch. Any headcount works.">
      <PrimaryButton onClick={onNext}>Next: the draw</PrimaryButton>
    </FooterBar>
  </Screen>
);

export default CourtsFree;
