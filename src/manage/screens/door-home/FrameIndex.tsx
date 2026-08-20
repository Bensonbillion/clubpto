// Frame 00, Index.
//
// The wireframe's own contents page, not an operator screen. It ships behind
// the manage route as a dev and QA jump list, or not at all. It lives here
// because it carries the canonical frame names every other screen's nav copy
// has to agree with, and those names changed wholesale in v3: what was
// "Courts" is now "Split the courts", what was "Champion" is now two frames.
//
// The mockup lays the list out in two columns because it is drawn 580px wide
// on a desktop canvas. On a 390px phone it is one column, which is the same
// list with the same order.

import { Body, Screen, T } from "../../ui/primitives";

export interface FrameLink {
  /**
   * The frame number as printed. Not always two digits: the set grew a 12b and
   * a 25b rather than renumbering thirty screens, so this is a label and never
   * an index.
   */
  id: string;
  label: string;
}

/** The canonical frame list, verbatim from frame 00. */
export const FRAME_INDEX: FrameLink[] = [
  { id: "01", label: "Passcode, four digits" },
  { id: "02", label: "Passcode failed" },
  { id: "03", label: "Home, nothing running" },
  { id: "04", label: "Home, night in progress" },
  { id: "05", label: "Which night" },
  { id: "06", label: "Who is here + tiers" },
  { id: "07", label: "Split the courts" },
  { id: "08", label: "Matches each" },
  { id: "09", label: "Ready" },
  { id: "10", label: "Court view" },
  { id: "11", label: "Balance rule, why this four" },
  { id: "12", label: "Score entry, both sides" },
  { id: "12b", label: "Schedule, skip + return" },
  { id: "13", label: "Both courts, one device" },
  { id: "14", label: "Players tab" },
  { id: "15", label: "Late arrival" },
  { id: "16", label: "Correct, void, move, leave" },
  { id: "17", label: "Standings" },
  { id: "18", label: "Tie, first to this score" },
  { id: "19", label: "How this court ends" },
  { id: "20", label: "Playoff readiness, both" },
  { id: "21", label: "Bracket, seeds split" },
  { id: "22", label: "Playoff match" },
  { id: "23", label: "Court 2 champions" },
  { id: "24", label: "Court 1 champion" },
  { id: "25", label: "Session summary" },
  { id: "25b", label: "Night menu, end or restart" },
  { id: "26", label: "Awkward headcounts" },
  { id: "27", label: "Empty + error states" },
  { id: "28", label: "Confirmation sheets" },
];

export interface FrameIndexProps {
  /** Opens a frame. Routing is the caller's job: this screen imports no router. */
  onOpen?: (frameId: string) => void;
}

export const FrameIndex = ({ onOpen }: FrameIndexProps) => (
  <Screen>
    <Body style={{ padding: "22px 26px 26px", boxSizing: "border-box" }}>
      {FRAME_INDEX.map((frame) => (
        <button
          key={frame.id}
          type="button"
          onClick={() => onOpen?.(frame.id)}
          style={{
            width: "100%", display: "flex", justifyContent: "space-between", gap: 10,
            padding: "10px 0", border: "none", borderBottom: `1px solid ${T.line}`,
            background: "transparent", color: T.ink, textAlign: "left", cursor: "pointer",
          }}
        >
          <span style={{ font: `600 14px ${T.fontBody}` }}>{frame.label}</span>
          {/* The number is a VALUE, so it wears the display face, and sage, as drawn. */}
          <span style={{
            fontFamily: T.fontHead, fontWeight: 400, fontSize: 15,
            fontVariantNumeric: "tabular-nums", color: T.acc, flexShrink: 0,
          }}>{frame.id}</span>
        </button>
      ))}
    </Body>
  </Screen>
);
