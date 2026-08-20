// The bench for the focused court, in queue order (frame 10).
//
// The eyebrow says "Waiting, on next" as one phrase, because on an eight
// player court those are the same four people: least-played-first means the
// four watching are the four who go on. The old screen carried a separate
// sentence to say so and the frame folded it into the label instead.
//
// Chips are not interactive. No frame draws a tap on a waiting name.

import { Eyebrow, T } from "../../ui/primitives";
import type { WaitingPlayer } from "./model";

export interface WaitingBlockProps {
  /** Display order must equal queue order. */
  waiting: WaitingPlayer[];
}

export const WaitingBlock = ({ waiting }: WaitingBlockProps) => (
  <div style={{ padding: "0 22px 16px" }}>
    <Eyebrow style={{ color: T.mut, margin: "0 0 10px" }}>Waiting, on next</Eyebrow>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {waiting.map((player) => (
        <span
          key={player.playerId}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 38,
            padding: "6px 16px",
            border: `1.5px solid ${T.lineChip}`,
            borderRadius: T.pill,
            font: `600 14px ${T.fontBody}`,
            color: T.ink,
          }}
        >
          {player.name}
        </span>
      ))}
    </div>
  </div>
);
