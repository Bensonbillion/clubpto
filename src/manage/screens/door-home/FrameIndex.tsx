// Frame 00 — Index (v2 `1a`).
//
// The wireframe's own frame index, not an operator screen. It ships behind the
// manage route as a dev/QA navigation page, or not at all. It lives here
// because it carries the canonical frame names every other screen's nav copy
// has to agree with.

import { Body, Eyebrow, Num, Screen, T } from "../../ui/primitives";

export interface FrameLink {
  /** Two-digit frame number, as printed. */
  id: string;
  label: string;
}

export interface FrameGroup {
  heading: string;
  frames: FrameLink[];
}

/** The canonical frame list. v2 names — these are what the rest of the app labels these screens. */
export const FRAME_INDEX: FrameGroup[] = [
  {
    heading: "Job 0 · Get in",
    frames: [
      { id: "01", label: "Passcode" },
      { id: "02", label: "Passcode failed" },
    ],
  },
  {
    heading: "Job 1 · Roster and start",
    frames: [
      { id: "03", label: "Home, nothing running" },
      { id: "04", label: "Home, night in progress" },
      { id: "05", label: "Which night" },
      { id: "06", label: "Who is here" },
      { id: "07", label: "Courts" },
      { id: "08", label: "How many matches each" },
      { id: "09", label: "Ready" },
    ],
  },
  {
    heading: "Job 2 · Score the games",
    frames: [
      { id: "10", label: "Court view" },
      { id: "11", label: "Score entry" },
      { id: "12", label: "Court switcher" },
      { id: "13", label: "Players tab" },
      { id: "14", label: "Late arrival" },
      { id: "15", label: "Extend" },
      { id: "16", label: "Correct or void a result" },
    ],
  },
  {
    heading: "Job 3 · Standings",
    frames: [
      { id: "17", label: "Standings tab" },
      { id: "18", label: "Tie broken by order" },
    ],
  },
  {
    heading: "Job 4 · Playoffs",
    frames: [
      { id: "19", label: "Playoff readiness, blocked" },
      { id: "20", label: "Bracket" },
      { id: "21", label: "Playoff match" },
      { id: "22", label: "Champion" },
      { id: "23", label: "Session summary" },
    ],
  },
  {
    heading: "States",
    frames: [
      { id: "24", label: "Empty, roster search" },
      { id: "25", label: "Empty, court unassigned" },
      { id: "26", label: "Error, score would not save" },
      { id: "27", label: "Confirmation, end the night" },
    ],
  },
];

export interface FrameIndexProps {
  /** Opens a frame. Routing is the caller's job — this screen imports no router. */
  onOpen?: (frameId: string) => void;
}

export const FrameIndex = ({ onOpen }: FrameIndexProps) => (
  <Screen>
    <Body style={{ padding: "24px 20px 28px", boxSizing: "border-box" }}>
      <h1 style={{
        fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 600,
        lineHeight: 1.1, margin: 0,
      }}>Manage</h1>
      <p style={{
        fontSize: 15, lineHeight: 1.4, color: T.ink68, marginTop: 6, marginBottom: 0,
      }}>Club PTO court manager. 27 frames, five jobs.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 22 }}>
        {FRAME_INDEX.map((group) => (
          <div key={group.heading} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Eyebrow>{group.heading}</Eyebrow>
            {group.frames.map((frame) => (
              <div key={frame.id} style={{ display: "flex", gap: 10, fontSize: 15 }}>
                {/* The number is a VALUE, so VT323. Lime-free here — plain ink. */}
                <Num size={19} style={{ width: 24, flexShrink: 0 }}>{frame.id}</Num>
                <button
                  type="button"
                  onClick={() => onOpen?.(frame.id)}
                  style={{
                    border: "none", background: "transparent", padding: 0, margin: 0,
                    color: "inherit", font: "400 15px Inter, sans-serif", textAlign: "left",
                    textDecoration: "none", cursor: "pointer",
                  }}
                >{frame.label}</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Body>
  </Screen>
);
