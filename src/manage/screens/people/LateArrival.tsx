// Frame 15, Late arrival.
//
// A sheet, not a screen: the operator is adding somebody while a match runs
// behind them, and the night should not disappear to do it.
//
// The consequence paragraph is body text on purpose. It is the thing that
// stops a bad tap, so it is not fine print, and it names the two facts an
// operator would otherwise have to work out on the spot: nobody already
// playing loses a match, and the target moves so the new headcount still
// divides into fours.
//
// The tier row defaults to "Not set" and says who can see it. Setting a tier
// is an assessment somebody made, so the sheet never picks one: a walk-in
// nobody has watched play is exactly the person a guessed tier would misplace,
// and the balance rule would then act on a judgement that was never made.

import type { CSSProperties } from "react";
import { PrimaryButton, Sheet, T } from "../../ui/primitives";

export type LateArrivalTier = "A" | "B" | "C";

export interface LateArrivalCourt {
  courtNumber: number;
  /** "Court 1", "Court 2" ... */
  label: string;
  /** Players on that court BEFORE this one joins, which is what the chip
   *  shows and what the sentence counts up from. */
  playingCount: number;
}

export interface LateArrivalProps {
  /** The typed name. Data, not fixed copy. */
  name: string;
  onNameChange: (name: string) => void;
  /** Tonight's tier for this walk-in. Null is "Not set", and the default. */
  tier: LateArrivalTier | null;
  onSelectTier: (tier: LateArrivalTier | null) => void;
  courts: LateArrivalCourt[];
  /**
   * Preselect the court with the fewest players; break ties by lowest court
   * number. Null before the counts resolve.
   */
  selectedCourtNumber: number | null;
  onSelectCourt: (courtNumber: number) => void;
  /**
   * The chosen court's target once this player joins, or null when it does not
   * move. Frame 15 draws the moving case, "the target moves to 4 so nine
   * players still divide"; with nothing to move, that clause drops and the
   * sentence ends at "Nobody loses a match."
   */
  targetAfter: number | null;
  /** Dismisses the sheet. Frame 15 draws no cancel button, so the scrim is it. */
  onCancel: () => void;
  onAdd: () => void;
}

/** Frame 15's order: the absence first, then the tiers newest to strongest. */
const TIERS: readonly { label: string; value: LateArrivalTier | null }[] = [
  { label: "Not set", value: null },
  { label: "C", value: "C" },
  { label: "B", value: "B" },
  { label: "A", value: "A" },
];

const SECTION_LABEL: CSSProperties = {
  font: `600 11.5px ${T.fontBody}`,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: T.mut,
  margin: "4px 0 0",
};

const CHIP: CSSProperties = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 16px",
  borderRadius: T.pill,
  fontFamily: T.fontBody,
  fontWeight: 600,
  cursor: "pointer",
};

const chipTone = (on: boolean): CSSProperties => ({
  border: `1.5px solid ${on ? T.acc : T.lineChip}`,
  background: on ? T.acc : "transparent",
  color: on ? T.accInk : T.ink,
});

export const LateArrival = ({
  name,
  onNameChange,
  tier,
  onSelectTier,
  courts,
  selectedCourtNumber,
  onSelectCourt,
  targetAfter,
  onCancel,
  onAdd,
}: LateArrivalProps) => {
  const selected = courts.find((c) => c.courtNumber === selectedCourtNumber) ?? null;
  const typed = name.trim().length > 0;
  const ready = typed && selected != null;

  const consequence =
    selected == null
      ? null
      : `${name} joins the ${selected.label} queue at zero games and gets the next open slot. ` +
        (targetAfter == null
          ? "Nobody loses a match."
          : `Nobody loses a match, and the target moves to ${targetAfter} so ` +
            `${selected.playingCount + 1} players still divide.`);

  return (
    <Sheet onDismiss={onCancel}>
      <p style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, margin: 0 }}>
        Add a walk-in
      </p>

      <input
        value={name}
        autoFocus
        onChange={(e) => onNameChange(e.target.value)}
        aria-label="Name"
        style={{
          border: `1.5px solid ${T.acc}`,
          borderRadius: T.pill,
          minHeight: 52,
          width: "100%",
          boxSizing: "border-box",
          padding: "0 18px",
          background: "transparent",
          color: T.ink,
          outline: "none",
          font: `600 16px ${T.fontBody}`,
        }}
      />

      <p style={SECTION_LABEL}>Tier tonight &middot; only you see this</p>

      <div style={{ display: "flex", gap: 8 }}>
        {TIERS.map(({ label, value }) => {
          const on = value === tier;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelectTier(value)}
              // Four chips across 390px leaves "Not set" too little room at the
              // chip's usual 16px padding, and it broke over two lines. The
              // padding gives way rather than the words.
              style={{
                ...CHIP, minHeight: 44, fontSize: 14, padding: "6px 8px",
                whiteSpace: "nowrap", ...chipTone(on),
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p style={SECTION_LABEL}>Which court</p>

      <div style={{ display: "flex", gap: 10 }}>
        {courts.map((court) => {
          const on = court.courtNumber === selectedCourtNumber;
          return (
            <button
              key={court.courtNumber}
              type="button"
              onClick={() => onSelectCourt(court.courtNumber)}
              style={{ ...CHIP, minHeight: 52, fontSize: 15, ...chipTone(on) }}
            >
              {court.label} &middot; {court.playingCount}
            </button>
          );
        })}
      </div>

      {/* Before a name is typed the sentence would have a hole in it, and frame
          15 draws no wording for that state, so it waits. */}
      {ready && consequence != null && (
        <p style={{ font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: "2px 0 0", textWrap: "pretty" }}>
          {consequence}
        </p>
      )}

      {/* The spent state has no label of its own in the frame, so it falls back
          to this sheet's own title rather than printing "Add  to ". */}
      <PrimaryButton disabled={!ready} onClick={onAdd}>
        {ready && selected != null ? `Add ${name} to ${selected.label}` : "Add a walk-in"}
      </PrimaryButton>
    </Sheet>
  );
};
