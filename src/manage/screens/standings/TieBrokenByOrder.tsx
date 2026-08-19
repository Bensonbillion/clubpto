// Frame 18 — Tie broken by order.
//
// A bottom sheet over the live standings screen. It explains; it decides
// nothing. There is no accept, no override, no flip — the copy is explicit
// that nothing is up for decision, and `Got it` only dismisses.
//
// Compose it over frame 17:
//   <StandingsTab … onOpenTie={setTie} />
//   {tie && <TieBrokenByOrder higher={…} lower={…} onDismiss={() => setTie(null)} />}
// The Sheet primitive supplies the scrim, the grab handle and the dismiss.

import { Card, Num, PrimaryButton, Sheet, T } from "../../ui/primitives";

/** The frame's card border for the player placed lower. */
const LOWER_BORDER = "rgba(244,237,224,.2)";

export interface TieSide {
  displayName: string;
  points: number;
  /** Signed score difference. Level with the other side, by definition. */
  pointDifference: number;
  /** A real match number from the night's log. Never a timestamp. */
  reachedAtMatchNumber: number;
}

export interface TieBrokenByOrderProps {
  /** Placed higher: got there first. */
  higher: TieSide;
  /** Placed lower: reached the same total later. */
  lower: TieSide;
  onDismiss: () => void;
}

// FLAG: three or more players level on both keys is not drawn. Two cards is
// what the layout supports, and no copy exists for a third.
// FLAG: no empty, loading or error state. The sheet only ever opens on a tie
// that already exists in loaded standings data.

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export const TieBrokenByOrder = ({ higher, lower, onDismiss }: TieBrokenByOrderProps) => (
  <Sheet onDismiss={onDismiss}>
    <div style={{ font: "700 22px Inter, sans-serif" }}>Level on points</div>

    <div style={{ font: "400 16px/1.45 Inter, sans-serif" }}>
      {higher.displayName} and {lower.displayName} are level on points and on score
      difference. The higher place goes to whoever got there first.
    </div>

    <div style={{ display: "flex", gap: 10 }}>
      <Card style={{ flex: 1, padding: 16, gap: 4, border: `2px solid ${T.lime}` }}>
        <span style={{ font: "700 19px Inter, sans-serif" }}>{higher.displayName}</span>
        <Num size={26}>{higher.points} pts, {signed(higher.pointDifference)}</Num>
        <span style={{ font: "600 14px Inter, sans-serif", color: T.lime }}>
          Got there in match {higher.reachedAtMatchNumber}
        </span>
      </Card>

      <Card style={{ flex: 1, padding: 16, gap: 4, border: `2px solid ${LOWER_BORDER}` }}>
        <span style={{ font: "700 19px Inter, sans-serif", color: T.ink60 }}>
          {lower.displayName}
        </span>
        <Num size={26}>{lower.points} pts, {signed(lower.pointDifference)}</Num>
        <span style={{ font: "600 14px Inter, sans-serif", color: T.ink55 }}>
          Match {lower.reachedAtMatchNumber}
        </span>
      </Card>
    </div>

    <div style={{ font: "400 15px/1.4 Inter, sans-serif", color: T.ink60 }}>
      {'No coin is tossed. The standings row says "Got there first" so the room can see why.'}
    </div>

    <PrimaryButton onClick={onDismiss}>Got it</PrimaryButton>
  </Sheet>
);

export default TieBrokenByOrder;
