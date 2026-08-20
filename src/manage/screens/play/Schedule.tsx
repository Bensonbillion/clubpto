// Frame 12b, Schedule, skip and return.
//
// Every match of the night is drawn up front, and nothing has to happen in
// order. That is the reason this screen exists rather than a progress bar: a
// court can jump to whichever four are actually standing there, and the match
// it stepped past goes back to waiting instead of vanishing.
//
// "Skipped · waiting" is therefore not an error state and is not drawn as one.
// It is the neutral tag, the same one an untouched match wears, because a
// skipped game and a game not yet reached are the same thing to the operator:
// still owed, still coming.

import { Body, FooterBar, Screen, TabBar, Tag, T, type Tab } from "../../ui/primitives";
import type { ScheduleRow, ScheduleRowStatus } from "./model";

export interface ScheduleProps {
  /** "Court 1". The header counts the rows itself. */
  courtLabel: string;
  rows: ScheduleRow[];
  /** Jumps the match screen straight to that row. */
  onSelectMatch: (matchId: string) => void;
  activeTab?: Tab;
  onTabChange: (tab: Tab) => void;
}

/** The tag a row wears, or null for a played row, which shows its score. */
const tagFor = (status: ScheduleRowStatus) => {
  switch (status) {
    case "live": return <Tag tone="live">Live</Tag>;
    case "upNext": return <Tag tone="accent">Up next</Tag>;
    case "skipped": return <Tag>Skipped &middot; waiting</Tag>;
    case "waiting": return <Tag>Waiting</Tag>;
    case "played": return null;
  }
};

export const Schedule = ({
  courtLabel,
  rows,
  onSelectMatch,
  activeTab = "match",
  onTabChange,
}: ScheduleProps) => (
  <Screen>
    <div
      style={{
        padding: "24px 22px 8px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 10,
      }}
    >
      <h2 style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 25, lineHeight: 1.15, margin: 0 }}>
        Schedule
      </h2>
      <p
        style={{
          font: `600 11.5px ${T.fontBody}`,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: T.acc,
          margin: 0,
        }}
      >
        {courtLabel} &middot; {rows.length} matches
      </p>
    </div>

    {/* The frame ends this line on an em dash. Restructured to a full stop, no
        word changed. */}
    <p
      style={{
        font: `400 15px/1.5 ${T.fontBody}`,
        color: T.mut,
        padding: "0 22px",
        margin: "8px 0 0",
        textWrap: "pretty",
      }}
    >
      The arrows on the match screen walk this list. Tap any row to jump straight to it. Nothing has
      to happen in order.
    </p>

    {/* Ten matches on a 390x844 phone scroll here, not in the page. */}
    <Body style={{ marginTop: 10 }}>
      {rows.map((row) => {
        // A match that has not been reached is dimmed, because the point of
        // the list is the two or three rows that are actually in play.
        const quiet = row.status === "skipped" || row.status === "waiting";
        return (
          <button
            key={row.matchId}
            type="button"
            onClick={() => onSelectMatch(row.matchId)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "14px 22px",
              border: "none",
              borderBottom: `1px solid ${T.line}`,
              background: row.status === "live" ? T.raised : "transparent",
              color: T.ink,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontFamily: T.fontHead,
                fontWeight: 400,
                fontSize: 18,
                fontVariantNumeric: "tabular-nums",
                color: T.mut,
                width: 22,
                flex: "none",
              }}
            >
              {row.number}
            </span>

            <p
              style={{
                font: `600 15px ${T.fontBody}`,
                color: quiet ? T.mut : T.ink,
                flex: 1,
                minWidth: 0,
                margin: 0,
              }}
            >
              {row.pairA} <span style={{ color: T.soft }}>v</span> {row.pairB}
            </p>

            {row.status === "played" && row.scoreA != null && row.scoreB != null ? (
              <span
                style={{
                  fontFamily: T.fontHead,
                  fontWeight: 400,
                  fontSize: 19,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {row.scoreA}-{row.scoreB}
              </span>
            ) : (
              tagFor(row.status)
            )}
          </button>
        );
      })}
    </Body>

    <FooterBar helper="A skipped game never disappears. It waits until you come back to it.">
      {null}
    </FooterBar>

    <TabBar active={activeTab} onChange={onTabChange} />
  </Screen>
);
