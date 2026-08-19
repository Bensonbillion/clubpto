// The persistent two-court strip (frame 12), which replaces the round header.
//
// Shared on purpose: frame 25 in the States group reuses this strip with the
// empty court active and its status reading "Nobody assigned".
//
// Lime status text is the alarm — reserved for a court that needs the ref's
// attention. Only two courts are ever drawn; a 3+ court strip is not designed.

import { T } from "../../ui/primitives";
import type { CourtSummary } from "./model";

export interface CourtStripProps {
  courts: CourtSummary[];
  activeCourtNumber: number;
  onSelectCourt: (courtNumber: number) => void;
}

export const CourtStrip = ({ courts, activeCourtNumber, onSelectCourt }: CourtStripProps) => (
  <div
    style={{
      padding: "14px 18px",
      borderBottom: `1px solid ${T.lineSoft}`,
      display: "flex",
      gap: 10,
    }}
  >
    {courts.map((court) => {
      const active = court.number === activeCourtNumber;
      return (
        <button
          key={court.number}
          type="button"
          onClick={() => { if (!active) onSelectCourt(court.number); }}
          style={{
            flex: 1,
            textAlign: "left",
            boxSizing: "border-box",
            border: active ? `2px solid ${T.ink}` : `1px solid ${T.line}`,
            borderRadius: T.radius,
            background: active ? T.lime : "transparent",
            color: active ? T.limeInk : T.ink,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            cursor: active ? "default" : "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <span style={{ font: "700 16px Inter, sans-serif" }}>Court {court.number}</span>
          {/* A status that has not loaded renders nothing rather than guessing a string. */}
          {court.status != null && (
            <span
              style={{
                font: "600 13px Inter, sans-serif",
                color: !active && court.scoreDue ? T.lime : undefined,
              }}
            >
              {court.status}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
