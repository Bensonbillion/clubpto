// Frame 34, the Sunday hub. Three shapes, one door each.
//
// Appears only when the night is Sunday, immediately after the day is
// chosen. The roster is built inside the door you choose, so this screen
// holds nothing but the choice, and switching doors later keeps the roster.
//
// The wireframe draws three doors. Two are built; the Set teammate branch
// is specified (docs/manage/knockout-spec.md, frames 35 to 37) and lands
// next, and until it exists no card is drawn for it: a door that opens onto
// nothing is worse than no door.

import { Body, Card, FooterBar, Screen, T } from "../../ui/primitives";
import { SetupHeader } from "../setup/shell";

export interface SundayHubProps {
  onRoundRobin: () => void;
  onKnockout: () => void;
  onBack?: () => void;
}

const Door = ({ title, detail, onClick }: {
  title: string; detail: string; onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: "block", width: "100%", padding: 0, border: "none",
      background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer",
    }}
  >
    <Card style={{ gap: 0 }}>
      <p style={{ fontFamily: T.fontHead, fontSize: 18, margin: "0 0 6px" }}>{title}</p>
      <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>
        {detail}
      </p>
    </Card>
  </button>
);

export const SundayHub = ({ onRoundRobin, onKnockout, onBack }: SundayHubProps) => (
  <Screen>
    <SetupHeader title="Sunday" step="Setup" onBack={onBack} />

    <p style={{
      font: `400 15px/1.5 ${T.fontBody}`, color: T.mut,
      padding: "0 22px", margin: "8px 0 0", textWrap: "pretty",
    }}>
      Two shapes tonight. The roster is built inside the door you choose.
    </p>

    <Body style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
      <Door
        title="Round robin"
        detail="Partners rotate every round; ranked as individuals."
        onClick={onRoundRobin}
      />
      <Door
        title="Playoff"
        detail="Pair up and play a straight knockout."
        onClick={onKnockout}
      />
      <p style={{ font: `400 14px/1.5 ${T.fontBody}`, color: T.mut, margin: "4px 2px 0" }}>
        Switching doors keeps the roster.
      </p>
    </Body>

    <FooterBar helper="Pick tonight's shape.">{null}</FooterBar>
  </Screen>
);

export default SundayHub;
