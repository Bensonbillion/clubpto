// Frame 35, Games per pair. The target step in the teams shape.
//
// Frame 08's arithmetic, stated the same way: every match is two pairs, so
// the pairs times the target has to be even, and an option that does not
// divide dims and says why in one line, so the arithmetic is on screen
// rather than hidden behind a grey row. A short band around the
// preselected four, as frame 35 draws it, not every count to eight.
// Least-played-first runs over pairs, and opponents vary before any
// rematch.

import { Body, FooterBar, PrimaryButton, Screen, T } from "../../ui/primitives";
import { SetupHeader, Why } from "../setup/shell";

export interface GamesPerPairOption {
  target: number;
  /** Whole matches, or null when this target does not divide the pairs. */
  matches: number | null;
  preselected?: boolean;
}

export interface GamesPerPairProps {
  pairCount: number;
  options: GamesPerPairOption[];
  selected: number | null;
  onSelect: (target: number) => void;
  onBack?: () => void;
  /** Absent until a valid target is chosen. */
  onStart?: () => void;
}

export const GamesPerPair = ({
  pairCount, options, selected, onSelect, onBack, onStart,
}: GamesPerPairProps) => (
  <Screen>
    <SetupHeader title="How many games per pair?" step="Setup · Sunday · Set teammate" onBack={onBack} />
    <Why>Every match is two pairs, so the target has to divide the pairs.</Why>

    <Body style={{ padding: "16px 22px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((o) => {
        const valid = o.matches != null;
        const on = selected === o.target;
        return (
          <button
            key={o.target}
            type="button"
            disabled={!valid}
            onClick={valid ? () => onSelect(o.target) : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 14, width: "100%",
              boxSizing: "border-box", padding: "13px 16px", textAlign: "left",
              border: `1.5px solid ${on ? T.acc : T.line}`, borderRadius: T.radiusPanel,
              background: on ? T.raised : "transparent", color: "inherit",
              cursor: valid ? "pointer" : "default", opacity: valid ? 1 : 0.6,
            }}
          >
            <span style={{ fontFamily: T.fontHead, fontSize: 24, minWidth: 30, fontVariantNumeric: "tabular-nums" }}>
              {o.target}
            </span>
            <span style={{ font: `400 14.5px/1.5 ${T.fontBody}`, color: T.mut }}>
              {valid
                ? `${o.preselected ? "Preselected. " : ""}${pairCount} pairs, ${o.matches} matches.`
                : `${pairCount} pairs needs an even total.`}
            </span>
          </button>
        );
      })}
      <p style={{ font: `400 14px/1.5 ${T.fontBody}`, color: T.mut, margin: "8px 2px 0" }}>
        Least-played-first runs over pairs, and opponents vary before any rematch.
      </p>
    </Body>

    <FooterBar helper="Teams stay together all night.">
      <PrimaryButton disabled={onStart == null} onClick={onStart}>Start the night</PrimaryButton>
    </FooterBar>
  </Screen>
);

export default GamesPerPair;
