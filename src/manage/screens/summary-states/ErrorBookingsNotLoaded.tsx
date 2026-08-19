// Frame 25b — Error, bookings did not load. v1 only; v2 dropped it.
// Every word is v1's, restyled into v2's visual language: lime primary,
// 2px #F4EDE0 secondary.
//
// The point of the frame is that the fallback is genuinely offered, not buried.
// The night is fully runnable from `Add players by name`.

import { Body, FooterBar, PrimaryButton, Screen, SecondaryButton, T } from "../../ui/primitives";

export interface ErrorBookingsNotLoadedProps {
  /** Refetch tonight's bookings. On success the caller goes to frame 06. */
  onRetry: () => void;
  /** Roster step with an empty list and the search focused; everyone is a walk-in. */
  onAddByName: () => void;
}

export const ErrorBookingsNotLoaded = ({ onRetry, onAddByName }: ErrorBookingsNotLoadedProps) => (
  <Screen>
    {/* FLAG: loading is not drawn, and a fetch that succeeds with zero bookings
        is a different state that is not drawn either. */}
    <Body style={{
      padding: "0 24px", display: "flex", flexDirection: "column",
      justifyContent: "center", gap: 10,
    }}>
      <div style={{ font: "800 20px Inter, sans-serif" }}>
        Tonight's bookings did not load.
      </div>
      <div style={{ font: "400 15px/1.5 Inter, sans-serif", color: T.ink68 }}>
        You can still run the night. Add everyone by name, or try the list again.
      </div>
    </Body>

    <FooterBar>
      <PrimaryButton onClick={onRetry}>Try the list again</PrimaryButton>
      <SecondaryButton onClick={onAddByName}>Add players by name</SecondaryButton>
    </FooterBar>
  </Screen>
);
