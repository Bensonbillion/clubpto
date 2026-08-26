// Frame 17: Standings.
//
// The table is the screen. Nothing on it is filled: the only control is the
// ghost "Session summary" in the bar, because the decision that used to live
// here, seeding the playoff, moved to frames 19 and 20 where the court chooses
// how it ends. A sage "Seed the playoff" on this screen would spend the one
// fill on a tap the frame no longer draws here.
//
// Standings are PER COURT, not per session. The caller computes one view per
// court and hands it in already sorted (points, then score difference, then
// whoever reached the total first). This component never re-sorts: the order it
// receives is the record.
//
// The reason line under a tied row is the night's own record and it STAYS on
// the row for the rest of the night (night-spec, "the tables settle"). There is
// no timer here and no dismissal, because there is nothing to dismiss: once the
// caller sets a row's reason it keeps passing it, and this component keeps
// drawing it.

import type { CSSProperties, ReactNode } from "react";
import {
  Body,
  FooterBar,
  Num,
  Screen,
  SecondaryButton,
  StatLabel,
  T,
  TabBar,
  type Tab,
} from "../../ui/primitives";
import { ScreenHead } from "./ScreenHead";

/**
 * The only sub-lines that exist. Composing a new one is not allowed: if a
 * situation has no line here, the row carries no reason.
 *
 * The two tie lines are drawn on frame 17. "Behind on score difference" is not
 * drawn there but the spec names it as one of the two ways the table explains
 * itself on the row, so it is carried verbatim from the spec rather than
 * reworded.
 *
 * The clock time is a formatted string rather than a timestamp because the
 * frames draw "8:41" and the manager runs on one phone in one room. Formatting
 * it here would put a locale decision inside a presentational component.
 */
export type StandingsReason =
  | { kind: "firstToThisScore"; atClockTime: string }
  | { kind: "reachedItLater"; atClockTime: string }
  | { kind: "behindOnDiff" };

export interface StandingsTabRow {
  /** 1-based, already resolved by the caller. */
  position: number;
  playerId: string;
  displayName: string;
  /** P */
  matchesPlayed: number;
  /** W */
  wins: number;
  /** L */
  losses: number;
  /** Diff, signed. */
  pointDifference: number;
  /** Pts */
  points: number;
  reason: StandingsReason | null;
  /** Set on both sides of an order-broken tie; what frame 18 opens on. */
  tiedWithPlayerId: string | null;
}

export interface StandingsTabProps {
  /**
   * The court chip row and the night menu. Same reason the playoff screens
   * carry it: flip mid-anything means every screen, and this tab is a screen.
   */
  header?: ReactNode;
  /** The active court's name, e.g. "Court 1". Read-only label. */
  courtLabel: string;
  /**
   * True once every score on this court has landed. The table is final the
   * moment the last one does (night-spec), and frame 17 says so by writing the
   * eyebrow as "Court 2 · final". While it is false the eyebrow is the court
   * alone: the frames draw no word for a table still moving.
   */
  tableFinal?: boolean;
  /** Pre-sorted. Never re-sorted here. */
  rows: StandingsTabRow[];
  /**
   * What every player on this court has played, when they have all played the
   * same. It is the "three" in "Everyone played three." Null when the counts
   * differ, which frame 17 draws no wording for, so that sentence is dropped
   * rather than reworded.
   */
  matchesEach: number | null;
  /** Placeholder rows while the table loads. */
  loading?: boolean;
  /** The bar's ghost action. */
  onOpenSessionSummary: () => void;
  onSelectTab: (t: Tab) => void;
  /**
   * Opens frame 18. The trigger is a tap on a row whose reason line is drawn,
   * which is exactly the pair of rows frame 18 explains.
   */
  onOpenTie?: (row: StandingsTabRow) => void;
}

// FLAG: no error state. Standings has no error copy in the frames, and the
// score and booking failures belong to the states slice. Nothing rendered.

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// Frame 17 writes the count as a word, "Everyone played three.", because it
// reads as a sentence rather than as a value.
// FLAG: nothing past twelve is drawn, so it falls back to the numeral.
const COUNT_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];
const countWord = (n: number) => COUNT_WORDS[n] ?? `${n}`;

const reasonLine = (reason: StandingsReason): string => {
  switch (reason.kind) {
    case "firstToThisScore":
      return `First to this score, ${reason.atClockTime}.`;
    case "reachedItLater":
      return `Reached it at ${reason.atClockTime}.`;
    case "behindOnDiff":
      return "Behind on score difference.";
  }
};

// The player who got there first gets the sage line, everyone the table had to
// demote gets the muted one. Frame 17 draws exactly that pairing, and it is the
// whole reason the two tied rows read as one explanation rather than as two
// unrelated notes.
const reasonInk = (reason: StandingsReason) =>
  reason.kind === "firstToThisScore" ? T.acc : T.mut;

/** Column widths, straight off frame 17 so the header and the rows cannot drift. */
const COL: Record<"rank" | "p" | "w" | "l" | "diff" | "pts", CSSProperties> = {
  rank: { width: 26 },
  p: { width: 26, textAlign: "right" },
  w: { width: 26, textAlign: "right" },
  l: { width: 26, textAlign: "right" },
  diff: { width: 42, textAlign: "right" },
  pts: { width: 38, textAlign: "right" },
};

const ColumnHeaders = () => (
  <div style={{ display: "flex", gap: 6, padding: "14px 22px 6px" }}>
    <span style={COL.rank}><StatLabel>#</StatLabel></span>
    <span style={{ flex: 1, minWidth: 0 }}><StatLabel>Player</StatLabel></span>
    <span style={COL.p}><StatLabel>P</StatLabel></span>
    <span style={COL.w}><StatLabel>W</StatLabel></span>
    <span style={COL.l}><StatLabel>L</StatLabel></span>
    <span style={COL.diff}><StatLabel>Diff</StatLabel></span>
    <span style={COL.pts}><StatLabel>Pts</StatLabel></span>
  </div>
);

const RowShell = ({ last, onClick, children }: {
  last: boolean; onClick?: () => void; children: ReactNode;
}) => {
  const shell: CSSProperties = {
    display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
    width: "100%", boxSizing: "border-box", textAlign: "left",
    padding: "11px 22px",
    // The last row drops its rule so the table does not end on a line that
    // looks like the start of another row.
    borderBottom: last ? "none" : `1px solid ${T.line}`,
    background: "transparent", color: T.ink,
  };
  return onClick ? (
    <button type="button" onClick={onClick} style={{ ...shell, border: "none", borderBottom: shell.borderBottom, cursor: "pointer" }}>
      {children}
    </button>
  ) : (
    <div style={shell}>{children}</div>
  );
};

const StandingsRowView = ({ row, last, onOpenTie }: {
  row: StandingsTabRow; last: boolean; onOpenTie?: (row: StandingsTabRow) => void;
}) => {
  const tappable = onOpenTie != null && row.tiedWithPlayerId != null && row.reason != null;

  return (
    <RowShell last={last} onClick={tappable ? () => onOpenTie(row) : undefined}>
      <Num size={19} style={{ ...COL.rank, color: T.acc }}>{row.position}</Num>
      <span style={{ flex: 1, minWidth: 0, font: `600 15.5px ${T.fontBody}` }}>
        {row.displayName}
      </span>
      <Num size={18} style={COL.p}>{row.matchesPlayed}</Num>
      <Num size={18} style={COL.w}>{row.wins}</Num>
      <Num size={18} style={COL.l}>{row.losses}</Num>
      <Num size={18} style={COL.diff}>{signed(row.pointDifference)}</Num>
      <Num size={22} style={COL.pts}>{row.points}</Num>
      {row.reason != null && (
        <span style={{
          width: "100%", paddingLeft: 28,
          font: `400 13px ${T.fontBody}`, color: reasonInk(row.reason),
        }}>{reasonLine(row.reason)}</span>
      )}
    </RowShell>
  );
};

const PlaceholderRows = () => (
  <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ border: `1.5px solid ${T.line}`, borderRadius: T.radius, height: 44 }} />
    ))}
  </div>
);

export const StandingsTab = ({
  header,
  courtLabel, tableFinal, rows, matchesEach, loading,
  onOpenSessionSummary, onSelectTab, onOpenTie,
}: StandingsTabProps) => (
  <Screen>
    {header}
    <ScreenHead
      title="Standings"
      step={tableFinal === true ? `${courtLabel} · final` : courtLabel}
    />

    {/* FLAG: the column strip is dropped while loading. Headers over no table
        name columns that are not there yet. */}
    {!loading && <ColumnHeaders />}

    <Body>
      {loading ? (
        <PlaceholderRows />
      ) : (
        // A night that has just started arrives as zeros in roster order with
        // no reason lines. The frames draw no headline for that, so none is
        // invented: the table simply renders the zeros.
        rows.map((row, i) => (
          <StandingsRowView
            key={row.playerId}
            row={row}
            last={i === rows.length - 1}
            onOpenTie={onOpenTie}
          />
        ))
      )}
    </Body>

    <FooterBar
      helper={
        <>
          Points, then score difference, then who got there first.
          {matchesEach != null && ` Everyone played ${countWord(matchesEach)}.`}
        </>
      }
    >
      <SecondaryButton onClick={onOpenSessionSummary}>Session summary</SecondaryButton>
    </FooterBar>

    <TabBar active="standings" onChange={onSelectTab} />
  </Screen>
);

export default StandingsTab;
