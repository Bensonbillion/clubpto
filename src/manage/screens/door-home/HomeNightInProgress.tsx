// Frame 04. Home, night in progress.
//
// The same door as frame 03 with one card added: the night's name, a live
// badge, and a single sentence saying where each court has got to. That
// sentence is the whole status display. The stat row this screen used to draw,
// three padded numerals for in, played and left, is gone, because the operator
// coming back to the phone wants to know which court needs them, not the
// night's arithmetic.

import { Body, Card, Eyebrow, FooterBar, PrimaryButton, Screen, T, Tag, TertiaryButton } from "../../ui/primitives";

/**
 * What one court is doing, in the two shapes the frame's sentence has words
 * for. A union rather than a record of optional fields, because a court cannot
 * be mid-round and waiting on a score at once and the type should not let a
 * caller say it is.
 *
 * A court that is idle, nobody on it and nothing owed, has no clause drawn for
 * it anywhere in the frames. Leave it out of the array and the sentence simply
 * does not mention it.
 */
export type CourtActivity =
  | { courtNumber: number; state: "playing"; round: number }
  | { courtNumber: number; state: "waitingOnScore" };

export interface HomeNightInProgressProps {
  /** `Wednesday`. Titles the card, under the club's name. */
  dayName: string;
  /**
   * The courts, in court order. Renders as the frame's own sentence:
   * "Court 1 round 2, Court 2 waiting on a score." Empty means there is
   * nothing to say, and then no sentence is drawn.
   */
  courts?: CourtActivity[];
  /** Holds the whole card back. The club's name paints immediately. */
  loading?: boolean;
  /** "Manager 2" above the club's name on the second manager. Omitted on the first. */
  instanceLabel?: string;
  /** → frame 10 `Court view`, opened on the court that needs attention. */
  onResume: () => void;
  /** → frame 05. Must not delete or void the in-progress night's results. */
  onStartDifferentNight: () => void;
  /**
   * Opens the night menu (frame 25b) without resuming. The frame says the menu
   * is "one tap away from any screen, either court, all night", and Home is a
   * screen: ending or resetting a night must not require walking back into it.
   */
  onOpenNightMenu?: () => void;
}

/** One court's clause. The frame writes these two and no others. */
const clause = (c: CourtActivity): string =>
  c.state === "playing"
    ? `Court ${c.courtNumber} round ${c.round}`
    : `Court ${c.courtNumber} waiting on a score`;

export const HomeNightInProgress = ({
  dayName,
  courts = [],
  loading,
  onResume,
  onStartDifferentNight,
  onOpenNightMenu,
  instanceLabel,
}: HomeNightInProgressProps) => {
  const sentence = courts.length > 0 ? `${courts.map(clause).join(", ")}.` : null;

  return (
    <Screen>
      <Body style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "0 26px", gap: 20, boxSizing: "border-box",
      }}>
        {instanceLabel && <Eyebrow>{instanceLabel}</Eyebrow>}
        <p style={{
          fontFamily: T.fontHead, fontWeight: 400, fontSize: 42, lineHeight: 1.05, margin: 0,
        }}>Club PTO</p>

        {!loading && (
          <Card tone="live" style={{ gap: 0 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10,
            }}>
              <span style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 20 }}>
                {dayName}
              </span>
              <Tag tone="live">Live</Tag>
            </div>

            {sentence != null && (
              <p style={{
                font: `400 15px/1.5 ${T.fontBody}`, color: T.mut, margin: "10px 0 0",
                textWrap: "pretty",
              }}>{sentence}</p>
            )}
          </Card>
        )}
      </Body>

      <FooterBar>
        <PrimaryButton onClick={onResume}>Resume the night</PrimaryButton>
        <TertiaryButton onClick={onStartDifferentNight}>Start a different night</TertiaryButton>
        {onOpenNightMenu && (
          <TertiaryButton onClick={onOpenNightMenu}>Night menu</TertiaryButton>
        )}
      </FooterBar>
    </Screen>
  );
};
