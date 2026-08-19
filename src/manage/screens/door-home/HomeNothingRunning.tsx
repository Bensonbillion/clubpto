// Frame 03 — Home, nothing running (v2 `1d`).
//
// Visual weight runs: giant serif title → muted lead → (gap) → outlined card →
// lime button. Exactly two actions on the screen, and only one of them is lime.

import { Body, Card, Eyebrow, FooterBar, PrimaryButton, Screen, T } from "../../ui/primitives";

export interface HomeNothingRunningProps {
  /**
   * Weekday of the most recent session, e.g. `Wednesday`. Fixture data in the
   * wireframe, not a constant. Null when there is no previous session to copy —
   * the card is then hidden outright, since there is no disabled-card treatment.
   */
  lastSessionDayName?: string | null;
  /**
   * The "is a night live, what was the last one" query is still out. Title and
   * lead paint immediately; the card and footer helper are held back so
   * `Start tonight` never follows `Resume the night` on screen.
   */
  loading?: boolean;
  /** → frame 05 `Which night`, step 1 of the four-step setup. */
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
  const showCopyCard = !loading && Boolean(lastSessionDayName);

  return (
    <Screen>
      <Body style={{
        display: "flex", flexDirection: "column", gap: 16,
        padding: "34px 20px", boxSizing: "border-box",
      }}>
        <Eyebrow>Court manager</Eyebrow>

        {/* The one bold element: 40px, two lines, breaking exactly here. */}
        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 600,
          lineHeight: 1.05, margin: 0,
        }}>Nothing<br />running yet</h1>

        <p style={{
          fontSize: 16, lineHeight: 1.45, color: T.ink68, maxWidth: 300,
          textWrap: "pretty", margin: 0,
        }}>
          Pick the night, tick off who is here, and Manage builds every match for you.
        </p>

        {showCopyCard && (
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              type="button"
              onClick={onCopyLastSession}
              style={{
                border: "none", background: "transparent", padding: 0, margin: 0,
                width: "100%", textAlign: "left", color: "inherit", cursor: "pointer",
                display: "block",
              }}
            >
              {/* A quiet card, not a lime button. Frame geometry: .18 border, 16/18 pad, 4 gap. */}
              <Card style={{ border: `1px solid ${T.line}`, padding: "16px 18px", gap: 4 }}>
                <span style={{ font: "700 18px Inter, sans-serif" }}>
                  Copy last {lastSessionDayName}
                </span>
                <span style={{ font: "400 15px Inter, sans-serif", color: T.ink60 }}>
                  Same people, new night.
                </span>
              </Card>
            </button>
          </div>
        )}
      </Body>

      <FooterBar helper={loading ? undefined : "Five steps to a running night."}>
        <PrimaryButton onClick={onStartTonight}>Start tonight</PrimaryButton>
      </FooterBar>
    </Screen>
  );
};
