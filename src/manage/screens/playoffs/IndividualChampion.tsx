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

import { sayableSeparation, type StandingsRow } from "../../engine/standings";
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
  /**
   * Replaces "Court N · top of the table" when the table spans every
   * court, as a teams night's does: "Sunday · teams · top of the table".
   */
  eyebrowLabel?: string;
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
 *
 * "level" (engine/standings.ts, 2026-09-15) is the case where second and third
 * were separated by nothing at all: same points, same difference, same match
 * they reached the total in, and their order is the table's deterministic
 * backstop. It writes no clause either, and it is the one place in this sweep
 * where silence costs something real. "Chizea second on 9, Timi third on 9."
 * is true, and it is all the frame draws, but the room would be interested to
 * know the two of them finished dead level. Saying so needs copy frame 24 does
 * not have, and this screen does not invent copy, so it stops at the numbers.
 * Worth raising the next time the frame is opened.
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
  // Frame 24 draws a clause for a difference split and for nothing else. The
  // engine can also say "level", two rows with the same points, the same
  // difference and the same match reached in, and this is the one screen
  // where saying so beats silence: two equal numbers on a champion screen
  // read as if the order meant something, and here it does not. The owner
  // chose the words on 2026-09-19. It is the only invented clause on this
  // screen, and it is pinned as a sentence in frame-24-runners-up.test.tsx.
  // An order break still gets no clause, because the frame draws none.
  const clause = sayableSeparation(secondFromThird) === "diff" ? " by score difference"
    : secondFromThird === "level" ? ", nothing between them"
      : "";
  return `${head}, ${tail}${clause}.`;
};

export const IndividualChampion = ({
  header,
  courtNumber,
  eyebrowLabel,
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
        <Eyebrow style={{ margin: 0 }}>{eyebrowLabel ?? `Court ${courtNumber} · top of the table`}</Eyebrow>

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
