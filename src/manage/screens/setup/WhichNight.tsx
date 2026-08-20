// Frame 05, Which night. Step 1 of 4.
//
// One decision, and the reason for it is on screen: the name picked here is
// what every later screen and the shared summary calls this night. A night is
// always selected, so the action is always live.

import { Body, FooterBar, PrimaryButton, Screen } from "../../ui/primitives";
import { Chip, SetupHeader, Why } from "./shell";

export interface NightOption {
  /** "Wednesday". Used verbatim in the footer sentence and on frame 09. */
  dayName: string;
  /** The night the wizard opens on. */
  isDefault: boolean;
}

export interface WhichNightProps {
  /** The nights the club runs. The frame draws two. */
  nights: NightOption[];
  /** dayName of the selected night. One is always selected. */
  selected: string;
  /** Selecting is what tells step 2 which booking list to show. */
  onSelect: (dayName: string) => void;
  /** Back out of step 1 returns Home. */
  onBack?: () => void;
  onNext: () => void;
  /**
   * Frame 05's third pill, `Another day`, drawn dashed because it leads
   * somewhere rather than selecting something. Omit the handler and the pill
   * is not drawn: a dead option on the first screen of the night would be
   * worse than two.
   */
  onAnotherDay?: () => void;
}

export const WhichNight = ({
  nights, selected, onSelect, onBack, onNext, onAnotherDay,
}: WhichNightProps) => (
  <Screen>
    <SetupHeader title="Which night is this?" step="1 of 4" onBack={onBack} />
    <Why>The name sits on every screen and on the summary you send around.</Why>

    <Body style={{ padding: "24px 22px" }}>
      <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {nights.map((night) => (
          <Chip
            key={night.dayName}
            radio
            on={night.dayName === selected}
            onClick={() => onSelect(night.dayName)}
            style={{ minHeight: 56, fontSize: 17 }}
          >{night.dayName}</Chip>
        ))}

        {onAnotherDay != null && (
          <Chip dashed onClick={onAnotherDay} style={{ minHeight: 56, fontSize: 17 }}>
            Another day
          </Chip>
        )}
      </div>
    </Body>

    <FooterBar helper={`${selected} it is.`}>
      <PrimaryButton onClick={onNext}>Next: who is here</PrimaryButton>
    </FooterBar>
  </Screen>
);

export default WhichNight;
