// Frame 17 — Standings tab.
//
// The table is the screen. One filled surface only: the lime `Seed the
// playoff` button in the action bar. Everything above it is text on the dark
// ground, separated by hairlines.
//
// Standings are PER COURT, not per session. The caller computes one view per
// court and hands it in already sorted (points desc, then score difference
// desc, then whoever reached the total first). This component never re-sorts —
// the order it receives is the record.

import type { CSSProperties, ReactNode } from "react";
import {
  Body,
  FooterBar,
  Num,
  PrimaryButton,
  Screen,
  T,
  TabBar,
  type Tab,
} from "../../ui/primitives";

/** Row hairline. Lighter than T.lineSoft — the frame separates rows at .08. */
const ROW_LINE = "rgba(244,237,224,.08)";

/** The disabled `Seed the playoff` fill, as drawn on frame 19. */
const DISABLED_FILL = "rgba(244,237,224,.1)";
const DISABLED_INK = "rgba(244,237,224,.4)";

/**
 * The only sub-lines that exist. Composing a new one is not allowed — if a
 * situation has no line here, the row carries no reason.
 */
export type StandingsReason =
  | { kind: "behindOnDiff" }
  | { kind: "gotThereFirst"; matchNumber: number }
  | { kind: "gotThereSecond"; matchNumber: number }
  | { kind: "arrivedLate" }
  | { kind: "leftEarly" };

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
  /** The match at which this player first hit their current (points, diff). */
  reachedTotalAtMatchNumber: number;
  reason: StandingsReason | null;
  /** Set on both sides of an order-broken tie; what frame 18 opens on. */
  tiedWithPlayerId: string | null;
}

export interface StandingsShortfall {
  /** How many players are short. */
  playerCount: number;
  /** How many matches those players have played. */
  matchesPlayed: number;
}

export interface StandingsTabProps {
  /** The active court's name, e.g. "Court 1". Read-only label. */
  courtLabel: string;
  /** Drives "A win is 3." */
  pointsPerWin: number;
  /** Pre-sorted. Never re-sorted here. */
  rows: StandingsTabRow[];
  /** Null when everyone has played the same number of matches. */
  shortfall: StandingsShortfall | null;
  seedingEnabled: boolean;
  /** Placeholder rows while the table loads. */
  loading?: boolean;
  onSeedPlayoff: () => void;
  onSelectTab: (t: Tab) => void;
  /**
   * Opens frame 18. Not drawn in the wireframe — the recommended trigger is a
   * tap on a row whose reason line is `Got there first` / `Reached it`.
   */
  onOpenTie?: (row: StandingsTabRow) => void;
}

// FLAG: no error state. Standings has no error copy in either wireframe, and
// the score/bookings error copy belongs to a different slice. Nothing rendered.

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const COUNT_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six",
  "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
];

// FLAG: the frame draws the plural ("Two players have played 2."). The
// singular inflection and any count past twelve are inferred, not drawn.
const spellCount = (n: number) => (n < COUNT_WORDS.length ? COUNT_WORDS[n] : `${n}`);

const reasonText = (reason: StandingsReason): string => {
  switch (reason.kind) {
    case "behindOnDiff":
      return "Behind on score difference.";
    case "gotThereFirst":
      return `Got there first, in match ${reason.matchNumber}.`;
    case "gotThereSecond":
      return `Reached it in match ${reason.matchNumber}, so second.`;
    case "arrivedLate":
      return "Arrived late.";
    case "leftEarly":
      return "Left early.";
  }
};

const isOrderBrokenTie = (row: StandingsTabRow) =>
  row.reason != null &&
  (row.reason.kind === "gotThereFirst" || row.reason.kind === "gotThereSecond");

const COL: Record<"p" | "w" | "l" | "diff" | "pts", CSSProperties> = {
  p: { width: 32, textAlign: "right" },
  w: { width: 30, textAlign: "right" },
  l: { width: 30, textAlign: "right" },
  diff: { width: 40, textAlign: "right" },
  pts: { width: 38, textAlign: "right" },
};

const ColumnHeaders = () => (
  <div style={{
    display: "flex", padding: "8px 18px",
    font: "800 11px Inter, sans-serif", letterSpacing: ".06em",
    textTransform: "uppercase", color: T.ink45,
    borderBottom: `1px solid ${T.lineSoft}`,
  }}>
    <span style={{ width: 24 }}>#</span>
    <span style={{ flex: 1 }}>Player</span>
    <span style={COL.p}>P</span>
    <span style={COL.w}>W</span>
    <span style={COL.l}>L</span>
    <span style={COL.diff}>Diff</span>
    <span style={COL.pts}>Pts</span>
  </div>
);

const RowShell = ({ onClick, children }: { onClick?: () => void; children: ReactNode }) => {
  const shell: CSSProperties = {
    display: "block", width: "100%", textAlign: "left", boxSizing: "border-box",
    padding: "11px 18px", borderBottom: `1px solid ${ROW_LINE}`,
    background: "transparent", color: "inherit",
  };
  return onClick ? (
    <button type="button" onClick={onClick} style={{ ...shell, border: "none", borderBottom: `1px solid ${ROW_LINE}`, cursor: "pointer" }}>
      {children}
    </button>
  ) : (
    <div style={shell}>{children}</div>
  );
};

const StandingsRowView = ({ row, onOpenTie }: {
  row: StandingsTabRow; onOpenTie?: (row: StandingsTabRow) => void;
}) => {
  // A player on 0 points renders the whole row — numerals included — at 60%.
  const dimRow = row.points === 0;
  // A player who left early keeps their real numbers; only the name dims.
  const dimName = row.reason != null && row.reason.kind === "leftEarly";
  const tappable = onOpenTie && row.tiedWithPlayerId != null && isOrderBrokenTie(row);

  return (
    <RowShell onClick={tappable ? () => onOpenTie(row) : undefined}>
      <div style={{
        display: "flex", alignItems: "baseline",
        color: dimRow ? T.ink60 : T.ink,
      }}>
        <Num size={24} style={{ width: 24 }}>{row.position}</Num>
        <span style={{
          flex: 1, font: "700 17px Inter, sans-serif",
          color: dimName ? T.ink60 : "inherit",
        }}>{row.displayName}</span>
        <Num size={24} style={COL.p}>{row.matchesPlayed}</Num>
        <Num size={24} style={COL.w}>{row.wins}</Num>
        <Num size={24} style={COL.l}>{row.losses}</Num>
        <Num size={24} style={COL.diff}>{signed(row.pointDifference)}</Num>
        <Num size={24} style={COL.pts}>{row.points}</Num>
      </div>
      {row.reason != null && (
        <div style={{
          font: "400 14px Inter, sans-serif", color: T.ink55,
          marginTop: 3, paddingLeft: 24,
        }}>{reasonText(row.reason)}</div>
      )}
    </RowShell>
  );
};

const PlaceholderRows = () => (
  <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: T.radius, height: 44 }} />
    ))}
  </div>
);

export const StandingsTab = ({
  courtLabel, pointsPerWin, rows, shortfall, seedingEnabled, loading,
  onSeedPlayoff, onSelectTab, onOpenTie,
}: StandingsTabProps) => (
  <Screen>
    <div style={{
      padding: "14px 18px 10px", borderBottom: `1px solid ${T.lineSoft}`,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ font: "700 20px Inter, sans-serif" }}>Standings</span>
        <span style={{ font: "600 16px Inter, sans-serif" }}>{courtLabel}</span>
      </div>
      <div style={{ font: "400 14px Inter, sans-serif", color: T.ink55 }}>
        A win is <Num size={18}>{pointsPerWin}</Num>. Points first, then score difference.
      </div>
    </div>

    {/* FLAG: the column strip is dropped while loading — headers over no table. */}
    {!loading && <ColumnHeaders />}

    <Body>
      {loading ? (
        <PlaceholderRows />
      ) : (
        <>
          {/* Session just started: every row arrives as zeros, in roster order,
              with no reason lines. No headline is drawn for it, so none is
              invented — the table simply renders the zeros. */}
          {rows.map((row) => (
            <StandingsRowView key={row.playerId} row={row} onOpenTie={onOpenTie} />
          ))}
          {shortfall != null && shortfall.playerCount > 0 && (
            <div style={{
              padding: "8px 18px", font: "400 14px/1.4 Inter, sans-serif", color: T.ink50,
            }}>
              {spellCount(shortfall.playerCount)}{" "}
              {shortfall.playerCount === 1 ? "player has" : "players have"} played{" "}
              <Num size={18}>{shortfall.matchesPlayed}</Num>. No points for sitting out.
            </div>
          )}
        </>
      )}
    </Body>

    <FooterBar helper={
      <span style={{ font: "600 16px Inter, sans-serif", color: T.ink }}>
        Ties go to whoever got there first.
      </span>
    }>
      <PrimaryButton
        onClick={onSeedPlayoff}
        disabled={!seedingEnabled}
        style={seedingEnabled
          ? { height: 56, font: "700 18px Inter, sans-serif" }
          : {
              height: 56, font: "700 18px Inter, sans-serif",
              background: DISABLED_FILL, color: DISABLED_INK, opacity: 1,
            }}
      >Seed the playoff</PrimaryButton>
    </FooterBar>

    <TabBar active="standings" onChange={onSelectTab} />
  </Screen>
);

export default StandingsTab;
