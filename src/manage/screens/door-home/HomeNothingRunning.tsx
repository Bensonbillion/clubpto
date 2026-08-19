// Frame 03. Home, nothing running.
//
// Two sentences in the middle of an empty screen, three things in the bar. The
// club's name is the only display type on the frame, which is what makes the
// screen read as a door rather than as a dashboard with nothing in it.
//
// The bar's order is deliberate and is why this screen does not use FooterBar's
// helper slot: the sentence sits UNDER both buttons, because it explains the
// ghost above it rather than the action the screen is asking for.

import { Body, FooterBar, PrimaryButton, Screen, SecondaryButton, T } from "../../ui/primitives";

export interface HomeNothingRunningProps {
  /**
   * Weekday of the most recent session, e.g. `Wednesday`, filling
   * `Copy last Wednesday`. Null when there is no previous session to copy: the
   * ghost and its sentence are then dropped together, since the frame draws no
   * spent state for either.
   */
  lastSessionDayName?: string | null;
  /**
   * The "is a night live, and what was the last one" query is still out. The
   * title and lead paint immediately; the copy action is held back so
   * `Start tonight` can never appear beside a stale night.
   */
  loading?: boolean;
  /** → frame 05 `Which night`, step 1 of four. */
  onStartTonight: () => void;
  /** → the wizard, pre-filled with the last session's day and roster. */
  onCopyLastSession?: () => void;
}

export const HomeNothingRunning = ({
  lastSessionDayName,
  loading,
  onStartTonight,
  onCopyLastSession,
}: HomeNothingRunningProps) => {
  const showCopy = !loading && Boolean(lastSessionDayName);

  return (
    <Screen>
      <Body style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "0 26px", gap: 10, boxSizing: "border-box",
      }}>
        <p style={{
          fontFamily: T.fontHead, fontWeight: 400, fontSize: 42, lineHeight: 1.05, margin: 0,
        }}>Club PTO</p>

        <p style={{
          font: `400 16px/1.55 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty",
        }}>
          No night is running. Start one and the app walks you through it.
        </p>
      </Body>

      <FooterBar>
        <PrimaryButton onClick={onStartTonight}>Start tonight</PrimaryButton>

        {showCopy && (
          <>
            <SecondaryButton onClick={onCopyLastSession}>
              Copy last {lastSessionDayName}
            </SecondaryButton>
            <p style={{
              font: `400 14.5px/1.45 ${T.fontBody}`, color: T.mut, margin: 0,
              textAlign: "center", textWrap: "pretty",
            }}>Same people, new night.</p>
          </>
        )}
      </FooterBar>
    </Screen>
  );
};
