// One tie in the bracket, as frame 21 draws it: a full-width row, never a node
// in a tree.
//
// The row is a `.bkt`, which is two parts side by side. The left is the two
// sides stacked, the right is a fixed 66px column of near-black holding the two
// numbers. That column is the reason a bracket row reads at a glance from the
// bench: the names change length, the scores never move.
//
// The border carries the row's state:
//   complete    1.5px line, the LOSING name drops to soft, its numeral to .4
//   live        2px terracotta, plus the "Live" tag notched into the top edge
//   next        1.5px line, and it opens
//   pending     dashed, a darker score cell, and dashes instead of numbers
//
// Terracotta and not sage on the live row. Sage is the fill the screen spends
// on its one forward action; terracotta means this is happening now.
//
// A completed row does not reopen scoring. It opens the correct or void flow,
// because a finished playoff result is corrected, not re-entered.
//
// Nothing here counts names. A side may hold three players when a court of nine
// seeds a rotating trio, and the side arrives as one composed string precisely
// so this file never has to know.

import type { CSSProperties, ReactNode } from "react";
import { T, Tag } from "../../ui/primitives";
import { scoreText, ordinalWord } from "./model";
import type { BracketMatch, BracketSide } from "./model";

/** `.bkt .sc`, the near-black score column. */
const SCORE_WIDTH = 66;

/** A pending row's column: still dark, but a step off the live one. */
const PENDING_SCORE_BG = "#211e1c";

export interface BracketRowProps {
  match: BracketMatch;
  /**
   * Live and next rows open frame 22; completed rows open the correct or void
   * flow, which belongs to another slice. Pending rows never call it.
   */
  onOpen?: () => void;
}

const NAME: CSSProperties = { font: `600 15px ${T.fontBody}` };

const SideLine = ({ side, dim }: { side: BracketSide; dim: boolean }) => {
  if (side.team != null) {
    return (
      <span style={{ ...NAME, color: dim ? T.soft : T.ink }}>
        {side.team.name}{" "}
        <Tag size="sm">{side.team.seedLabel}</Tag>
        {/* Three names alone read as a mistake. The label says what the side
            IS, so nobody stops the night to ask why five people are in a
            doubles match. No frame draws this wording; it is the shortest
            sentence that answers the question the row raises. */}
        {side.team.trio && (
          <Tag size="sm" tone="quiet">Rotating trio, two play each match</Tag>
        )}
      </span>
    );
  }

  // FLAG: a side with no team and nothing to wait on is malformed data rather
  // than a state the night reaches. It draws nothing instead of a placeholder.
  if (side.waitsFor == null) return null;

  const { stageLabel, position } = side.waitsFor;
  return (
    <span style={{ font: `600 14.5px ${T.fontBody}`, color: T.soft }}>
      Waits for the{" "}
      {position != null ? `${ordinalWord(position)} ` : ""}
      {stageLabel.toLowerCase()}
    </span>
  );
};

const ScoreCell = ({ children, dim }: { children: ReactNode; dim: boolean }) => (
  <span style={{
    fontFamily: T.fontHead, fontWeight: 400, fontSize: 26, lineHeight: 1.15,
    fontVariantNumeric: "tabular-nums", color: "#fff", opacity: dim ? 0.4 : 1,
  }}>{children}</span>
);

const Shell = ({ style, onOpen, children }: {
  style: CSSProperties; onOpen?: () => void; children: ReactNode;
}) =>
  onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      style={{
        ...style, width: "100%", padding: 0, textAlign: "left",
        boxSizing: "border-box", color: "inherit", cursor: "pointer",
      }}
    >
      {children}
    </button>
  ) : (
    <div style={style}>{children}</div>
  );

export const BracketRow = ({ match, onOpen }: BracketRowProps) => {
  const pending = match.status === "pending";
  const live = match.status === "live";
  const dimSide = match.status === "complete" && match.winnerSide != null
    ? match.winnerSide === "A" ? "B" : "A"
    : null;

  return (
    <Shell
      onOpen={pending ? undefined : onOpen}
      style={{
        display: "flex", borderRadius: T.radiusPanel, overflow: "hidden",
        background: "transparent",
        border: live ? `2px solid ${T.warm}` : `1.5px solid ${T.line}`,
        borderStyle: pending ? "dashed" : "solid",
        // The "Live" tag is notched into the top edge, so the row is the
        // positioning context for it.
        position: "relative",
      }}
    >
      <div style={{
        flex: 1, minWidth: 0, padding: "12px 15px",
        display: "flex", flexDirection: "column", gap: 7, justifyContent: "center",
      }}>
        <SideLine side={match.sideA} dim={dimSide === "A"} />
        <SideLine side={match.sideB} dim={dimSide === "B"} />
      </div>

      {live && (
        <Tag
          tone="live"
          style={{
            position: "absolute", top: -2, right: SCORE_WIDTH + 8,
            borderRadius: "0 0 12px 12px",
          }}
        >Live</Tag>
      )}

      <div style={{
        width: SCORE_WIDTH, flex: "none",
        background: pending ? PENDING_SCORE_BG : T.deep,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        {pending ? (
          <>
            <span style={{ fontFamily: T.fontHead, fontSize: 26, lineHeight: 1.15, color: T.soft }}>--</span>
            <span style={{ fontFamily: T.fontHead, fontSize: 26, lineHeight: 1.15, color: T.soft }}>--</span>
          </>
        ) : match.walkover ? (
          // Settled with no numbers: the winner advanced, the other conceded
          // or never turned up, and inventing a score would put a lie in the
          // bracket. The word is the result.
          <Tag size="sm" tone="quiet">Walkover</Tag>
        ) : (
          <>
            <ScoreCell dim={dimSide === "A"}>{scoreText(match.scoreA)}</ScoreCell>
            <ScoreCell dim={dimSide === "B"}>{scoreText(match.scoreB)}</ScoreCell>
          </>
        )}
      </div>
    </Shell>
  );
};

export default BracketRow;
