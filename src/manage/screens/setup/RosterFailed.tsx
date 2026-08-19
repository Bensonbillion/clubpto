// Frame 06, error variant — the night's bookings did not load.
//
// Drawn only in v1 (frame 25b), and it is a setup-time error, so it belongs to
// this slice. It is the reason the wizard has to stay completable with zero
// backend roster: the second action walks straight into walk-in entry and the
// night runs on typed names alone.
//
// Two actions, and the retry is the filled one — the recoverable path is the
// easy tap here, unlike the destructive sheets where the weighting inverts.

import { Body, FooterBar, PrimaryButton, Screen, SecondaryButton, T } from "../../ui/primitives";
import { StepCounter, TopBar } from "./shell";

export interface RosterFailedProps {
  /** Refetch the roster for the selected night. */
  onRetry: () => void;
  /** Skip the list and start adding people by name. */
  onAddByName: () => void;
  /** Back returns to frame 05. */
  onBack: () => void;
}

export const RosterFailed = ({ onRetry, onAddByName, onBack }: RosterFailedProps) => (
  <Screen>
    {/*
      v1 draws this frame abbreviated, with no top bar at all. It is still
      step 2 of the wizard and Back still has to work, so the shared bar
      stays. No copy is invented: both strings are frame 06's own.
    */}
    <TopBar onBack={onBack} right={<StepCounter step={2} />} />

    <Body style={{
      padding: "0 24px", display: "flex", flexDirection: "column",
      justifyContent: "center", gap: 10,
    }}>
      <p style={{ font: "800 20px Inter, sans-serif", margin: 0 }}>
        Tonight's bookings did not load.
      </p>
      <p style={{ font: "400 15px/1.5 Inter, sans-serif", color: T.ink60, margin: 0 }}>
        You can still run the night. Add everyone by name, or try the list again.
      </p>
    </Body>

    {/* FLAG: no running status sentence is drawn on this variant. Omitted. */}
    <FooterBar>
      <PrimaryButton onClick={onRetry}>Try the list again</PrimaryButton>
      <SecondaryButton onClick={onAddByName}>Add players by name</SecondaryButton>
    </FooterBar>
  </Screen>
);

export default RosterFailed;
