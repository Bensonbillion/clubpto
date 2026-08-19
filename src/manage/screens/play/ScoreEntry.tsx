// Frame 11 — Score entry, the second of the two taps.
//
// A bottom sheet over a frozen, cream-washed court view. One tap on a digit
// commits the whole result: the winner takes the session's points per game,
// the loser takes the tapped digit. No confirm step, no save button, and
// nothing may block this tap — a failed write is queued locally (frame 26),
// the sheet still closes and the next match is still drawn.

import { useState } from "react";
import { Body, Card, Num, Screen, Sheet, T } from "../../ui/primitives";
import { RoundHeader } from "./RoundHeader";

export interface ScoreEntryProps {
  round: number;
  totalRounds: number;
  courtNumber: number;
  winnerPairLabel: string;
  /** The title interpolates the LOSING pair. */
  loserPairLabel: string;
  /** Session setting. Sizes the More expansion and supplies the winner's score. */
  pointsPerGame: number;
  /** One tap records it. The caller writes winner = pointsPerGame, loser = this. */
  onRecord: (loserScore: number) => void;
  /**
   * FLAG: open question. Neither wireframe pass draws a Cancel button or
   * specifies scrim-tap dismissal, so the caller decides. Defaults to a no-op,
   * which keeps the sheet undismissable until that call is made.
   */
  onDismiss?: () => void;
}

const KEY_STYLE = {
  height: 66,
  border: `1px solid ${T.line}`,
  borderRadius: T.radius,
  background: "transparent",
  color: T.ink,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
} as const;

export const ScoreEntry = ({
  round,
  totalRounds,
  courtNumber,
  winnerPairLabel,
  loserPairLabel,
  pointsPerGame,
  onRecord,
  onDismiss,
}: ScoreEntryProps) => {
  // FLAG: the expanded pad is not drawn in v2. Inferred from v1's full grid:
  // More swaps the 8 keys for the whole 0…pointsPerGame range, same 4 columns.
  const [expanded, setExpanded] = useState(false);
  const keys = expanded
    ? Array.from({ length: Math.max(pointsPerGame, 0) + 1 }, (_, i) => i)
    : [0, 1, 2, 3, 4, 5, 6];

  return (
    <Screen>
      <RoundHeader round={round} totalRounds={totalRounds} courtNumber={courtNumber} dimmed />

      <Body
        style={{
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            border: `2px solid ${T.ink}`,
            borderRadius: T.radius,
            background: T.lime,
            color: T.limeInk,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ font: "700 22px Inter, sans-serif" }}>{winnerPairLabel}</span>
            <span
              style={{
                font: "800 13px Inter, sans-serif",
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              Winner
            </span>
          </div>
        </div>

        <Card style={{ padding: "14px 18px", opacity: 0.4 }}>
          <span style={{ font: "700 22px Inter, sans-serif" }}>{loserPairLabel}</span>
        </Card>
      </Body>

      {/* The sheet brings its own cream wash — the frame lightens behind it. */}
      {/* FLAG: drag-to-dismiss on the grab handle is described but not drawn. */}
      <Sheet onDismiss={onDismiss ?? (() => {})}>
        <p style={{ font: "700 20px Inter, sans-serif", margin: 0 }}>
          How many did {loserPairLabel} get?
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {keys.map((value) => (
            <button key={value} type="button" onClick={() => onRecord(value)} style={KEY_STYLE}>
              <Num size={38}>{value}</Num>
            </button>
          ))}
          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{
                ...KEY_STYLE,
                color: T.ink55,
                font: "700 14px Inter, sans-serif",
              }}
            >
              More
            </button>
          )}
        </div>

        <p style={{ font: "400 15px/1.4 Inter, sans-serif", color: T.ink60, margin: 0 }}>
          One tap records it and draws the next match.
        </p>
      </Sheet>
    </Screen>
  );
};
