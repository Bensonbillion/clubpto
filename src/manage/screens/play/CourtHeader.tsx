// The header every live screen opens with: the courts as chips, and the night
// menu behind the ellipsis (frames 10 and 12).
//
// The courts are chips rather than a dropdown because both courts run at once
// on one phone and the flip has to be free. A menu costs two taps and hides
// the other court's state behind the first of them; a chip row costs one and
// shows the state without being opened at all.
//
// The terracotta dot is that state. It rides the chip of any court that has
// finished a match with no score in it, which is the only thing about the
// other court the operator ever has to act on mid-rally.

import { T } from "../../ui/primitives";
import type { CourtChip } from "./model";

export interface CourtHeaderProps {
  courts: CourtChip[];
  activeCourtNumber: number;
  onSelectCourt: (courtNumber: number) => void;
  /** Opens the night menu, frame 25b. */
  onOpenNightMenu: () => void;
}

const CHIP = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 40,
  borderRadius: T.pill,
  cursor: "pointer",
  fontFamily: T.fontHead,
  fontWeight: 400,
} as const;

export const CourtHeader = ({
  courts,
  activeCourtNumber,
  onSelectCourt,
  onOpenNightMenu,
}: CourtHeaderProps) => (
  <div
    style={{
      padding: "24px 22px 0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    }}
  >
    <div style={{ display: "flex", gap: 8 }}>
      {courts.map((court) => {
        const on = court.number === activeCourtNumber;
        return (
          <button
            key={court.number}
            type="button"
            onClick={() => onSelectCourt(court.number)}
            style={{
              ...CHIP,
              gap: 8,
              padding: "4px 16px",
              fontSize: 16,
              border: `1.5px solid ${on ? T.acc : T.lineChip}`,
              background: on ? T.acc : "transparent",
              color: on ? T.accInk : T.ink,
            }}
          >
            Court {court.number}
            {court.scoreDue && (
              <span
                aria-label="Score due"
                style={{ width: 8, height: 8, borderRadius: T.pill, background: T.warm }}
              />
            )}
          </button>
        );
      })}
    </div>

    <button
      type="button"
      onClick={onOpenNightMenu}
      aria-label="Night menu"
      style={{
        ...CHIP,
        justifyContent: "center",
        padding: "4px 15px",
        fontSize: 18,
        border: `1.5px solid ${T.lineChip}`,
        background: "transparent",
        color: T.ink,
      }}
    >
      &#8943;
    </button>
  </div>
);
