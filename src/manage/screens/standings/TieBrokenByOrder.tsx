// Frame 18: Tie, first to this score.
//
// It explains; it decides nothing. There is no accept, no override and no flip,
// which is why the screen carries no action at all: the way out is the tab bar,
// the same one the standings table sits behind.
//
// This used to be a bottom sheet with a "Got it" button. Frame 18 draws a full
// screen with the Standings tab still lit, and that is the truer shape: a sheet
// implies a decision waiting on the operator, and nothing here is waiting.
//
// Compose it over frame 17:
//   <StandingsTab … onOpenTie={setTie} />
//   {tie && <TieBrokenByOrder … onSelectTab={t => { setTie(null); setTab(t); }} />}

import {
  Body,
  Card,
  Num,
  Screen,
  T,
  TabBar,
  type Tab,
} from "../../ui/primitives";
import { ScreenHead } from "./ScreenHead";

export interface TieSide {
  displayName: string;
  /** Where this player sits in the table, 1-based. The numeral on the row. */
  position: number;
  /** Level with the other side, by definition. Drawn on the right of the row. */
  points: number;
  /** Formatted by the caller, as frame 18 draws it: "8:41". */
  winRecordedAtLabel: string;
}

export interface TieBrokenByOrderProps {
  /** The eyebrow, e.g. "Court 2". */
  courtLabel: string;
  /** Placed higher: got there first. */
  higher: TieSide;
  /** Placed lower: reached the same total later. */
  lower: TieSide;
  /** Signed, and shared by both sides, which is what makes this a tie at all. */
  pointDifference: number;
  onSelectTab: (t: Tab) => void;
}

// FLAG: three or more players level on both keys is not drawn. Two rows is what
// the card supports, and no copy exists for a third.
// FLAG: no empty, loading or error state. This screen only ever opens on a tie
// that already exists in loaded standings data.

// Frame 18 reads "at minus 2", spelling the sign because it sits inside a
// sentence rather than in a column.
// FLAG: only the negative form is drawn. "plus" and "zero" are this file's
// inference from it, and they are the only words invented on this screen.
const diffPhrase = (diff: number): string =>
  diff < 0 ? `minus ${Math.abs(diff)}` : diff > 0 ? `plus ${diff}` : "zero";

// FLAG: frame 18 draws "fifth". Anything past twelfth is not drawn, so it falls
// back to the numeral with its suffix rather than inventing a longer word list.
const ORDINALS = [
  "", "first", "second", "third", "fourth", "fifth", "sixth",
  "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
];
const ordinalWord = (n: number): string => ORDINALS[n] ?? `${n}th`;

const TieRow = ({ side, tone, divided }: {
  side: TieSide;
  /** The higher row's time is sage, the lower row's is muted. */
  tone: "higher" | "lower";
  divided: boolean;
}) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
    borderBottom: divided ? `1px solid ${T.line}` : "none",
  }}>
    <Num size={19} style={{ color: T.acc, width: 22 }}>{side.position}</Num>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ font: `600 16px ${T.fontBody}`, margin: 0 }}>{side.displayName}</p>
      <p style={{
        font: `400 13.5px ${T.fontBody}`,
        color: tone === "higher" ? T.acc : T.mut,
        margin: "2px 0 0",
      }}>Win recorded {side.winRecordedAtLabel}</p>
    </div>
    <Num size={22}>{side.points}</Num>
  </div>
);

export const TieBrokenByOrder = ({
  courtLabel, higher, lower, pointDifference, onSelectTab,
}: TieBrokenByOrderProps) => (
  <Screen>
    <ScreenHead title="Level on both" step={courtLabel} />

    <Body style={{ padding: "16px 22px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* The sage border is the frame's way of saying these two rows are the
          subject of the screen. Nothing else on it is highlighted. */}
      <Card tone="live" style={{ padding: 0, gap: 0, overflow: "hidden" }}>
        <TieRow side={higher} tone="higher" divided />
        <TieRow side={lower} tone="lower" divided={false} />
      </Card>

      <Card>
        <p style={{ fontFamily: T.fontHead, fontSize: 17, margin: "0 0 8px" }}>
          No flip, no judgment call
        </p>
        <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>
          Both are on {higher.points} points at {diffPhrase(pointDifference)}. Whoever
          reached that score first is placed higher, so {higher.displayName} sits{" "}
          {ordinalWord(higher.position)} and the row says why.
        </p>
      </Card>

      <p style={{ font: `400 14px/1.6 ${T.fontBody}`, color: T.soft, margin: 0 }}>
        The reason stays on the row for the rest of the night.
      </p>
    </Body>

    <TabBar active="standings" onChange={onSelectTab} />
  </Screen>
);

export default TieBrokenByOrder;
