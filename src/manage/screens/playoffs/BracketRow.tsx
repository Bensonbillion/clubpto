// One tie in the bracket — a full-width row, never a node in a tree.
//
// Three bands stacked: team, lime score band, team. The row's border carries
// its whole state, which is why there is no badge and no `Live` tag here (v1
// had one; v2 spends the emphasis on the 2px border instead):
//
//   complete    1px hairline, the LOSING NAME drops to 55%, numerals stay full
//   live / next 2px cream — the one bold element on frame 20
//   pending     dashed, no score band at all, and inert
//
// A completed row does not reopen scoring. It opens the correct/void flow,
// because a finished playoff result is corrected, not re-entered.

import type { CSSProperties, ReactNode } from "react";
import { Num, T } from "../../ui/primitives";
import { ScoreBand } from "./ScoreBand";
import type { BracketMatch, PlayoffTeam } from "./model";

/**
 * Drawn for a side no pair has been seeded into. With a top-four final both
 * sides are filled the moment the playoff is seeded, so this is a guard for
 * malformed data rather than a state the night reaches — and it no longer
 * names a semi-final that is never played.
 */
const WAITING_LINE = "Waits for the semifinals";

const DASHED_BORDER = "1px dashed rgba(244,237,224,.25)";

export interface BracketRowProps {
  match: BracketMatch;
  /**
   * Live and next-up rows open frame 21; completed rows open the correct/void
   * flow (frame 16, other slice). Dashed rows never call it.
   */
  onOpen?: () => void;
}

const TeamLine = ({ team, dim }: { team: PlayoffTeam; dim: boolean }) => (
  <div
    style={{
      padding: "11px 14px",
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 10,
    }}
  >
    <span style={{ font: "700 17px Inter, sans-serif", color: dim ? T.ink55 : T.ink }}>
      {team.name}
    </span>
    <Num size={20} style={{ color: T.ink50 }}>{team.seedLabel}</Num>
  </div>
);

const Shell = ({ style, onOpen, children }: {
  style: CSSProperties; onOpen?: () => void; children: ReactNode;
}) =>
  onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      style={{
        ...style,
        width: "100%",
        padding: 0,
        textAlign: "left",
        boxSizing: "border-box",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  ) : (
    <div style={style}>{children}</div>
  );

export const BracketRow = ({ match, onOpen }: BracketRowProps) => {
  if (match.status === "pending") {
    return (
      <div
        style={{
          border: DASHED_BORDER,
          borderRadius: T.radius,
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* FLAG: a row with BOTH sides unknown — every stage after the first on
            a freshly seeded bracket — has no drawn copy of its own. It falls
            back to the single waiting line rather than inventing a second. */}
        {match.teamA != null && (
          <div style={{ font: "700 17px Inter, sans-serif" }}>{match.teamA.name}</div>
        )}
        {(match.teamA == null || match.teamB == null) && (
          <div style={{ font: "400 16px Inter, sans-serif", color: T.ink50 }}>{WAITING_LINE}</div>
        )}
        {match.teamB != null && (
          <div style={{ font: "700 17px Inter, sans-serif" }}>{match.teamB.name}</div>
        )}
      </div>
    );
  }

  // FLAG: a formed row is drawn with both teams. A live or completed row with a
  // null side is not a state either wireframe draws, so nothing is rendered
  // rather than half a tie.
  if (match.teamA == null || match.teamB == null) return null;

  const bold = match.status === "live" || match.status === "next";
  const dimSide = match.status === "complete" && match.winnerSide != null
    ? match.winnerSide === "A" ? "B" : "A"
    : null;

  return (
    <Shell
      onOpen={onOpen}
      style={{
        border: bold ? `2px solid ${T.ink}` : `1px solid ${T.line}`,
        borderRadius: T.radius,
        overflow: "hidden",
      }}
    >
      <TeamLine team={match.teamA} dim={dimSide === "A"} />
      <ScoreBand scoreA={match.scoreA} scoreB={match.scoreB} size={48} cellPadding={4} />
      <TeamLine team={match.teamB} dim={dimSide === "B"} />
    </Shell>
  );
};

export default BracketRow;
