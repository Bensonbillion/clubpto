// Frame 13, Both courts, one device.
//
// The chip row in the header already flips courts in one tap, so this sheet is
// not the switch, it is the answer to "what is the other court doing". That is
// the whole of it: which court is mid-match, which is waiting on a score, and
// the round each of them is on.
//
// So the status line is not decoration. A row with an activity always prints
// one, and a court owing a score also wears the terracotta tag, because that
// is the court the night is waiting on.

import { Card, Sheet, T, Tag } from "../../ui/primitives";
import { courtActivityLine, type CourtSummary } from "./model";

export interface CourtSwitcherProps {
  /** Every court, not just the focused one. */
  courts: CourtSummary[];
  activeCourtNumber: number;
  onSelectCourt: (courtNumber: number) => void;
  onDismiss: () => void;
}

export const CourtSwitcher = ({
  courts,
  activeCourtNumber,
  onSelectCourt,
  onDismiss,
}: CourtSwitcherProps) => (
  <Sheet onDismiss={onDismiss}>
    <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
      Both courts run at once
    </p>

    {courts.map((court) => {
      const here = court.number === activeCourtNumber;
      const scoreDue = court.activity?.kind === "scoreDue";

      const row = (
        <Card
          tone={here ? "live" : "plain"}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 17, margin: 0 }}>
              Court {court.number}
            </p>
            {/* A court with nobody on it has no line in frame 13, so it gets none. */}
            {court.activity && (
              <p style={{ font: `400 14px ${T.fontBody}`, color: T.mut, margin: "3px 0 0" }}>
                {courtActivityLine(court.activity)}
              </p>
            )}
          </div>
          {/* The court you are standing on says so; any other court that owes a
              score says that instead. Both at once is the court you are on, and
              "You are here" is the more useful of the two. */}
          {here ? (
            <Tag>You are here</Tag>
          ) : scoreDue ? (
            <Tag tone="live">Score due</Tag>
          ) : null}
        </Card>
      );

      // The active row is not a control. Tapping the court you are already on
      // would close the sheet and look like a switch that did nothing.
      return here ? (
        <div key={court.number}>{row}</div>
      ) : (
        <button
          key={court.number}
          type="button"
          onClick={() => onSelectCourt(court.number)}
          style={{
            display: "block",
            width: "100%",
            padding: 0,
            border: "none",
            background: "transparent",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          {row}
        </button>
      );
    })}

    <p
      style={{
        font: `400 14.5px/1.45 ${T.fontBody}`,
        color: T.mut,
        textAlign: "center",
        textWrap: "pretty",
        margin: "2px 0 0",
      }}
    >
      Flip mid-match, mid-score, mid-anything. Each court keeps its own schedule and picks up
      exactly where it was.
    </p>
  </Sheet>
);
