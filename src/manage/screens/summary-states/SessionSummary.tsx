// Frame 23 — Session summary (v2 `1x`). Reachable all night, not just at the end.
//
// The title sits on the RIGHT and the dismiss on the LEFT. That is what the
// frame draws; do not swap it.

import { Body, Card, Eyebrow, FooterBar, Num, PrimaryButton, Screen, StatLabel, T } from "../../ui/primitives";
import { pad2, signed } from "./format";

/** The spec's row rule for the summary table. `.1`, not the `.12` structural divider. */
const ROW_RULE = "1px solid rgba(244,237,224,.1)";

export interface SummaryChampion {
  courtNumber: number;
  playerA: string;
  playerB: string;
}

export interface SummaryStandingRow {
  rank: number;
  playerName: string;
  played: number;
  /** Signed integer. Rendered with its sign in both the table and the payload. */
  diff: number;
  points: number;
  /**
   * Why this rank was decided, in plain words, when points and diff were level.
   * The only approved value is `reached it later`. Payload only, never drawn
   * in the table.
   */
  tieBreakNote?: string | null;
}

export interface SummaryCourtStandings {
  courtNumber: number;
  rows: SummaryStandingRow[];
}

export interface SessionSummaryProps {
  /** `Wednesday night`. */
  dayLabel: string;
  matchesPlayed: number;
  playersIn: number;
  /** Results voided tonight. Rendered zero-padded. */
  voidedCount: number;
  /** Only courts whose playoff final has a recorded score. */
  champions: SummaryChampion[];
  standingsByCourt: SummaryCourtStandings[];
  /** Overrides the payload truncation count. Computed from the rows when omitted. */
  remainingPlayerCount?: number;
  onClose: () => void;
  /** Receives the finished plain-text payload; the caller writes it to the clipboard. */
  onCopy: (payload: string) => void;
}

/**
 * The plain-text paste, exactly as v1 frame 23 renders it:
 *
 *   Wednesday night
 *   Champions Court 1: Ayo + Kemi
 *   1. Ayo · 9 pts · +14
 *   2. Timi · 9 pts · +14, reached it later
 *   ...and 10 more
 *
 * Pairs join with `+` here even though on-screen pairs join with `and`.
 */
export function buildWhatsAppPayload(props: Pick<
  SessionSummaryProps,
  "dayLabel" | "champions" | "standingsByCourt" | "remainingPlayerCount"
>): string {
  const { dayLabel, champions, standingsByCourt, remainingPlayerCount } = props;
  const lines: string[] = [dayLabel];

  for (const c of champions) {
    lines.push(`Champions Court ${c.courtNumber}: ${c.playerA} + ${c.playerB}`);
  }

  // FLAG: the payload is drawn as ONE flat ranked list. With two courts the
  // per-court ranks would collide (two number 1s), so the list is numbered by
  // position. Multi-court payload ordering is not drawn anywhere — copy review.
  const all = standingsByCourt.flatMap((c) => c.rows);
  const shown = all.slice(0, 5);
  shown.forEach((r, i) => {
    const note = r.tieBreakNote ? `, ${r.tieBreakNote}` : "";
    lines.push(`${i + 1}. ${r.playerName} · ${r.points} pts · ${signed(r.diff)}${note}`);
  });

  const remaining = remainingPlayerCount ?? Math.max(0, all.length - shown.length);
  if (remaining > 0) lines.push(`...and ${remaining} more`);

  return lines.join("\n");
}

export const SessionSummary = ({
  dayLabel,
  matchesPlayed,
  playersIn,
  voidedCount,
  champions,
  standingsByCourt,
  remainingPlayerCount,
  onClose,
  onCopy,
}: SessionSummaryProps) => (
  <Screen>
    <div style={{
      padding: "14px 18px", borderBottom: `1px solid ${T.lineSoft}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <button type="button" onClick={onClose} style={{
        border: "none", background: "transparent", padding: 0, cursor: "pointer",
        color: T.ink, font: "600 16px Inter, sans-serif",
      }}>Close</button>
      <div style={{ font: "700 17px Inter, sans-serif" }}>Tonight</div>
    </div>

    <Body style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ font: "600 26px/1.15 'Playfair Display', serif" }}>{dayLabel}</div>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <StatLabel>Played</StatLabel>
          <Num size={34}>{pad2(matchesPlayed)}</Num>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <StatLabel>Players</StatLabel>
          <Num size={34}>{pad2(playersIn)}</Num>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <StatLabel>Voided</StatLabel>
          <Num size={34}>{pad2(voidedCount)}</Num>
        </div>
      </div>

      {/* FLAG: no champions crowned yet (summary opened mid-night) is not drawn.
          The card is omitted rather than given an invented empty-state string. */}
      {champions.length > 0 && (
        <Card style={{ gap: 4 }}>
          <Eyebrow>Champions</Eyebrow>
          {champions.map((c) => (
            <div key={c.courtNumber} style={{ font: "700 18px Inter, sans-serif" }}>
              {`Court ${c.courtNumber}: ${c.playerA} and ${c.playerB}`}
            </div>
          ))}
        </Card>
      )}

      {standingsByCourt.map((court) => (
        <div key={court.courtNumber} style={{ display: "flex", flexDirection: "column" }}>
          <Eyebrow style={{ paddingBottom: 8 }}>{`Final standings, Court ${court.courtNumber}`}</Eyebrow>
          {/* FLAG: no results yet renders the eyebrow with no rows. No empty line is drawn. */}
          {court.rows.map((row, i) => (
            <div key={row.playerName + row.rank} style={{
              display: "flex", alignItems: "baseline", padding: "9px 0",
              borderTop: ROW_RULE,
              borderBottom: i === court.rows.length - 1 ? ROW_RULE : undefined,
            }}>
              <Num size={22} style={{ width: 24 }}>{row.rank}</Num>
              <span style={{ flex: 1, font: "700 16px Inter, sans-serif" }}>{row.playerName}</span>
              <Num size={22} style={{ width: 34, textAlign: "right" }}>{row.played}</Num>
              <Num size={22} style={{ width: 44, textAlign: "right" }}>{signed(row.diff)}</Num>
              <Num size={22} style={{ width: 34, textAlign: "right" }}>{row.points}</Num>
            </div>
          ))}
        </div>
      ))}
    </Body>

    <FooterBar helper="Plain text, ready to paste. Works any time tonight.">
      {/* FLAG: no copy-success and no copy-failure feedback is drawn in either
          version. The caller decides; there is no approved string for it. */}
      <PrimaryButton onClick={() => onCopy(buildWhatsAppPayload({
        dayLabel, champions, standingsByCourt, remainingPlayerCount,
      }))}>Copy for WhatsApp</PrimaryButton>
    </FooterBar>
  </Screen>
);
