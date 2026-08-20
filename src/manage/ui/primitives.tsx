// The manager's visual language, as the wireframes define it.
//
// Manage runs its OWN palette, taken verbatim from the :root at the top of
// docs/design/v3/wireframes-A.html. It is the Organic system in its dark
// register: warm near-black ground, cream text, sage as the action colour,
// terracotta held back for live and destructive moments. Nothing here imports
// the public site's tokens and nothing in the site should import these.
// Keeping them apart is why the manager can be restyled without touching the
// marketing pages.
//
// Three rules the frames enforce that are easy to lose in a refactor:
//   1. Anything you tap is a pill, 999px. Panels are 20 to 22, sheets are 28.
//      There is no 6px corner anywhere in this system.
//   2. Sage is a FILL, used once per screen, on the action that moves you
//      forward. If two things are sage, the screen has stopped saying which
//      one matters. Terracotta is never that fill: it means live, or it means
//      this cannot be undone.
//   3. Caprasimo carries headings, numerals and the label on the one filled
//      action. Everything else you read as a sentence is Figtree.

import type { CSSProperties, ReactNode } from "react";
import { BODY_FONT, HEADING_FONT } from "./fonts";

// The palette, verbatim from the wireframes' :root, so a change to Organic is
// a change in one place here rather than a hunt through forty screens.
const GROUND = "#171514";
const PAPER = "#221f1d";
const DEEP = "#100e0d";
const INK = "#f5ead8";
const MUT = "#c2b7a5";
const SOFT = "#a89d8c";
const ACC = "#aebf92";
const ACCD = "#56633f";
const WARM = "#e0a072";
const BAD = "#c05f36";
const LINE = "#3d3833";

// Four tones the frames use repeatedly that the :root never named. They are
// listed here rather than inlined so a screen can reach them by role.
const RAISED = "#2a2622"; // .card and .sheet, the surface that sits on paper
const EDGE = "#56504a"; // .ghost border, and frame 01's unfilled passcode slot
const CHIP_LINE = "#4a443e"; // .chip border, a lighter outline than EDGE
const NEUTRAL_FILL = "#312c28"; // .tag ground, a chip with no opinion
const OFF_BG = "#2c2825"; // .act.off, the primary action with nothing to do
const DIM = "#7d7466"; // .act.off text, the quietest legible tone on paper

export const T = {
  // SURFACES.
  //
  // `bg` is what the operator actually looks at, and in the frames that is
  // --paper: every phone body is `.ph`, and `.ph` is paper. --ground is the
  // canvas the mockups sit ON, which has no counterpart on a real phone, so it
  // is kept for anything that needs to sit behind the screen rather than being
  // the screen. --deep is the score slat and the champion screen, the two
  // places the frames deliberately drop the floor out.
  bg: PAPER,
  ground: GROUND,
  paper: PAPER,
  deep: DEEP,
  raised: RAISED,
  /** Kept from the old token set. Organic gives the sheet and the card the
   *  same raised tone, so this and `raised` are one colour by design. */
  sheet: RAISED,

  // TEXT.
  //
  // The old set was an alpha ladder on cream: ink72 down to ink45. Organic
  // names solid tones instead, and there are only three of them, so the ladder
  // collapses. It collapses in reading order, not by arithmetic: the steps a
  // screen used for body copy land on --mut, the steps it used for meta lines
  // and dimmed names land on --soft, and ink45, which screens used for the
  // quietest labels, lands on the dim tone the frames give a spent button.
  // Prefer `mut`, `soft` and `dim` in new code. The numbered keys stay because
  // screens still reference them and a rename is not this change.
  ink: INK,
  ink72: MUT,
  ink68: MUT,
  ink60: SOFT,
  ink55: SOFT,
  ink50: SOFT,
  ink45: DIM,
  mut: MUT,
  soft: SOFT,
  dim: DIM,

  // LINES.
  //
  // Organic draws every rule at one weight and one colour, --line, so the old
  // three-step hairline ladder collapses to a single value. The two that stay
  // distinct are outlines you can tap: EDGE is the ghost button and the empty
  // passcode slot, CHIP_LINE is the lighter ring around a chip.
  line: LINE,
  lineSoft: LINE,
  lineCard: LINE,
  lineDot: EDGE,
  lineChip: CHIP_LINE,
  neutralFill: NEUTRAL_FILL,

  // THE ACTION COLOUR.
  //
  // Sage, not terracotta. Read `.act` in the wireframe CSS: the one filled
  // action on every frame is background var(--acc), and terracotta appears
  // only on `.danger` and on live badges. `lime` and `limeInk` keep their old
  // names because every screen imports them; they are sage and the near-black
  // that sits on it now. `accd` is the deep sage the system offers for a
  // pressed or settled state, which no frame draws yet.
  lime: ACC,
  limeInk: DEEP,
  acc: ACC,
  accInk: DEEP,
  accd: ACCD,

  // WARM AND DESTRUCTIVE.
  //
  // Two different jobs, two different terracottas. --warm is LIVE: the badge
  // on the semifinal being played, the border on that row, and the digits of a
  // passcode that just failed. --bad is the line you draw around something
  // that cannot be undone. `red` and `redInk` keep their old names: `red` is
  // the border, `redInk` is the label, and frame 02 draws exactly that pairing
  // when it puts warm digits over a bad underline.
  warm: WARM,
  warmInk: DEEP,
  bad: BAD,
  red: BAD,
  redInk: WARM,

  // A SPENT ACTION.
  //
  // `.act.off`. The frames give a disabled primary its own two colours rather
  // than fading the live one, so a button with nothing to do reads as furniture
  // instead of as a sage button behind frosted glass.
  offBg: OFF_BG,
  offInk: DIM,

  // GEOMETRY.
  //
  // `radius` was 6 and is now 22, the corner on `.card`, because that is the
  // shape a screen reaches for when it draws a panel by hand. `radiusPanel` is
  // the slightly tighter 20 the score slat and the bracket rows use, and
  // `pill` is everything you tap.
  radius: 22,
  radiusPanel: 20,
  radiusSheet: 28,
  pill: 999,

  // TYPE.
  fontHead: HEADING_FONT,
  fontBody: BODY_FONT,
} as const;

/**
 * A numeral that is a VALUE: a score, a rank, a count, a seed. Never for
 * numerals inside a sentence, which stay in Figtree with the words.
 *
 * Caprasimo has one weight and no tabular figures of its own, so the
 * font-variant is asked for explicitly. Without it a score ticking from 09 to
 * 10 shifts the slat sideways, which is very visible at 86px.
 */
export const Num = ({ children, size = 20, style }: {
  children: ReactNode; size?: number; style?: CSSProperties;
}) => (
  <span style={{
    fontFamily: T.fontHead, fontWeight: 400, fontSize: size, lineHeight: 1,
    fontVariantNumeric: "tabular-nums", ...style,
  }}>
    {children}
  </span>
);

/**
 * `.step`. The small uppercase line that says where you are: "3 of 4",
 * "Round 2 of 3", "Court 2 · final".
 *
 * It is SAGE by default, which is the one place the accent appears without
 * being a fill. Frames that use the eyebrow as a plain section heading instead,
 * "Semifinals" on frame 21 and "Waiting, on next" on frame 10, override the
 * colour to muted at the call site.
 */
export const Eyebrow = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <p style={{
    font: `600 11.5px ${T.fontBody}`, letterSpacing: ".1em", textTransform: "uppercase",
    color: T.acc, margin: 0, ...style,
  }}>{children}</p>
);

/** The column header over a table of values, as frame 17 draws it: #, Player,
 *  P, W, L, Diff, Pts. Tighter tracking than the eyebrow and never sage, so a
 *  header row cannot be mistaken for a place in the flow. */
export const StatLabel = ({ children }: { children: ReactNode }) => (
  <p style={{
    font: `600 11px ${T.fontBody}`, letterSpacing: ".06em", textTransform: "uppercase",
    color: T.mut, margin: 0,
  }}>{children}</p>
);

/** The 390px phone column. Every frame is one of these. */
export const Screen = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{
    minHeight: "100dvh", background: T.bg, color: T.ink,
    fontFamily: T.fontBody,
    display: "flex", flexDirection: "column", boxSizing: "border-box", ...style,
  }}>{children}</div>
);

/** Scrollable middle of a frame; the footer bar sits below it. */
export const Body = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ flex: 1, minHeight: 0, overflowY: "auto", ...style }}>{children}</div>
);

export const Divider = () => <div style={{ height: 1, background: T.line }} />;

/**
 * `.card`. A raised panel on paper.
 *
 * "live" is `.card.hi`, the sage 2px border the frames put on the thing
 * happening now. "danger" is the same weight in terracotta. Both are borders
 * rather than fills, because a filled card would take the one fill the screen
 * has already spent on its action.
 */
export const Card = ({ children, style, tone }: {
  children: ReactNode; style?: CSSProperties; tone?: "plain" | "live" | "danger";
}) => (
  <div style={{
    background: T.raised,
    border: tone === "live" ? `2px solid ${T.acc}`
      : tone === "danger" ? `2px solid ${T.bad}`
      : `1.5px solid ${T.line}`,
    borderRadius: T.radius, padding: "16px 18px",
    display: "flex", flexDirection: "column", gap: 8,
    boxSizing: "border-box",
    ...style,
  }}>{children}</div>
);

type BtnProps = {
  children: ReactNode; onClick?: () => void; disabled?: boolean;
  style?: CSSProperties; type?: "button" | "submit";
};

/**
 * `.act`. The one filled thing on a screen, in sage, wearing Caprasimo.
 *
 * The display face on a button label is the exception to "Caprasimo is for
 * numerals and headings", and the frames are unanimous about it: every `.act`
 * in the set is font-family var(--font-heading). It is what makes the forward
 * action read as the sentence the screen is ending on.
 */
export const PrimaryButton = ({ children, onClick, disabled, style, type = "button" }: BtnProps) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    minHeight: 56, width: "100%", border: "none", borderRadius: T.pill,
    background: disabled ? T.offBg : T.acc, color: disabled ? T.offInk : T.accInk,
    fontFamily: T.fontHead, fontWeight: 400, fontSize: 18, padding: "8px 16px",
    cursor: disabled ? "default" : "pointer", ...style,
  }}>{children}</button>
);

/**
 * `.ghost`. An outline in Figtree, for the action that is real but is not the
 * one the screen is asking for: "Session summary", "Add a walk-in", "Copy for
 * WhatsApp first".
 *
 * The frames never draw a disabled ghost, so the fade is this file's own
 * decision rather than a frame's.
 */
export const SecondaryButton = ({ children, onClick, disabled, style }: BtnProps) => (
  <button type="button" onClick={onClick} disabled={disabled} style={{
    minHeight: 52, width: "100%", borderRadius: T.pill,
    border: `1.5px solid ${T.lineDot}`, background: "transparent", color: T.ink,
    font: `600 16px ${T.fontBody}`, opacity: disabled ? 0.45 : 1,
    cursor: disabled ? "default" : "pointer", padding: "8px 16px", ...style,
  }}>{children}</button>
);

/**
 * `.quiet`. The way out: "Keep it", "Back to bracket", "Keep playing".
 *
 * No border, no underline. The old primitive underlined it; Organic does not,
 * and an underline here would give the escape hatch more weight than the two
 * buttons above it.
 */
export const TertiaryButton = ({ children, onClick, style }: BtnProps) => (
  <button type="button" onClick={onClick} style={{
    minHeight: 46, width: "100%", border: "none", background: "transparent",
    color: T.mut, font: `600 15px ${T.fontBody}`, cursor: "pointer", ...style,
  }}>{children}</button>
);

/**
 * The irreversible action, in terracotta OUTLINE.
 *
 * Frame 28 fills it. This codebase does not, and that is deliberate: on a
 * confirm sheet the weighting inverts, so the safe action is the filled one
 * and the destructive one is only ever an outline. Voiding a result at 9pm on
 * a phone in a sports hall has to cost a beat more attention than keeping it.
 * Do not let this drift back to a fill.
 */
export const DangerButton = ({ children, onClick, style }: BtnProps) => (
  <button type="button" onClick={onClick} style={{
    minHeight: 56, width: "100%", borderRadius: T.pill,
    border: `2px solid ${T.bad}`, background: "transparent", color: T.redInk,
    fontFamily: T.fontHead, fontWeight: 400, fontSize: 17,
    cursor: "pointer", ...style,
  }}>{children}</button>
);

/**
 * `.bar`. Footer action bar: one helper line, then the action. Identical on
 * every frame that has one, so if a screen needs a different footer it is a
 * different screen.
 *
 * The helper is centred. It is the only body copy in the manager that is, and
 * it is centred in every frame that draws one, because it is a caption under
 * the button rather than something you read left to right.
 */
export const FooterBar = ({ helper, children }: { helper?: ReactNode; children: ReactNode }) => (
  <div style={{
    marginTop: "auto", padding: "16px 18px 20px", borderTop: `1px solid ${T.line}`,
    display: "flex", flexDirection: "column", gap: 10,
  }}>
    {helper != null && (
      <p style={{
        font: `400 14.5px/1.45 ${T.fontBody}`, color: T.mut, margin: 0,
        textAlign: "center", textWrap: "pretty",
      }}>{helper}</p>
    )}
    {children}
  </div>
);

export type Tab = "match" | "players" | "standings";

/**
 * The three tabs of a live night.
 *
 * The active one is marked by a 3px sage rule ALONG THE TOP, not by a fill.
 * Every tab reserves that 3px whether or not it is active, so switching tabs
 * moves the mark and never the labels.
 */
export const TabBar = ({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) => (
  <div style={{ display: "flex", borderTop: `1px solid ${T.line}`, background: T.paper }}>
    {([["match", "Match"], ["players", "Players"], ["standings", "Standings"]] as const).map(([id, label]) => (
      <button key={id} type="button" onClick={() => onChange(id)} style={{
        flex: 1, minHeight: 60, border: "none", background: "transparent", cursor: "pointer",
        borderTop: `3px solid ${active === id ? T.acc : "transparent"}`,
        color: active === id ? T.ink : T.soft,
        font: `${active === id ? 700 : 600} 14px ${T.fontBody}`,
      }}>{label}</button>
    ))}
  </div>
);

/**
 * Bottom sheet over a dark scrim.
 *
 * The scrim is rgba(10,8,7,.66), a near-black wash: the old one lifted the
 * screen toward cream, which on this palette read as a flash rather than as
 * the room going quiet. The sheet is marked by a 2px top border, sage as
 * standard and terracotta when what is inside cannot be undone, and the frames
 * draw no grab handle, so there is none here.
 */
export const Sheet = ({ children, onDismiss, tone }: {
  children: ReactNode; onDismiss: () => void; tone?: "plain" | "danger";
}) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column" }}>
    <div onClick={onDismiss} style={{ flex: 1, background: "rgba(10,8,7,.66)" }} />
    <div style={{
      background: T.raised,
      borderTopLeftRadius: T.radiusSheet, borderTopRightRadius: T.radiusSheet,
      borderTop: `2px solid ${tone === "danger" ? T.bad : T.acc}`,
      padding: "20px 18px 22px", display: "flex", flexDirection: "column", gap: 12,
    }}>
      {children}
    </div>
  </div>
);

/**
 * Frame 01's pad. Four digits, no submit, because the fourth digit verifies.
 *
 * The keys are round, full width, and 62px tall, which is what lets a thumb
 * find them without looking. Delete loses its ring rather than gaining a
 * colour: it is the only key you can press by mistake without consequence.
 */
export const Keypad = ({ onDigit, onDelete, disabled }: {
  onDigit: (d: string) => void; onDelete: () => void; disabled?: boolean;
}) => (
  <div style={{
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "0 22px 30px",
  }}>
    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
      k === "" ? <div key={i} /> : k === "del" ? (
        <button key={i} type="button" onClick={onDelete} disabled={disabled} aria-label="Delete"
          style={{
            minHeight: 62, border: "none", borderRadius: T.pill, background: "transparent",
            color: T.ink, font: `600 15px ${T.fontBody}`, cursor: "pointer",
          }}>Delete</button>
      ) : (
        <button key={i} type="button" onClick={() => onDigit(k)} disabled={disabled}
          style={{
            minHeight: 62, border: `1px solid ${T.line}`, borderRadius: T.pill,
            background: "transparent", color: T.ink, cursor: "pointer",
            fontFamily: T.fontHead, fontWeight: 400, fontSize: 26,
          }}>{k}</button>
      ))}
  </div>
);

/**
 * The passcode row. Four 56x64 slots, each on a 3px rule that turns sage as it
 * is filled, which is frame 01's geometry rather than the old row of dots.
 *
 * `digits` is optional and unmasked: pass it and the slots show what was typed,
 * exactly as frame 01 draws it. Leave it out and a filled slot shows a mark
 * instead, which is the safer default for a code read over someone's shoulder.
 * `tone` covers frame 02, where a rejected code turns the rules terracotta and
 * the digits warm, and stays on screen so the operator can see what they typed.
 */
export const Dots = ({ filled, of = 4, digits, tone = "plain" }: {
  filled: number; of?: number; digits?: string; tone?: "plain" | "error";
}) => (
  <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
    {Array.from({ length: of }, (_, i) => {
      const on = i < filled;
      const mark = tone === "error" ? T.warm : T.acc;
      return (
        <div key={i} style={{
          width: 56, height: 64, boxSizing: "border-box",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderBottom: `3px solid ${tone === "error" ? T.bad : on ? T.acc : T.lineDot}`,
        }}>
          {digits != null ? (
            <span style={{
              fontFamily: T.fontHead, fontWeight: 400, fontSize: 46, lineHeight: 1.25,
              fontVariantNumeric: "tabular-nums", color: tone === "error" ? T.warm : T.ink,
            }}>{digits[i] ?? ""}</span>
          ) : on ? (
            <div style={{ width: 18, height: 18, borderRadius: T.pill, background: mark }} />
          ) : null}
        </div>
      );
    })}
  </div>
);

/**
 * `.tag`. The small pill that labels a person or a pair without becoming an
 * action: a tier, a seed, "In", "Booked", "Live".
 *
 * Four tones, and the default matters most. Most players have no assessed
 * tier, so "Not assessed" is the label this renders more than any other, and
 * it must read as an absence rather than a flag. That is what "quiet" is: no
 * fill at all, muted text, which is how frame 14 already writes the same words
 * in a status line. "neutral" is the grey chip frames 06 and 07 give a tier or
 * a seed, "accent" is `.tag.gr`, the sage "In", and "live" is `.tag.wm`, the
 * terracotta "Live" and "Score due" that mark the one thing happening now.
 *
 * "sm" is the inline size, for a tag sitting INSIDE a chip or a bracket row
 * where it labels the name beside it rather than standing on its own.
 */
export type TagTone = "neutral" | "accent" | "live" | "quiet";

export const Tag = ({ children, tone = "neutral", size = "md", style }: {
  children: ReactNode; tone?: TagTone; size?: "sm" | "md"; style?: CSSProperties;
}) => (
  <span style={{
    display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
    borderRadius: T.pill, letterSpacing: ".04em", textTransform: "uppercase",
    fontFamily: T.fontBody, fontWeight: 600,
    fontSize: size === "sm" ? 10 : 11.5,
    padding: size === "sm" ? "1px 8px" : "4px 11px",
    background: tone === "accent" ? T.acc
      : tone === "live" ? T.warm
      : tone === "quiet" ? "transparent"
      : T.neutralFill,
    color: tone === "accent" || tone === "live" ? T.accInk
      : tone === "quiet" ? T.soft
      : T.mut,
    ...style,
  }}>{children}</span>
);
