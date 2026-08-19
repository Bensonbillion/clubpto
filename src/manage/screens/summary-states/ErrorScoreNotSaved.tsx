// Frame 25a — Error, score did not save (v2 `1aa`).
//
// v2 reverses v1's model. The write is NOT lost: the score is held on device,
// the match card already shows it, scoring continues offline, and the queue
// drains itself when signal returns. `Try again now` is a manual flush, not the
// only recovery path. Build v2's behaviour.

import type { PendingWrite } from "../../types";
import { Body, Card, Eyebrow, FooterBar, Num, PrimaryButton, Screen, T } from "../../ui/primitives";
import { pad2 } from "./format";

export interface ErrorScoreNotSavedProps {
  /** The court the manager is standing on, shown top right. */
  courtNumber: number;
  round: number;
  roundsTotal: number;
  /** Oldest first. This screen must not appear when the queue is empty. */
  pendingWrites: PendingWrite[];
  /** Force a flush. On success the caller dismisses back to the court view. */
  onRetry: () => void;
}

export const ErrorScoreNotSaved = ({
  courtNumber,
  round,
  roundsTotal,
  pendingWrites,
  onRetry,
}: ErrorScoreNotSavedProps) => (
  <Screen>
    <div style={{
      padding: "14px 18px", borderBottom: `1px solid ${T.lineSoft}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{
        font: "700 14px Inter, sans-serif", letterSpacing: ".08em",
        textTransform: "uppercase", color: T.ink45,
      }}>
        Round <Num size={20}>{round}</Num> of <Num size={20}>{roundsTotal}</Num>
      </div>
      <div style={{ font: "700 17px Inter, sans-serif" }}>{`Court ${courtNumber}`}</div>
    </div>

    <Body style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* FLAG: a non-network save failure (the server rejects the write) is not
          drawn in either version. This copy names offline explicitly and cannot
          be reused for it. */}
      <Card tone="danger" style={{ padding: 16, gap: 10 }}>
        <div style={{ font: "700 20px/1.3 Inter, sans-serif", color: T.redInk }}>
          The score did not save. This phone is offline.
        </div>
        <div style={{ font: "400 16px/1.45 Inter, sans-serif" }}>
          It is held on this phone and goes up as soon as there is signal. Keep scoring.
        </div>
      </Card>

      <Card>
        <Eyebrow>Waiting to go up</Eyebrow>
        {pendingWrites.map((w, i) => (
          <div key={`${w.courtNumber}-${w.matchIndex}-${i}`} style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
          }}>
            <span style={{ font: "600 16px Inter, sans-serif" }}>
              {`Court ${w.courtNumber}, match ${w.matchIndex}`}
            </span>
            <Num size={24}>{`${pad2(w.scoreA)} ${pad2(w.scoreB)}`}</Num>
          </div>
        ))}
      </Card>

      <div style={{ font: "400 15px/1.45 Inter, sans-serif", color: T.ink60, marginTop: "auto" }}>
        If the phone dies before signal returns, use Copy for WhatsApp at any point to get tonight out in plain text.
      </div>
    </Body>

    {/* FLAG: retry success has no drawn confirmation, and retry failure has no
        approved secondary error string. The screen simply stays put. */}
    <FooterBar helper={<><Num size={22}>{pendingWrites.length}</Num> results are queued.</>}>
      <PrimaryButton onClick={onRetry}>Try again now</PrimaryButton>
    </FooterBar>
  </Screen>
);
