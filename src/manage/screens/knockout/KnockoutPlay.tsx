// Frame 33, Knockout play. The pager pages through the draw.
//
// One card, one tie at a time: the live one by default, and the arrows walk
// every tie in play order, settled results behind, waiting rounds ahead. The
// operator scores the live tie exactly as a league game, both numbers, one
// tap each. "Opponent advances" is the walkover, confirm-gated in the shell,
// and "Change this match" swaps a different waiting tie onto this court.
// The Bracket tab replaces Standings: a knockout night has no table.

import type { ReactNode } from "react";
import { Body, Num, Screen, T, TabBar, Tag, type Tab } from "../../ui/primitives";

export interface KnockoutSideView {
  name: string;
  seedLabel: string;
  trio: boolean;
}

export interface KnockoutPlayProps {
  header?: ReactNode;
  /** "Sunday · Play-in · Court 1", or without the court while paged off it. */
  eyebrow: string;
  a: KnockoutSideView | null;
  b: KnockoutSideView | null;
  scoreA: number | null;
  scoreB: number | null;
  /**
   * live: the tie standing on a court, slats tappable. result: settled,
   * numbers shown. walkover: settled with no numbers. pending: sides known
   * or waiting, nothing to tap.
   */
  state: "live" | "result" | "walkover" | "pending";
  /** For a pending side still waiting on a feeder: "Waits for the play-in". */
  waitsA?: string | null;
  waitsB?: string | null;
  onPreviousTie?: () => void;
  onNextTie?: () => void;
  /** Opens the score sheet. Live ties only. */
  onScore?: () => void;
  /** Frame 33's two quiet controls under the live card. */
  onChangeMatch?: () => void;
  onWalkover?: () => void;
  /** "Hamid + Dami against Seyi + Wale", or null when nothing waits. */
  upNext: string | null;
  /** Who took a settled tie. The caller knows; the slats only draw it. */
  winner?: "A" | "B" | null;
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}

const SideSlat = ({ side, score, waits, tappable, onScore, walkover, won }: {
  side: KnockoutSideView | null; score: number | null; waits?: string | null;
  tappable: boolean; onScore?: () => void; walkover: boolean; won: boolean;
}) => (
  <button
    type="button"
    disabled={!tappable}
    onClick={tappable ? onScore : undefined}
    style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      width: "100%", boxSizing: "border-box", minHeight: 74, padding: "14px 18px",
      border: `1.5px solid ${tappable ? T.acc : T.line}`, borderRadius: T.radiusPanel,
      background: "transparent", color: "inherit", textAlign: "left",
      cursor: tappable ? "pointer" : "default",
    }}
  >
    <span style={{ minWidth: 0 }}>
      {side ? (
        <>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ font: `600 16px ${T.fontBody}`, color: won || !walkover ? T.ink : T.soft }}>
              {side.name}
            </span>
            <Tag size="sm" tone="quiet">{side.seedLabel}</Tag>
          </span>
          {side.trio && (
            <Tag size="sm" tone="quiet">Rotating trio, two play each match</Tag>
          )}
          {tappable && (
            <span style={{ display: "block", font: `600 11.5px ${T.fontBody}`, letterSpacing: ".08em", color: T.soft, marginTop: 3 }}>
              TAP TO SCORE
            </span>
          )}
        </>
      ) : (
        <span style={{ font: `600 14.5px ${T.fontBody}`, color: T.soft }}>
          {waits ?? ""}
        </span>
      )}
    </span>
    {walkover
      ? <Tag size="sm" tone={won ? undefined : "quiet"}>{won ? "Advanced" : "Walkover"}</Tag>
      : (
        <Num size={30} style={{ color: score == null ? T.dim : T.ink, opacity: !walkover && score != null && !won ? 0.5 : 1 }}>
          {score == null ? "00" : String(score)}
        </Num>
      )}
  </button>
);

export const KnockoutPlay = ({
  header, eyebrow, a, b, scoreA, scoreB, state, waitsA, waitsB,
  onPreviousTie, onNextTie, onScore, onChangeMatch, onWalkover, upNext,
  winner = null,
  activeTab, onTabChange,
}: KnockoutPlayProps) => {
  return (
    <Screen>
      {header}

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 14px 0",
      }}>
        <button type="button" aria-label="Previous tie" onClick={onPreviousTie} style={{
          border: "none", background: "transparent", color: onPreviousTie ? T.ink : T.dim,
          fontSize: 22, cursor: onPreviousTie ? "pointer" : "default", padding: "2px 10px",
        }}>‹</button>
        <span style={{
          font: `600 11.5px ${T.fontBody}`, letterSpacing: ".1em",
          textTransform: "uppercase", color: T.mut,
        }}>{eyebrow}</span>
        <button type="button" aria-label="Next tie" onClick={onNextTie} style={{
          border: "none", background: "transparent", color: onNextTie ? T.ink : T.dim,
          fontSize: 22, cursor: onNextTie ? "pointer" : "default", padding: "2px 10px",
        }}>›</button>
      </div>

      <Body style={{ padding: "16px 22px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        <SideSlat side={a} score={scoreA} waits={waitsA} walkover={state === "walkover"}
          won={winner === "A"} tappable={state === "live"} onScore={onScore} />
        <SideSlat side={b} score={scoreB} waits={waitsB} walkover={state === "walkover"}
          won={winner === "B"} tappable={state === "live"} onScore={onScore} />

        {state === "live" && (
          <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 4 }}>
            {onChangeMatch && (
              <button type="button" onClick={onChangeMatch} style={{
                border: "none", background: "transparent", cursor: "pointer",
                font: `600 13.5px ${T.fontBody}`, color: T.soft, padding: 6,
              }}>Change this match</button>
            )}
            {onWalkover && (
              <button type="button" onClick={onWalkover} style={{
                border: "none", background: "transparent", cursor: "pointer",
                font: `600 13.5px ${T.fontBody}`, color: T.soft, padding: 6,
              }}>Opponent advances</button>
            )}
          </div>
        )}

        {upNext != null && (
          <div style={{ marginTop: 8 }}>
            <p style={{ font: `600 11.5px ${T.fontBody}`, letterSpacing: ".08em", textTransform: "uppercase", color: T.mut, margin: "0 0 4px" }}>
              Up next, any free court
            </p>
            <p style={{ font: `400 14.5px/1.5 ${T.fontBody}`, color: T.mut, margin: 0 }}>
              {upNext}
            </p>
          </div>
        )}
      </Body>

      <TabBar active={activeTab} onChange={onTabChange} labels={{ standings: "Bracket" }} />
    </Screen>
  );
};

export default KnockoutPlay;
