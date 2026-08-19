// Frame 04 — Home, night in progress (v2 `1e`).
//
// Same shell as frame 03, different weighting: the title drops to 34px because
// it is now data rather than a statement, and the stat row becomes the one bold
// element. No `Live` badge — v1 had one, v2 drops it.

import { Body, Card, Eyebrow, FooterBar, PrimaryButton, Screen, StatLabel, Num, T } from "../../ui/primitives";

/** The court needing attention, and where it is in the night. */
export interface WaitingCourt {
  courtNumber: number;
  round: number;
  roundsTotal: number;
}

/** Live session counts. `left` is matches remaining, not players who went home. */
export interface NightStats {
  /** Players checked in tonight. */
  inTonight: number;
  /** Completed matches. */
  played: number;
  /** Matches remaining. */
  left: number;
}

export interface HomeNightInProgressProps {
  /** `Wednesday` → the title reads `Wednesday night`. */
  dayName: string;
  /**
   * The court waiting on a score. When several qualify, the caller picks the
   * one whose match finished earliest — the helper line is one court wide by
   * design. Null when no court is waiting.
   */
  waiting?: WaitingCourt | null;
  /**
   * Null suppresses the stat row: while loading, and when live state fails to
   * fetch. Never render `00` placeholders or stale numbers in these slots.
   */
  stats?: NightStats | null;
  /** Holds the whole status card and the footer helper. Title paints as soon as `dayName` lands. */
  loading?: boolean;
  /** → frame 10 `Court view`, opened on the waiting court, Match tab active. */
  onResume: () => void;
  /** → frame 05. Must not delete or void the in-progress session's results. */
  onStartDifferentNight: () => void;
}

/** Every stat pads to two characters so the row stays optically even. */
const pad2 = (n: number): string => (n < 10 && n >= 0 ? `0${n}` : String(n));

export const HomeNightInProgress = ({
  dayName,
  waiting,
  stats,
  loading,
  onResume,
  onStartDifferentNight,
}: HomeNightInProgressProps) => {
  const showCard = !loading && (waiting != null || stats != null);

  return (
    <Screen>
      <Body style={{
        display: "flex", flexDirection: "column", gap: 16,
        padding: "34px 20px", boxSizing: "border-box",
      }}>
        <Eyebrow>Court manager</Eyebrow>

        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 600,
          lineHeight: 1.1, margin: 0,
        }}>{dayName} night</h1>

        {showCard && (
          // Not tappable. Frame geometry: .18 border, 18 pad, 10 gap.
          <Card style={{ border: `1px solid ${T.line}`, padding: 18, gap: 10 }}>
            {/* FLAG: with no court waiting, the headline has no defined copy. Nothing is drawn. */}
            {waiting != null && (
              <p style={{ font: "600 17px Inter, sans-serif", margin: 0 }}>
                Court {waiting.courtNumber}, round {waiting.round} of {waiting.roundsTotal}.
              </p>
            )}

            {stats != null && (
              <div style={{ display: "flex", gap: 22 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <StatLabel>In tonight</StatLabel>
                  <Num size={34}>{pad2(stats.inTonight)}</Num>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <StatLabel>Played</StatLabel>
                  <Num size={34}>{pad2(stats.played)}</Num>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <StatLabel>Left</StatLabel>
                  <Num size={34}>{pad2(stats.left)}</Num>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Plain text, no chrome — deliberately quieter than frame 03's card,
            because it is destructive-adjacent. */}
        <button
          type="button"
          onClick={onStartDifferentNight}
          style={{
            marginTop: "auto", display: "flex", flexDirection: "column", gap: 10,
            border: "none", background: "transparent", padding: 0, width: "100%",
            textAlign: "left", alignItems: "flex-start", cursor: "pointer",
          }}
        >
          <span style={{ font: "600 16px Inter, sans-serif", color: T.ink60 }}>
            Start a different night
          </span>
          <span style={{ font: "400 14px Inter, sans-serif", color: T.ink50 }}>
            Tonight's results stay saved.
          </span>
        </button>
      </Body>

      {/* FLAG: no approved copy exists for the "no court is waiting" helper, so
          nothing is rendered there. `Resume the night` stays live regardless —
          the operator needs the door open even when the summary fails. */}
      <FooterBar
        helper={!loading && waiting != null ? `Court ${waiting.courtNumber} is waiting on a score.` : undefined}
      >
        <PrimaryButton onClick={onResume}>Resume the night</PrimaryButton>
      </FooterBar>
    </Screen>
  );
};
