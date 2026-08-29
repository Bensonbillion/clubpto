import type { ReactNode } from "react";
// Frame 23: Court champions, the doubles bracket's ending.
//
// The floor drops out: this screen is --deep rather than paper, and it is the
// only playoff frame with no header and no tab bar. Centred, because this is
// the one screen someone holds up to show the room.
//
// The score is a bordered box rather than the slat. A slat says "a match is
// happening"; this one is over, and the box reads as a result.
//
// Nothing here edits the result. "Back to bracket" stays visible for exactly
// that reason: a mistyped final is fixed from the row that recorded it, and the
// bar says so.
//
// There is deliberately NO crossover final with the other court, so this screen
// never mentions one. Court 1's champion and Court 2's champions are equally
// the story of the night.

import {
  Body,
  Eyebrow,
  PrimaryButton,
  Screen,
  T,
  TertiaryButton,
} from "../../ui/primitives";
import { BOX_LINE, DeepBar } from "./DeepBar";
import { joinPair, scoreText } from "./model";

/** The losing numeral. Present, and clearly not the answer. */
const LOSING_INK = "#5c554d";

export interface ChampionProps {
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
  /** Overrides the eyebrow: the knockout reads "Sunday · knockout". */
  eyebrowLabel?: string;
  /** One quiet extra sentence: the plate champions, when there are any. */
  extraLine?: string | null;
  /** The final was a walkover: no numbers exist, and none are invented. */
  walkover?: boolean;
  /**
   * Two names, or three when the winning side was a rotating trio.
   * FLAG: only the pair is drawn. A trio joins the same way, which is the
   * smallest honest extension of "Hamid & Tumi".
   */
  championNames: readonly string[];
  /** The final's numbers. The winner's is the champions'. */
  scoreWinner: number;
  scoreLoser: number;
  /** `Chibuike & Elvis`, already joined by the caller. */
  runnerUpTeamName: string;
  onCopyForWhatsApp: () => void;
  /** Back to frame 21, every row complete. */
  onBackToBracket: () => void;
}

export const Champion = ({
  header,
  courtNumber,
  eyebrowLabel,
  extraLine,
  walkover,
  championNames,
  scoreWinner,
  scoreLoser,
  runnerUpTeamName,
  onCopyForWhatsApp,
  onBackToBracket,
}: ChampionProps) => (
  <Screen style={{ background: T.deep }}>
    {header}
    <Body style={{
      display: "flex", flexDirection: "column", justifyContent: "center",
      alignItems: "center", gap: 20, padding: "0 26px", textAlign: "center",
    }}>
      <Eyebrow style={{ margin: 0 }}>{eyebrowLabel ?? `Court ${courtNumber} · doubles bracket`}</Eyebrow>

      <p style={{ fontFamily: T.fontHead, fontSize: 44, lineHeight: 1.08, margin: 0 }}>
        {joinPair(championNames)}
      </p>

      <div style={{
        display: "flex", gap: 32, border: `1px solid ${BOX_LINE}`,
        borderRadius: 24, padding: "10px 34px",
      }}>
        {walkover ? (
          <span style={{ fontFamily: T.fontHead, fontSize: 34, lineHeight: 1.6, color: "#fff" }}>
            Walkover
          </span>
        ) : (
          <>
            <span style={{
              fontFamily: T.fontHead, fontSize: 76, lineHeight: 1,
              fontVariantNumeric: "tabular-nums", color: "#fff",
            }}>{scoreText(scoreWinner)}</span>
            <span style={{
              fontFamily: T.fontHead, fontSize: 76, lineHeight: 1,
              fontVariantNumeric: "tabular-nums", color: LOSING_INK,
            }}>{scoreText(scoreLoser)}</span>
          </>
        )}
      </div>

      <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0 }}>
        {walkover
          ? `${runnerUpTeamName} conceded the final.`
          : `Beat ${runnerUpTeamName} in the final.`}
      </p>
      {extraLine != null && extraLine !== "" && (
        <p style={{
          font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut,
          textAlign: "center", margin: "10px 0 0",
        }}>{extraLine}</p>
      )}
    </Body>

    {/* The bar is hand drawn rather than the FooterBar primitive. The primitive
        rules the bar with --line, which is a paper rule: on the --deep ground
        the frames draw a darker one, and a paper rule here would glow. */}
    <DeepBar helper="A mistyped final stays fixable from the bracket.">
      <PrimaryButton onClick={onCopyForWhatsApp}>Copy for WhatsApp</PrimaryButton>
      <TertiaryButton onClick={onBackToBracket}>Back to bracket</TertiaryButton>
    </DeepBar>
  </Screen>
);

export default Champion;
