// Frame 05 — Which night. Step 1 of 4.
//
// One decision: which night this is. A night is always selected, so the action
// is always live. Selecting a night is what tells step 2 which roster to
// pre-fill, which is exactly what the sub line promises.

import { Body, FooterBar, PrimaryButton, Screen, T } from "../../ui/primitives";
import { H1, StepCounter, Sub, TopBar } from "./shell";

export interface NightOption {
  /** "Wednesday". Used verbatim in the footer sentence and in frame 09's title. */
  dayName: string;
  /** The night the wizard opens on. */
  isDefault: boolean;
}

export interface WhichNightProps {
  /** The nights the club runs. v2 draws exactly two. */
  nights: NightOption[];
  /** dayName of the selected night. One is always selected. */
  selected: string;
  /** Selecting re-fetches the roster frame 06 pre-fills. */
  onSelect: (dayName: string) => void;
  /** Back out of step 1 returns to Home. */
  onBack: () => void;
  onNext: () => void;
}

// FLAG: no loading variant is drawn for a fetched night list. Nothing rendered.

export const WhichNight = ({ nights, selected, onSelect, onBack, onNext }: WhichNightProps) => (
  <Screen>
    <TopBar onBack={onBack} right={<StepCounter step={1} />} />

    <Body style={{ padding: "22px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      <H1>Which night is this?</H1>
      <Sub>The night decides which roster pre-fills.</Sub>

      <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
        {nights.map((night) => {
          const on = night.dayName === selected;
          return (
            <button
              key={night.dayName}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(night.dayName)}
              style={{
                width: "100%", boxSizing: "border-box", textAlign: "left", cursor: "pointer",
                border: on ? `2px solid ${T.ink}` : `1px solid ${T.line}`,
                borderRadius: T.radius, background: "transparent", color: T.ink,
                padding: "16px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <span style={{ font: "700 19px Inter, sans-serif" }}>{night.dayName}</span>
              <span style={{
                width: 22, height: 22, borderRadius: 999, boxSizing: "border-box",
                background: on ? T.lime : "transparent",
                border: on ? `2px solid ${T.ink}` : `2px solid ${T.lineDot}`,
              }} />
            </button>
          );
        })}
      </div>
    </Body>

    <FooterBar helper={`${selected} selected.`}>
      <PrimaryButton onClick={onNext}>Next: who is here</PrimaryButton>
    </FooterBar>
  </Screen>
);
