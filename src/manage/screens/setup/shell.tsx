// Shared chrome for the setup wizard (frames 05 to 09).
//
// v3 collapses the wizard's chrome down to one thing, `.hd`: the question on
// the left, the step eyebrow on the right, and a `.why` line under it saying
// what the answer is for. There is no top bar, no divider and no progress rail
// on any of the five frames, so none of that is drawn here either.
//
// The old SETUP token bag is gone with it. Every value in it was an alpha on
// cream, and Organic names solid tones instead, so each one now has a real
// token in T and a screen that reaches for a colour reaches for T.

import type { CSSProperties, ReactNode } from "react";
import { Eyebrow, T } from "../../ui/primitives";

/**
 * `.hd` plus `.why`'s neighbour: the wizard's title row.
 *
 * `step` is the eyebrow's exact words, "1 of 4" through "4 of 4" and then
 * "Setup done" on frame 09, because the fifth screen is a review rather than a
 * fifth question and the frames say so in the eyebrow.
 *
 * Back is the one thing here no frame draws, and keeping it is this file's
 * decision rather than a frame's. The wizard is four decisions deep, every one
 * of them reversible at no cost, and a mis-tap on step 2 has to be fixable on
 * the phone instead of by abandoning the night. It sits above the question in
 * muted body text so it never competes with the thing the screen is asking,
 * and it is omitted entirely when the caller has nowhere to go back to.
 */
export const SetupHeader = ({ title, step, onBack }: {
  title: string; step: string; onBack?: () => void;
}) => (
  <>
    {onBack != null && (
      <div style={{ padding: "12px 22px 0" }}>
        <button type="button" onClick={onBack} style={{
          minHeight: 44, border: "none", background: "transparent", padding: 0,
          color: T.mut, font: `600 15px ${T.fontBody}`, cursor: "pointer",
        }}>Back</button>
      </div>
    )}
    <div style={{
      padding: onBack != null ? "4px 22px 8px" : "24px 22px 8px",
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10,
    }}>
      <h1 style={{
        fontFamily: T.fontHead, fontWeight: 400, fontSize: 25, lineHeight: 1.15,
        letterSpacing: "-.015em", margin: 0,
      }}>{title}</h1>
      <Eyebrow style={{ flexShrink: 0 }}>{step}</Eyebrow>
    </div>
  </>
);

/** `.why`. The one line under the question that says what the answer is for. */
export const Why = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <p style={{
    font: `400 15px/1.5 ${T.fontBody}`, color: T.mut, padding: "0 22px",
    margin: "8px 0 0", textWrap: "pretty", ...style,
  }}>{children}</p>
);

/**
 * `.chip`. The tappable pill the wizard uses for every choice: a night on
 * frame 05, a court count on frame 07, a player on frame 07's court cards.
 *
 * `.chip.on` is a sage FILL, which is the one place the wizard spends the
 * accent other than the footer button, and it can because a selected chip and
 * the forward action never sit in the same band of the screen.
 */
export const Chip = ({ children, on, dashed, radio, onClick, style }: {
  children: ReactNode; on?: boolean; dashed?: boolean;
  /** Marks the chip as one option of a set, so a screen reader reads the fill. */
  radio?: boolean;
  onClick?: () => void; style?: CSSProperties;
}) => {
  const skin: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    minHeight: 42, padding: "6px 16px", borderRadius: T.pill,
    border: `1.5px ${dashed ? "dashed" : "solid"} ${on ? T.acc : T.lineChip}`,
    background: on ? T.acc : "transparent",
    color: on ? T.accInk : dashed ? T.mut : T.ink,
    font: `600 15px ${T.fontBody}`, boxSizing: "border-box", ...style,
  };
  return onClick == null
    ? <span style={skin}>{children}</span>
    : (
      <button
        type="button"
        role={radio ? "radio" : undefined}
        aria-checked={radio ? Boolean(on) : undefined}
        onClick={onClick}
        style={{ ...skin, cursor: "pointer" }}
      >{children}</button>
    );
};
