// The manager's visual language, as the wireframes define it.
//
// Manage runs its OWN palette — ground #0E2418, lime #D9E270 — not the public
// site's #1A1A1A/gold. Nothing here imports the site's tokens, and nothing in
// the site should import these. Keeping them apart is why the manager can be
// restyled without touching the marketing pages.
//
// Two rules the frames enforce that are easy to lose in a refactor:
//   1. Radius is 6px on everything. Only dots and pills are 999px.
//   2. Lime is a FILL, used once per screen, on the action that moves you
//      forward. If two things are lime, the screen has stopped saying which
//      one matters.

import type { CSSProperties, ReactNode } from "react";

export const T = {
  bg: "#0E2418",
  ink: "#F4EDE0",
  ink72: "rgba(244,237,224,.72)",
  ink68: "rgba(244,237,224,.68)",
  ink60: "rgba(244,237,224,.6)",
  ink55: "rgba(244,237,224,.55)",
  ink50: "rgba(244,237,224,.5)",
  ink45: "rgba(244,237,224,.45)",
  line: "rgba(244,237,224,.18)",
  lineSoft: "rgba(244,237,224,.12)",
  lineCard: "rgba(244,237,224,.14)",
  lineDot: "rgba(244,237,224,.28)",
  lime: "#D9E270",
  limeInk: "#0A1810",
  red: "#EF4444",
  redInk: "#FF9382",
  sheet: "#173724",
  radius: 6,
} as const;

/** A numeral that is a VALUE. Never for numerals inside a sentence. */
export const Num = ({ children, size = 20, style }: {
  children: ReactNode; size?: number; style?: CSSProperties;
}) => (
  <span style={{ fontFamily: "VT323, ui-monospace, monospace", fontSize: size, lineHeight: 1, ...style }}>
    {children}
  </span>
);

export const Eyebrow = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <p style={{
    font: "800 11px Inter, sans-serif", letterSpacing: ".12em", textTransform: "uppercase",
    color: T.ink45, margin: 0, ...style,
  }}>{children}</p>
);

export const StatLabel = ({ children }: { children: ReactNode }) => (
  <p style={{
    font: "700 12px Inter, sans-serif", letterSpacing: ".08em", textTransform: "uppercase",
    color: T.ink45, margin: 0,
  }}>{children}</p>
);

/** The 390px phone column. Every frame is one of these. */
export const Screen = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{
    minHeight: "100dvh", background: T.bg, color: T.ink,
    fontFamily: "Inter, system-ui, sans-serif",
    display: "flex", flexDirection: "column", boxSizing: "border-box", ...style,
  }}>{children}</div>
);

/** Scrollable middle of a frame; the footer bar sits below it. */
export const Body = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ flex: 1, minHeight: 0, overflowY: "auto", ...style }}>{children}</div>
);

export const Divider = () => <div style={{ height: 1, background: T.lineSoft }} />;

export const Card = ({ children, style, tone }: {
  children: ReactNode; style?: CSSProperties; tone?: "plain" | "danger";
}) => (
  <div style={{
    border: tone === "danger" ? `2px solid ${T.red}` : `1px solid ${T.lineCard}`,
    borderRadius: T.radius, padding: 14, display: "flex", flexDirection: "column", gap: 8,
    ...style,
  }}>{children}</div>
);

type BtnProps = {
  children: ReactNode; onClick?: () => void; disabled?: boolean;
  style?: CSSProperties; type?: "button" | "submit";
};

/** The one filled thing on a screen. */
export const PrimaryButton = ({ children, onClick, disabled, style, type = "button" }: BtnProps) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    height: 58, width: "100%", border: "none", borderRadius: T.radius,
    background: T.lime, color: T.limeInk, font: "700 19px Inter, sans-serif",
    opacity: disabled ? 0.45 : 1, cursor: disabled ? "default" : "pointer", ...style,
  }}>{children}</button>
);

export const SecondaryButton = ({ children, onClick, disabled, style }: BtnProps) => (
  <button type="button" onClick={onClick} disabled={disabled} style={{
    minHeight: 56, width: "100%", borderRadius: T.radius,
    border: `2px solid ${T.ink}`, background: "transparent", color: T.ink,
    font: "600 17px Inter, sans-serif", opacity: disabled ? 0.45 : 1,
    cursor: disabled ? "default" : "pointer", padding: "0 20px", ...style,
  }}>{children}</button>
);

export const TertiaryButton = ({ children, onClick, style }: BtnProps) => (
  <button type="button" onClick={onClick} style={{
    minHeight: 44, width: "100%", border: "none", background: "transparent",
    color: T.ink60, font: "600 15px Inter, sans-serif", cursor: "pointer",
    textDecoration: "underline", ...style,
  }}>{children}</button>
);

export const DangerButton = ({ children, onClick, style }: BtnProps) => (
  <button type="button" onClick={onClick} style={{
    height: 58, width: "100%", borderRadius: T.radius,
    border: `2px solid ${T.red}`, background: "transparent", color: T.redInk,
    font: "700 18px Inter, sans-serif", cursor: "pointer", ...style,
  }}>{children}</button>
);

/**
 * Footer action bar. One helper line, then the action. Identical on every
 * frame that has one — if a screen needs a different footer, it is a
 * different screen.
 */
export const FooterBar = ({ helper, children }: { helper?: ReactNode; children: ReactNode }) => (
  <div style={{
    padding: "14px 18px 20px", borderTop: `1px solid ${T.lineSoft}`,
    display: "flex", flexDirection: "column", gap: 10,
  }}>
    {helper != null && (
      <p style={{ font: "400 15px/1.35 Inter, sans-serif", color: T.ink72, margin: 0 }}>{helper}</p>
    )}
    {children}
  </div>
);

export type Tab = "match" | "players" | "standings";

export const TabBar = ({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) => (
  <div style={{ display: "flex", borderTop: `1px solid ${T.lineSoft}` }}>
    {([["match", "Match"], ["players", "Players"], ["standings", "Standings"]] as const).map(([id, label]) => (
      <button key={id} type="button" onClick={() => onChange(id)} style={{
        flex: 1, minHeight: 56, border: "none", background: "transparent", cursor: "pointer",
        color: active === id ? T.lime : T.ink60,
        font: `${active === id ? 700 : 600} 15px Inter, sans-serif`,
      }}>{label}</button>
    ))}
  </div>
);

/**
 * Bottom sheet with a scrim. Destructive sheets take a red top border, and
 * the SAFE action is the filled one — the frames invert the usual weighting
 * on purpose so the dangerous button is never the easy tap.
 */
export const Sheet = ({ children, onDismiss, tone }: {
  children: ReactNode; onDismiss: () => void; tone?: "plain" | "danger";
}) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column" }}>
    <div onClick={onDismiss} style={{ flex: 1, background: "rgba(244,237,224,.35)" }} />
    <div style={{
      background: T.sheet, borderTopLeftRadius: 10, borderTopRightRadius: 10,
      borderTop: tone === "danger" ? `2px solid ${T.red}` : `1px solid ${T.lineCard}`,
      padding: "18px 18px 22px", display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{
        width: 38, height: 4, borderRadius: 999, background: T.lineDot, alignSelf: "center",
      }} />
      {children}
    </div>
  </div>
);

/** Frame 01's pad. Four dots, no submit — the fourth digit verifies. */
export const Keypad = ({ onDigit, onDelete, disabled }: {
  onDigit: (d: string) => void; onDelete: () => void; disabled?: boolean;
}) => (
  <div style={{
    display: "grid", gridTemplateColumns: "repeat(3, 84px)", gap: 14, justifyContent: "center",
  }}>
    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
      k === "" ? <div key={i} /> : k === "del" ? (
        <button key={i} type="button" onClick={onDelete} disabled={disabled} aria-label="Delete"
          style={{
            height: 72, border: "none", borderRadius: T.radius, background: "transparent",
            color: T.ink55, font: "600 15px Inter, sans-serif", cursor: "pointer",
          }}>Delete</button>
      ) : (
        <button key={i} type="button" onClick={() => onDigit(k)} disabled={disabled}
          style={{
            height: 72, border: `1px solid ${T.line}`, borderRadius: T.radius,
            background: "transparent", color: T.ink, cursor: "pointer",
            fontFamily: "VT323, ui-monospace, monospace", fontSize: 38,
          }}>{k}</button>
      ))}
  </div>
);

export const Dots = ({ filled, of = 4 }: { filled: number; of?: number }) => (
  <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
    {Array.from({ length: of }, (_, i) => (
      <div key={i} style={{
        width: 18, height: 18, borderRadius: 999, boxSizing: "border-box",
        background: i < filled ? T.ink : "transparent",
        border: i < filled ? "none" : `2px solid ${T.lineDot}`,
      }} />
    ))}
  </div>
);
