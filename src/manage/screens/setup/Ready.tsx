// Frame 09 — Ready. The review step.
//
// Read-only on purpose. Nothing in the table is tappable, because the only
// decision left is whether the five lines match the room, and every one of
// them is reachable again through Back with the choices intact.
//
// The footer states that the first matches are already drawn, so the draw has
// to exist before this screen renders. `Start the night` commits a session
// that is already schedulable; it is the only writing action in the wizard.

import { Body, FooterBar, Num, PrimaryButton, Screen, T } from "../../ui/primitives";
import { SETUP, TopBar } from "./shell";

export interface ReadyProps {
  /** "Wednesday". Used verbatim as "<Day> night" in the title. */
  dayName: string;
  /** Ticked players plus walk-ins. */
  playersIn: number;
  courtCount: number;
  /** The step 4 target. */
  matchesEach: number;
  /** playersIn * matchesEach / 4, summed across the courts. */
  matchesInTotal: number;
  /** From config, not hard-coded: the standings screens quote the same number. */
  pointsForAWin: number;
  /** In flight while the session is being written. */
  starting?: boolean;
  /** Back returns to frame 08 with every choice intact. */
  onBack: () => void;
  onStart: () => void;
}

const Row = ({ label, value, last }: { label: string; value: number; last?: boolean }) => (
  <div style={{
    display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "14px 0",
    borderTop: `1px solid ${T.lineSoft}`,
    borderBottom: last ? `1px solid ${T.lineSoft}` : undefined,
  }}>
    <span style={{ font: "400 16px Inter, sans-serif", color: T.ink60 }}>{label}</span>
    {/* Drawn unpadded here, unlike frame 07's court sizes. */}
    <Num size={30}>{value}</Num>
  </div>
);

// FLAG: no commit error is drawn anywhere. On failure the caller keeps the
// user on this screen with the summary intact; nothing is rendered for it.

export const Ready = ({
  dayName, playersIn, courtCount, matchesEach, matchesInTotal, pointsForAWin,
  starting, onBack, onStart,
}: ReadyProps) => (
  <Screen>
    <TopBar onBack={onBack} right="Review" />

    <Body style={{ padding: "22px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{
        font: "600 32px/1.1 'Playfair Display', Georgia, serif", margin: 0,
      }}>{dayName} night</h1>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <Row label="Players in" value={playersIn} />
        <Row label="Courts" value={courtCount} />
        <Row label="Matches each" value={matchesEach} />
        <Row label="Matches in total" value={matchesInTotal} />
        <Row label="Points for a win" value={pointsForAWin} last />
      </div>

      <p style={{
        font: "400 15px/1.45 Inter, sans-serif", color: SETUP.ink65, margin: 0, textWrap: "pretty",
      }}>
        Partners rotate every match. Nobody earns points for sitting out.
      </p>
    </Body>

    <FooterBar helper="First matches are already drawn.">
      {/* FLAG: no in-flight label is drawn, so the button keeps its own copy. */}
      <PrimaryButton disabled={starting} onClick={onStart}>Start the night</PrimaryButton>
    </FooterBar>
  </Screen>
);

export default Ready;
