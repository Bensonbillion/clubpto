// Frame 13 — Players tab.
//
// The column of VT323 game counts down the left edge is the point of this
// screen: it is what makes "who is owed a game" readable without reading.
// One lime element only, and it is the Add a player button.

import { Num, Screen, Body, FooterBar, PrimaryButton, TabBar, T } from "../../ui/primitives";
import type { Tab } from "../../ui/primitives";

export type PlayerStatus = "not_arrived" | "here" | "on_court" | "left";

export interface PlayersTabPlayer {
  id: string;
  displayName: string;
  /** Completed matches tonight. Rendered in VT323. */
  gamesPlayed: number;
  status: PlayerStatus;
  /**
   * Wall-clock time already formatted for display, e.g. "8:41". Required
   * whenever status is "left"; it fills [[TIME_LEFT]].
   */
  leftAt?: string;
}

export interface PlayersTabProps {
  /**
   * Arrival order. The list is sorted by gamesPlayed ascending and ties fall
   * back to this order, so rows never jump when a score lands.
   */
  players: PlayersTabPlayer[];
  /** The N in "N in". Players currently present, not the row count. */
  attendanceCount: number;
  onMarkArrived: (playerId: string) => void;
  onMarkLeft: (playerId: string) => void;
  onMarkHere: (playerId: string) => void;
  onAddPlayer: () => void;
  onChangeTab: (tab: Tab) => void;
}

const statusLine = (p: PlayersTabPlayer): string => {
  switch (p.status) {
    case "not_arrived": return "Not arrived";
    case "here": return "Here";
    case "on_court": return "On court now";
    case "left": return `Left at ${p.leftAt ?? ""}`;
  }
};

const pillLabel = (status: PlayerStatus): string =>
  status === "not_arrived" ? "Mark arrived" : status === "left" ? "Mark here" : "Mark left";

const ActionPill = ({ children, onClick }: { children: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{
    font: "700 14px Inter, sans-serif", color: T.ink, background: "transparent",
    border: `1px solid ${T.line}`, borderRadius: 999, padding: "7px 12px",
    cursor: "pointer", whiteSpace: "nowrap",
  }}>{children}</button>
);

export const PlayersTab = ({
  players, attendanceCount, onMarkArrived, onMarkLeft, onMarkHere, onAddPlayer, onChangeTab,
}: PlayersTabProps) => {
  // Fewest games first; arrival order breaks the tie so the sort is stable.
  const ordered = players
    .map((player, arrivalIndex) => ({ player, arrivalIndex }))
    .sort((a, b) => a.player.gamesPlayed - b.player.gamesPlayed || a.arrivalIndex - b.arrivalIndex)
    .map((entry) => entry.player);

  // FLAG: empty list (zero players) is not drawn in either wireframe. No copy
  // exists for it, so nothing is rendered here. Needs copy written.

  return (
    <Screen>
      <div style={{
        padding: "14px 18px 10px", borderBottom: `1px solid ${T.lineSoft}`,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ font: "700 20px Inter, sans-serif" }}>Players</span>
          <span style={{ font: "400 14px Inter, sans-serif", color: T.ink55 }}>
            <Num size={20}>{attendanceCount}</Num>{" "}in
          </span>
        </div>
        <p style={{ font: "400 14px Inter, sans-serif", color: T.ink55, margin: 0 }}>
          Fewest games first, so whoever is owed a game is at the top.
        </p>
      </div>

      <Body>
        {ordered.map((p) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
            borderBottom: `1px solid ${T.lineSoft}`,
          }}>
            <Num size={28} style={{ display: "inline-block", width: 28 }}>{p.gamesPlayed}</Num>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 17px Inter, sans-serif" }}>{p.displayName}</div>
              <div style={{ font: "400 14px Inter, sans-serif", color: T.ink55 }}>{statusLine(p)}</div>
            </div>
            {/*
              FLAG: "Mark left" is offered on a player whose status is
              "On court now" and nothing says what happens to the match in
              progress. The callback fires; the backend has to define whether
              that forfeits, voids or blocks, and it needs its own copy.
            */}
            <ActionPill onClick={() => {
              if (p.status === "not_arrived") onMarkArrived(p.id);
              else if (p.status === "left") onMarkHere(p.id);
              else onMarkLeft(p.id);
            }}>{pillLabel(p.status)}</ActionPill>
          </div>
        ))}
      </Body>

      <FooterBar helper="Someone just walked in?">
        <PrimaryButton onClick={onAddPlayer}>Add a player</PrimaryButton>
      </FooterBar>

      <TabBar active="players" onChange={onChangeTab} />
    </Screen>
  );
};

export default PlayersTab;
