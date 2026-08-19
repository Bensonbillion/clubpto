// Frame 24b — Empty, court unassigned (v2 `1z`).
//
// v2 moves this out of the setup wizard and into the LIVE court view: switcher
// on top, tab bar underneath, and the CTA names the specific court.
//
// Lime appears twice here on purpose and the spec sanctions it: the selected
// court tile is the only lime in the upper half, the CTA the only fill in the
// lower half.

import type { Tab } from "../../ui/primitives";
import { Body, FooterBar, Num, PrimaryButton, Screen, T, TabBar } from "../../ui/primitives";
import { pad2 } from "./format";

export interface CourtTile {
  courtNumber: number;
  assignedPlayerCount: number;
  /** One of the drawn strings: `Mid-match`, `Nobody assigned`. */
  statusLabel: string;
}

export interface EmptyCourtUnassignedProps {
  /** FLAG: more than two courts is not drawn. The row just keeps flexing. */
  courts: CourtTile[];
  /** The empty court. Fires this frame on `assignedPlayerCount === 0`. */
  activeCourtNumber: number;
  activeTab: Tab;
  onSelectCourt: (courtNumber: number) => void;
  onAssignPlayers: (courtNumber: number) => void;
  onTabChange: (tab: Tab) => void;
}

export const EmptyCourtUnassigned = ({
  courts,
  activeCourtNumber,
  activeTab,
  onSelectCourt,
  onAssignPlayers,
  onTabChange,
}: EmptyCourtUnassignedProps) => {
  const active = courts.find((c) => c.courtNumber === activeCourtNumber);
  // The rationale sentence names the busiest other court, since that is the
  // one carrying the long bench.
  const other = courts
    .filter((c) => c.courtNumber !== activeCourtNumber)
    .sort((a, b) => b.assignedPlayerCount - a.assignedPlayerCount)[0];

  return (
    <Screen>
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${T.lineSoft}`,
        display: "flex", gap: 10,
      }}>
        {courts.map((c) => {
          const on = c.courtNumber === activeCourtNumber;
          return (
            <button key={c.courtNumber} type="button" onClick={() => onSelectCourt(c.courtNumber)} style={{
              flex: 1, textAlign: "left", cursor: "pointer",
              border: on ? `2px solid ${T.ink}` : `1px solid ${T.line}`,
              background: on ? T.lime : "transparent",
              color: on ? T.limeInk : T.ink,
              borderRadius: T.radius, padding: "10px 12px",
              display: "flex", flexDirection: "column", gap: 2,
            }}>
              <span style={{ font: "700 16px Inter, sans-serif" }}>{`Court ${c.courtNumber}`}</span>
              <span style={{ font: "600 13px Inter, sans-serif" }}>{c.statusLabel}</span>
            </button>
          );
        })}
      </div>

      <Body style={{
        padding: "28px 18px", display: "flex", flexDirection: "column", gap: 14,
        alignItems: "flex-start",
      }}>
        <Num size={64} style={{ lineHeight: 0.9 }}>{pad2(active ? active.assignedPlayerCount : 0)}</Num>
        <div style={{ font: "700 20px/1.3 Inter, sans-serif" }}>
          {`Court ${activeCourtNumber} has nobody on it yet.`}
        </div>
        {/* FLAG: the rationale asserts the other court is overloaded. When it is
            not, no alternate sentence is approved, so nothing is rendered. */}
        {other != null && (
          <div style={{ font: "400 16px/1.45 Inter, sans-serif", color: T.ink68, textWrap: "pretty" }}>
            {`Court ${other.courtNumber} is carrying `}
            <Num size={20}>{other.assignedPlayerCount}</Num>
            {" players, so the bench is long. Move half of them over and both courts run at once."}
          </div>
        )}
      </Body>

      <FooterBar helper={
        <span style={{ font: "600 16px Inter, sans-serif", color: T.ink }}>
          {`Court ${activeCourtNumber} is empty.`}
        </span>
      }>
        <PrimaryButton
          onClick={() => onAssignPlayers(activeCourtNumber)}
          style={{ height: 56, font: "700 18px Inter, sans-serif" }}
        >{`Assign players to Court ${activeCourtNumber}`}</PrimaryButton>
      </FooterBar>

      <TabBar active={activeTab} onChange={onTabChange} />
    </Screen>
  );
};
