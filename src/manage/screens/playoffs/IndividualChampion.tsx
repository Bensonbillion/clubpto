import type { ReactNode } from "react";
// Frame 24: Court champion, the OTHER ending.
//
// A court that chose one more round has no bracket and no final. Everyone plays
// once more and whoever tops the table wins, so this frame crowns ONE PERSON
// rather than a pair, and the number under the name is points rather than a
// score. Same ground, same weight, same celebration as frame 23: the two
// endings are equal and the screens say so by looking alike.
//
// engine/endings.ts `individualChampion` returns exactly what is drawn here,
// including who came second and third and what separated them. It is read, not
// re-derived: the table is already a total order, so second against third is
// the row's own discriminator and never a comparison made on this screen.
//
// The way back is the standings, not a bracket, because the table IS the
// result. Correcting a score goes through the row that recorded it.

import type { StandingsRow } from "../../engine/standings";
import {
  Body,
  Eyebrow,
  PrimaryButton,
  Screen,
  T,
  TertiaryButton,
} from "../../ui/primitives";
import { BOX_LINE, DeepBar } from "./DeepBar";

/** Second and third, as the closing line names them. */
export interface RunnerUpLine {
  displayName: string;
  points: number;
}

export interface IndividualChampionProps {
  /**
   * The court chip row and the night menu, rendered above everything else.
   *
   * Found on a live walk: once a bracket existed, the operator was TRAPPED on
   * that court. Every playoff screen drew its own head and none carried the
   * court header, so there were no tabs to flip with and no menu to end the
   * night from. Frame A13 promises "flip mid-match, mid-score, mid-anything"
   * and frame 25b promises the menu "from any screen, either court, all
   * night", and a champion screen is a screen.
   */
  header?: ReactNode;
  courtNumber: number;
  championName: string;
  points: number;
  /** The "4" in "won all 4". */
  matchesPlayed: number;
  /** engine/endings.ts sets this. It is the whole condition for that clause. */
  wonEveryMatch: boolean;
  second: RunnerUpLine | null;
  third: RunnerUpLine | null;
  /**
   * What separated second from third, straight off the standings row
   * (engine/endings.ts `secondFromThird`). Frame 24's "by score difference" is
   * only true when this is "diff", so it is read rather than guessed from the
   * two numbers.
   */
  secondFromThird: StandingsRow["separatedBy"];
  onCopyForWhatsApp: () => void;
  /** Back to frame 17. */
  onBackToStandings: () => void;
}

/**
 * "Chizea second on 9, Timi third on 9 by score difference."
 *
 * FLAG: the clause is drawn only for a difference split. When the two are
 * separated by who got there first the frame writes no clause for it, so the
 * sentence stops at the numbers rather than inventing one. When they are on
 * different points no clause is needed at all.
 * FLAG: a court with no third place is not drawn. The sentence truncates to
 * second, which is a shorter true sentence rather than a new one.
 */
const runnersUpLine = (
  second: RunnerUpLine | null,
  third: RunnerUpLine | null,
  secondFromThird: StandingsRow["separatedBy"],
): string | null => {
  if (second == null) return null;
  const head = `${second.displayName} second on ${second.points}`;
  if (third == null) return `${head}.`;
  const tail = `${third.displayName} third on ${third.points}`;
  const clause = secondFromThird === "diff" ? " by score difference" : "";
  return `${head}, ${tail}${clause}.`;
};

export const IndividualChampion = ({
  header,
  courtNumber,
  championName,
  points,
  matchesPlayed,
  wonEveryMatch,
  second,
  third,
  secondFromThird,
  onCopyForWhatsApp,
  onBackToStandings,
}: IndividualChampionProps) => {
  const runnersUp = runnersUpLine(second, third, secondFromThird);

  return (
    <Screen style={{ background: T.deep }}>
    {header}
      <Body style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", gap: 18, padding: "0 26px", textAlign: "center",
      }}>
        <Eyebrow style={{ margin: 0 }}>Court {courtNumber} · top of the table</Eyebrow>

        <p style={{ fontFamily: T.fontHead, fontSize: 46, lineHeight: 1.08, margin: 0 }}>
          {championName}
        </p>

        <div style={{
          display: "flex", gap: 26, alignItems: "baseline",
          border: `1px solid ${BOX_LINE}`, borderRadius: 24, padding: "12px 30px",
        }}>
          <span style={{
            fontFamily: T.fontHead, fontSize: 56, lineHeight: 1,
            fontVariantNumeric: "tabular-nums", color: "#fff",
          }}>{points}</span>
          <span style={{ font: `600 14px ${T.fontBody}`, color: T.mut }}>
            {/* FLAG: a champion who dropped a match has no drawn clause here.
                The label stops at "points" rather than reporting a record the
                frame never asked for. */}
            points{wonEveryMatch ? ` · won all ${matchesPlayed}` : ""}
          </span>
        </div>

        {runnersUp != null && (
          <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>
            {runnersUp}
          </p>
        )}
      </Body>

      <DeepBar>
        <PrimaryButton onClick={onCopyForWhatsApp}>Copy for WhatsApp</PrimaryButton>
        <TertiaryButton onClick={onBackToStandings}>Back to standings</TertiaryButton>
      </DeepBar>
    </Screen>
  );
};

export default IndividualChampion;
