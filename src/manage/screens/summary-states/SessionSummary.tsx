// Frame 25, Session summary.
//
// This screen used to be a dashboard: three stat tiles, a champions card, then
// a rendered table per court, with the WhatsApp paste built invisibly behind a
// button. Frame 25 throws all of that away and shows the PASTE ITSELF, in
// monospace on the deep ground, as the body of the screen.
//
// That is the whole point of the frame, and it is worth stating so nobody
// re-prettifies it later: what the operator sees is byte for byte what lands
// in WhatsApp. A dashboard would have to be trusted to agree with the text it
// generates. A preview of the text cannot disagree with itself, which is what
// makes it "the insurance policy against a dead phone".
//
// The screen sits under the tab bar with Standings lit, because it is reached
// from the Standings tab and the frame draws no close control. Tapping a tab
// is the way out.

import type { Tab } from "../../ui/primitives";
import { Body, Card, Eyebrow, FooterBar, PrimaryButton, Screen, T, TabBar, TertiaryButton } from "../../ui/primitives";
import { signed } from "./format";

// The paste leaves both Organic faces on purpose. Figtree and Caprasimo are
// what the manager looks like; a monospace block is what a message pasted into
// WhatsApp looks like, and the frame draws the preview in the second voice so
// the operator reads it as text rather than as more app.
const MONO = "ui-monospace, Menlo, Consolas, monospace";

export interface SummaryChampion {
  courtNumber: number;
  /**
   * Everyone who won this court. Two names for a bracket pair, one for the
   * court that ended on its table, three for the rotating trio a court of nine
   * seeds. The line's noun follows the count, so a single winner reads
   * "champion" and any pair or trio reads "champions".
   */
  players: string[];
  /**
   * The final's score, winners first, for a court that ended on a bracket.
   * Renders as "(16-12)". Null or absent on a court that ended on its table.
   */
  finalScore?: readonly [number, number] | null;
  /**
   * The winner's points, for a court that ended on one more round rather than
   * a bracket. Renders as ", 12 pts". Null or absent on a bracket court.
   */
  points?: number | null;
}

export interface SummaryStandingRow {
  rank: number;
  playerName: string;
  points: number;
  /** Signed integer. Printed with its sign when it is what decided the rank. */
  diff: number;
  /**
   * What separated this row from the one directly BELOW it, straight off
   * engine/standings.ts. The paste prints a reason only where points alone did
   * not decide the order, which is how a line stays readable at eight players.
   */
  separatedBy?: "points" | "diff" | "reachedFirst" | null;
}

export interface SummaryCourtStandings {
  courtNumber: number;
  rows: SummaryStandingRow[];
}

export interface SessionSummaryProps {
  /** "Wednesday". Titles the screen and opens the paste. */
  dayLabel: string;
  /** Everyone in tonight, across every court. */
  playersIn: number;
  /**
   * Courts that have crowned someone. In the order the frame lists them, which
   * is the order the courts finished, so the caller decides it and this screen
   * never re-sorts. Re-sorting by court number would rank the courts, and the
   * night deliberately does not.
   */
  champions: SummaryChampion[];
  standingsByCourt: SummaryCourtStandings[];
  /** Which tab is lit. Frame 25 draws Standings. */
  activeTab: Tab;
  /** Receives the finished plain text; the caller writes it to the clipboard. */
  onCopy: (payload: string) => void;
  /** Opens the end-the-night confirmation, frame 28c. Never ends it directly. */
  onEndNight: () => void;
  /**
   * The only way off this screen. The frame draws no close control, so the
   * caller should dismiss the summary and land on the tab that was tapped.
   */
  onTabChange: (tab: Tab) => void;
}

/**
 * The reason a row finished where it did, in the paste's own words.
 *
 * The rule: a row carries a reason only when it beat the row below it on
 * something other than points. "(first to score)" for the third sort key,
 * "(+14)" when score difference did it. Rank 8 has nobody below it and so
 * carries nothing.
 *
 * FLAG (copy sign-off): the frame prints "(+11)" on rank 2, whose place was
 * decided on points, apparently so the top two diffs read together. Attaching
 * a reason to a row that did not need one would put a number on most rows of a
 * tied court, so the rule above stands and rank 2 will print bare.
 */
const rankReason = (row: SummaryStandingRow): string =>
  row.separatedBy === "reachedFirst" ? " (first to score)"
    : row.separatedBy === "diff" ? ` (${signed(row.diff)})`
      : "";

/**
 * The plain text, exactly as frame 25 draws it:
 *
 *   Wednesday · 16 players · 2 courts
 *
 *   COURT 2 champions: Hamid + Tumi (16-12)
 *   COURT 1 champion: Ayo, 12 pts
 *
 *   Court 2: 1 Hamid 9 (+14), 2 Chibuike 9, 3 Tumi 6, ...
 *
 * One line per court for the tables, because a paste that a phone wraps is
 * still one line to WhatsApp, and a reader scanning for their own name wants
 * the courts kept apart.
 */
export function buildWhatsAppPayload({ dayLabel, playersIn, champions, standingsByCourt }: Pick<
  SessionSummaryProps,
  "dayLabel" | "playersIn" | "champions" | "standingsByCourt"
>): string {
  const blocks: string[] = [
    `${dayLabel} · ${playersIn} players · ${standingsByCourt.length} courts`,
  ];

  // FLAG: the summary is reachable all night, so this list is empty until a
  // court finishes. The frame draws no wording for that, so the block is left
  // out rather than given an invented sentence.
  if (champions.length > 0) {
    blocks.push(champions.map((c) => {
      const noun = c.players.length > 1 ? "champions" : "champion";
      const tail = c.finalScore != null ? ` (${c.finalScore[0]}-${c.finalScore[1]})`
        : c.points != null ? `, ${c.points} pts`
          : "";
      return `COURT ${c.courtNumber} ${noun}: ${c.players.join(" + ")}${tail}`;
    }).join("\n"));
  }

  const tables = standingsByCourt
    .filter((court) => court.rows.length > 0)
    .map((court) => `Court ${court.courtNumber}: ` + court.rows
      .map((r) => `${r.rank} ${r.playerName} ${r.points}${rankReason(r)}`)
      .join(", "));
  if (tables.length > 0) blocks.push(tables.join("\n"));

  // A blank line between blocks, which is what the frame draws and what makes
  // the paste readable in a chat that strips nothing else.
  return blocks.join("\n\n");
}

export const SessionSummary = ({
  dayLabel,
  playersIn,
  champions,
  standingsByCourt,
  activeTab,
  onCopy,
  onEndNight,
  onTabChange,
}: SessionSummaryProps) => {
  const payload = buildWhatsAppPayload({ dayLabel, playersIn, champions, standingsByCourt });

  return (
    <Screen>
      <div style={{
        padding: "24px 22px 8px", display: "flex", flexDirection: "column",
        alignItems: "flex-start", gap: 4,
      }}>
        <h2 style={{
          fontFamily: T.fontHead, fontWeight: 400, fontSize: 28, lineHeight: 1.15,
          letterSpacing: "-.015em", margin: 0,
        }}>{dayLabel}</h2>
        <Eyebrow>Session summary</Eyebrow>
      </div>

      <Body style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* The sentence names two champions and no crossover final, so it is
            only true once both courts have finished. Below that it is left
            out: the frame draws no half-finished wording, and a line about two
            champions over one champion would be wrong on the operator's phone
            in front of the room. */}
        {champions.length > 1 && (
          <Card style={{ gap: 0 }}>
            <p style={{ font: `400 14px ${T.fontBody}`, color: T.mut, margin: 0 }}>
              Two champions, no crossover final. Neither court outranks the other.
            </p>
          </Card>
        )}

        <div style={{
          background: T.deep, borderRadius: T.radiusPanel, padding: "16px 18px",
          font: `400 13px/1.75 ${MONO}`,
          // Between ink and mut in the frame. Mut is the nearest named tone and
          // holds well over the deep ground at 13px.
          color: T.mut,
          whiteSpace: "pre-wrap", overflowWrap: "anywhere",
        }}>{payload}</div>

        <p style={{ font: `400 14px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textWrap: "pretty" }}>
          Plain text, the insurance policy against a dead phone. Available all night, not just at the end.
        </p>
      </Body>

      {/* FLAG: neither a copied confirmation nor a copy failure is drawn. The
          caller decides what, if anything, happens after onCopy. */}
      <FooterBar>
        <PrimaryButton onClick={() => onCopy(payload)}>Copy for WhatsApp</PrimaryButton>
        {/* Warm, not muted. Ending the night is the one thing on this screen
            that cannot be walked back, and the frame marks it in terracotta
            while leaving it the quietest control on the bar. */}
        <TertiaryButton onClick={onEndNight} style={{ color: T.warm }}>End the night</TertiaryButton>
      </FooterBar>

      <TabBar active={activeTab} onChange={onTabChange} />
    </Screen>
  );
};
