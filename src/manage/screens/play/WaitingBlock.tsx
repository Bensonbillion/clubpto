// The bench for the focused court, in queue order.
//
// Chips are NOT interactive — no tap affordance is drawn in either wireframe
// pass. Every chip renders at full text opacity: the dimmed chips in the
// wireframe were unresolved placeholder tokens, not a player state.

import { T } from "../../ui/primitives";
import type { WaitingPlayer } from "./model";

export interface WaitingBlockProps {
  /** Display order must equal queue order. */
  waiting: WaitingPlayer[];
  /** Frame 10 carries the derived helper line; frame 12 does not. */
  showOnNextLine?: boolean;
}

export const WaitingBlock = ({ waiting, showOnNextLine }: WaitingBlockProps) => {
  // The only helper sentence the wireframes draw is the all-four case. Any
  // other count has no copy.
  // FLAG: partial-queue wording is not drawn — nothing renders for it.
  const allFourOnNext = waiting.length === 4 && waiting.every((p) => p.isOnNext);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p
        style={{
          font: "800 13px Inter, sans-serif",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: T.ink45,
          margin: 0,
        }}
      >
        Waiting
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {waiting.map((player) => (
          <span
            key={player.playerId}
            style={{
              font: "600 16px Inter, sans-serif",
              border: "1px solid rgba(244,237,224,.2)",
              borderRadius: 999,
              padding: "8px 13px",
            }}
          >
            {player.name}
          </span>
        ))}
      </div>
      {showOnNextLine && allFourOnNext && (
        <p style={{ font: "400 14px Inter, sans-serif", color: T.ink50, margin: 0 }}>
          All four are on next.
        </p>
      )}
    </div>
  );
};
