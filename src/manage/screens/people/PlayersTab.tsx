// Frame 14, Players tab, fewest games first.
//
// The column of Caprasimo counts down the right edge is the point of this
// screen: it is what makes "who is owed a game" readable without reading. The
// order carries the same claim, and the footer sentence states it outright.
//
// The tier line is honest or it is absent. Frame 14 writes "Not assessed" for
// six of its eight rows because that is the truth of the roster, and a screen
// that guessed a middle tier here would be handing the balance rule an
// assessment nobody made.
//
// This is also the ONLY live screen a tier appears on. It is a private note
// for whoever is splitting the courts, so it shows here and on the setup
// screens and nowhere a player can read it: not on a match card, not in a
// game, not in standings. The helper line says so out loud, because an
// operator holding the phone at the net needs to know it is safe to turn.

import type { ReactNode } from "react";
import {
  Body,
  Eyebrow,
  FooterBar,
  Num,
  Screen,
  SecondaryButton,
  T,
  TabBar,
  type Tab,
} from "../../ui/primitives";

export type PlayerStatus = "not_arrived" | "here" | "on_court" | "left";

export interface PlayersTabPlayer {
  id: string;
  displayName: string;
  /** Completed matches tonight. */
  gamesPlayed: number;
  /** An assessment somebody made. Undefined is the common case and reads
   *  "Not assessed", which is what frame 14 draws. */
  tier?: "A" | "B" | "C";
  status: PlayerStatus;
}

export interface PlayersTabProps {
  /**
   * The court chip row and the night menu. Same reason the playoff screens
   * carry it: flip mid-anything means every screen, and this tab is a screen.
   */
  header?: ReactNode;
  /**
   * Arrival order. The list is sorted by gamesPlayed ascending and ties fall
   * back to this order, so rows never jump when a score lands.
   */
  players: PlayersTabPlayer[];
  /** "Court 1". The tab belongs to one court, and the header says which. */
  courtLabel: string;
  /** The N in "8 in". Players currently present, not the row count. */
  attendanceCount: number;
  /**
   * The one row showing its action.
   *
   * Frame 14 draws the "Mark left" ghost on exactly one row, not on all eight,
   * so the row is opened before it offers anything. That keeps a list of eight
   * names a list of eight names, and it keeps the destructive-ish action two
   * taps from a thumb resting on the phone.
   */
  openPlayerId?: string | null;
  /** Opens a row, or closes the open one with null. */
  onOpenPlayer: (playerId: string | null) => void;
  onMarkArrived: (playerId: string) => void;
  /** The shell answers this with frame 16c, which is where the consequence is
   *  explained and the decision is actually taken. */
  onMarkLeft: (playerId: string) => void;
  onMarkHere: (playerId: string) => void;
  /**
   * Opens frame B28's move sheet for this row. Omitted on a one-court night,
   * where there is nowhere to move anybody to and the ghost would be a lie.
   */
  onMoveCourts?: (playerId: string) => void;
  /** Opens frame B29's tier sheet for this row. */
  onSetTier?: (playerId: string) => void;
  onAddPlayer: () => void;
  onChangeTab: (tab: Tab) => void;
}

/** Frame 14 draws "Here" and "On court". The other two continue the pattern in
 *  its own two words each; no frame draws them. */
const statusWord = (status: PlayerStatus): string => {
  switch (status) {
    case "not_arrived": return "Not arrived";
    case "here": return "Here";
    case "on_court": return "On court";
    case "left": return "Left";
  }
};

/**
 * "Mark left" is frame 14's own label. "Mark arrived" and "Mark here" are not
 * drawn anywhere in v3: they are built from that label so a row can be undone,
 * which frame 16c promises when it says one tap returns him to the queue.
 */
const actionLabel = (status: PlayerStatus): string =>
  status === "not_arrived" ? "Mark arrived" : status === "left" ? "Mark here" : "Mark left";

export const PlayersTab = ({
  header,
  players,
  courtLabel,
  attendanceCount,
  openPlayerId,
  onOpenPlayer,
  onMarkArrived,
  onMarkLeft,
  onMarkHere,
  onMoveCourts,
  onSetTier,
  onAddPlayer,
  onChangeTab,
}: PlayersTabProps) => {
  // Fewest games first; arrival order breaks the tie so the sort is stable.
  const ordered = players
    .map((player, arrivalIndex) => ({ player, arrivalIndex }))
    .sort((a, b) => a.player.gamesPlayed - b.player.gamesPlayed || a.arrivalIndex - b.arrivalIndex)
    .map((entry) => entry.player);

  const act = (player: PlayersTabPlayer) => {
    if (player.status === "not_arrived") onMarkArrived(player.id);
    else if (player.status === "left") onMarkHere(player.id);
    else onMarkLeft(player.id);
  };

  return (
    <Screen>
      {header}
      <div
        style={{
          padding: "24px 22px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <h2 style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 25, lineHeight: 1.15, margin: 0 }}>
          Players
        </h2>
        <Eyebrow>{courtLabel} &middot; {attendanceCount} in</Eyebrow>
      </div>

      <p
        style={{
          font: `400 15px/1.5 ${T.fontBody}`,
          color: T.mut,
          padding: "0 22px",
          margin: "8px 0 0",
          textWrap: "pretty",
        }}
      >
        {/* The frame joins the two sentences with an em dash. Restructured to a
            full stop, no word changed. */}
        Whoever is owed a game sits at the top. Tiers show here for you only. Players never see
        them on a match screen.
      </p>

      {/* Twenty-four names on a 390x844 phone scroll here, not in the page. */}
      <Body style={{ marginTop: 12 }}>
        {ordered.map((player) => {
          const open = player.id === openPlayerId;
          const ghost = {
            width: "auto", minHeight: 40, font: `600 13.5px ${T.fontBody}`, padding: "4px 15px",
          } as const;
          return (
            <div
              key={player.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "14px 22px",
                borderBottom: `1px solid ${T.line}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* The name block is the control, not the whole row: an action
                    button cannot be nested inside another button, and the count
                    on the right is a reading, not a target. */}
                <button
                  type="button"
                  onClick={() => onOpenPlayer(open ? null : player.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    background: "transparent",
                    color: T.ink,
                    padding: "4px 0",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <p style={{ font: `600 16px ${T.fontBody}`, margin: 0 }}>{player.displayName}</p>
                  <p style={{ font: `400 13.5px ${T.fontBody}`, color: T.mut, margin: "2px 0 0" }}>
                    {player.tier ? `Tier ${player.tier}` : "Not assessed"} &middot;{" "}
                    {statusWord(player.status)}
                  </p>
                </button>

                {open && (
                  <SecondaryButton style={ghost} onClick={() => act(player)}>
                    {actionLabel(player.status)}
                  </SecondaryButton>
                )}

                <Num size={22} style={{ display: "inline-block", width: 30, textAlign: "right" }}>
                  {player.gamesPlayed}
                </Num>
              </div>

              {/* Frames B28 and B29 open FROM this tab and draw no entry point
                  of their own, so the open row grows two more ghosts in the
                  same register as frame 14's "Mark left". They sit on a second
                  line because three ghosts beside a name and a count do not
                  fit a 390px row. The labels are not drawn on any frame; each
                  names the sheet it opens and nothing more. */}
              {open && (onMoveCourts != null || onSetTier != null) && (
                <div style={{ display: "flex", gap: 8 }}>
                  {onMoveCourts != null && (
                    <SecondaryButton style={ghost} onClick={() => onMoveCourts(player.id)}>
                      Move courts
                    </SecondaryButton>
                  )}
                  {onSetTier != null && (
                    <SecondaryButton style={ghost} onClick={() => onSetTier(player.id)}>
                      Set tier
                    </SecondaryButton>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Body>

      <FooterBar helper="Counts never drift more than one game apart.">
        <SecondaryButton onClick={onAddPlayer}>Add a walk-in</SecondaryButton>
      </FooterBar>

      <TabBar active="players" onChange={onChangeTab} />
    </Screen>
  );
};
