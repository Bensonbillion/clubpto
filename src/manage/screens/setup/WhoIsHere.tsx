// Frame 06, Who is here. Step 2 of 4.
//
// Type-ahead, not a checklist. The club knows a few hundred names and the old
// screen made the operator scroll all of them with a thumb while people queued
// at the door. Here the field is the whole interface: type two letters, the
// booking list answers, and one tap adds. A name nobody recognises becomes a
// walk-in from the same tap.
//
// Two things a result row has to say, and the frame says both in one breath:
// who this is, and whether they booked. "On tonight's booking list" gets a sage
// Add; anyone else is added as a walk-in, because somebody who did not book is
// a walk-in whether or not the club has met them before.
//
// The tier strip is why this screen exists in this shape at all. The spec puts
// tier setting here, on the way in: a tier belongs to tonight, it carries over
// from last week as a default, and it never appears on court, in a game or in
// standings. It exists to balance games and to split the courts on the next
// screen, and for nothing else. B is offered pre-selected because B is the tier
// with no restrictions on it, so it is the least damaging wrong guess the app
// can make about somebody nobody has assessed.

import { useRef } from "react";
import type { PlayerTier } from "../../types";
import {
  Body, Eyebrow, FooterBar, PrimaryButton, Screen, SecondaryButton, T, Tag,
} from "../../ui/primitives";
import { Chip, SetupHeader, Why } from "./shell";

/** Inline styles cannot reach ::placeholder, and the frame fixes its colour. */
const SEARCH_CSS = `.setup-roster-search::placeholder{color:${T.mut};opacity:1}`;

/** The tiers the strip offers, in the frame's order: the default first. */
const TIERS: PlayerTier[] = ["B", "A", "C"];

export interface RosterRow {
  playerId: string;
  displayName: string;
  /** In the night. These are the chips under "In tonight". */
  ticked: boolean;
  /**
   * Booked for tonight, as opposed to somebody the club knows who did not
   * book. Drives both the row's second line and whether adding them reads as
   * an add or as a walk-in.
   */
  onBookingList: boolean;
  /** Tonight's tier. Unset until somebody sets one, and only ever a note. */
  tier?: PlayerTier | null;
  /**
   * False for somebody the match log holds: their chip must not advertise a
   * removal the session will refuse. Absent means removable.
   */
  removable?: boolean;
}

/** The strip the frame draws straight after an add. */
export interface TierPrompt {
  playerId: string;
  /** Named in the frame's own sentence: "Benson added. Tier tonight?" */
  displayName: string;
  /** What they carry now: last week's tier, or nothing yet. */
  tier: PlayerTier | null;
}

export interface WhoIsHereProps {
  /**
   * Everyone the club knows, tonight's bookings included. The type-ahead reads
   * this, and the "In tonight" cloud is the ticked ones. Sorted by the caller.
   */
  rows: RosterRow[];
  /**
   * Where these names came from, when it is worth saying. Null when the club
   * list loaded and there is nothing to explain.
   *
   * There is no error variant of this screen, deliberately: the list falls back
   * to the copy that ships with the app, so there is no state in which the
   * names are missing. A screen offering to retry a load that already succeeded
   * would be a lie with a button on it.
   */
  rosterNote?: string | null;
  /** The live search text. Empty draws no results panel. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Puts a known name into the night. */
  onAdd: (playerId: string) => void;
  /** Frame 27a's button: a name the club has never seen becomes a walk-in. */
  onAddWalkInNamed: (name: string) => void;
  /**
   * Tapping a chip under "In tonight". The frame draws those chips inert, so
   * omit this and they stay inert rather than growing an affordance no frame
   * has drawn.
   */
  onRemove?: (playerId: string) => void;
  /**
   * The person just added, or null. Held by the caller rather than by this
   * screen, because the add is what creates it and the add happens in the
   * session.
   */
  tierPrompt?: TierPrompt | null;
  onSetTier: (playerId: string, tier: PlayerTier) => void;
  /** Leaves the tier unset. Unassessed counts as B wherever it matters. */
  onSkipTier: () => void;
  /** Back returns to frame 05 with the night intact. */
  onBack?: () => void;
  onNext: () => void;
}

/**
 * Everyone whose name holds the query, ticked or not.
 *
 * Ticked people used to be filtered out here, and a live night showed what
 * that does: search somebody already in and the screen said "no one called
 * Benson on tonight's booking list" over a walk-in button that silently did
 * nothing, because the add is idempotent. The result now keeps them, marked,
 * and the row renders as "already in" instead of as an offer. The walk-in
 * offer appears only when NOBODY, in or out, carries the name.
 */
export const rosterMatches = (rows: readonly RosterRow[], query: string): RosterRow[] => {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];
  return rows.filter((r) => r.displayName.toLowerCase().includes(needle));
};

/**
 * Whether the walk-in offer renders: a name is typed and nobody CARRIES that
 * exact name. Substring matches do not count against it, and a live walk is
 * why: with Benson in tonight and Benita on the club list, a new person
 * actually called Ben matched both rows and could not be added at all. The
 * roster really holds such prefix pairs (Ade and Adee, Timi and Timi
 * Olaoye), so the offer now renders under the matches for any typed name no
 * row equals: an equal un-ticked row's own Add is the right path, an equal
 * ticked row is already in, and everything else is addable as typed.
 */
export const offersWalkIn = (rows: readonly RosterRow[], query: string): boolean => {
  const typed = query.trim().toLowerCase();
  return typed !== "" && !rows.some((r) => r.displayName.trim().toLowerCase() === typed);
};

export const WhoIsHere = ({
  rows, rosterNote, query, onQueryChange, onAdd, onAddWalkInNamed, onRemove,
  tierPrompt, onSetTier, onSkipTier, onBack, onNext,
}: WhoIsHereProps) => {
  const trimmed = query.trim();
  const matches = rosterMatches(rows, query);
  const inTonight = rows.filter((r) => r.ticked);
  const offerWalkIn = offersWalkIn(rows, query);

  // The next name is typed the moment this one lands, so every add hands the
  // caret straight back to the box. Focus moves inside the tap's own gesture,
  // which is what keeps a phone keyboard up instead of dropping it.
  const searchRef = useRef<HTMLInputElement>(null);
  const refocus = () => searchRef.current?.focus();

  return (
    <Screen>
      <style>{SEARCH_CSS}</style>
      <SetupHeader title="Who is here?" step="2 of 4" onBack={onBack} />

      {/* Frame 27a drops the why line: with a query typed and no answer, the
          screen is explaining itself rather than asking. */}
      {/*
        The strip sits ABOVE the results branches on purpose. It used to live
        inside the no-query branch only, so with a query still in the box the
        prompt for the player just added was invisible: the operator saw the
        same "Add as a walk-in" offer redrawn instead, and taps meant for the
        tier landed nowhere. A prompt that exists renders, whatever the box
        holds.
      */}
{tierPrompt != null && (
            <div style={{
              margin: "12px 22px 0", background: T.raised, borderRadius: T.radiusPanel,
              padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
              flexWrap: "wrap",
            }}>
              <span style={{ font: `400 14px ${T.fontBody}`, color: T.mut }}>
                {tierPrompt.displayName} added. Tier tonight?
              </span>
              {TIERS.map((tier) => (
                <Chip
                  key={tier}
                  radio
                  // Nobody assessed counts as B, so B is what the strip offers
                  // pre-selected rather than leaving the operator a blank.
                  on={(tierPrompt.tier ?? "B") === tier}
                  onClick={() => onSetTier(tierPrompt.playerId, tier)}
                  style={{ minHeight: 36, padding: "4px 13px", fontSize: 13 }}
                >{tier}</Chip>
              ))}
              <Chip onClick={onSkipTier} style={{ minHeight: 36, padding: "4px 13px", fontSize: 13 }}>
                Skip
              </Chip>
            </div>
          )}

      {!offerWalkIn && (
        <Why>
          Type a name: matches pop up from the booking list, anything new becomes
          a walk-in. No scrolling a long list.
        </Why>
      )}
      {rosterNote != null && rosterNote !== "" && (
        <Why style={{ marginTop: 6, fontSize: 13.5 }}>{rosterNote}</Why>
      )}

      <div style={{ padding: "16px 22px 8px" }}>
        <input
          ref={searchRef}
          className="setup-roster-search"
          value={query}
          placeholder="Type a name"
          onChange={(e) => onQueryChange(e.target.value)}
          style={{
            minHeight: 50, width: "100%", boxSizing: "border-box", borderRadius: T.pill,
            padding: "0 18px", background: "transparent", outline: "none", color: T.ink,
            // Sage the whole time on this frame, empty or not: the field IS the
            // screen here, not a filter bolted onto a list.
            border: `1.5px solid ${T.acc}`,
            font: `600 17px ${T.fontBody}`,
          }}
        />
      </div>

      {/* One Body whatever the query holds, so the "In tonight" cloud never
          leaves the screen. It used to vanish behind the walk-in offer, which
          is exactly the moment the operator is wondering whether somebody is
          already in. */}
        <Body style={{ overscrollBehavior: "contain" }}>
          {matches.length > 0 && (
            <div style={{
              margin: "0 22px", border: `1.5px solid ${T.line}`,
              borderRadius: T.radiusPanel, overflow: "hidden",
            }}>
              {matches.map((row, i) => (
                <button
                  key={row.playerId}
                  type="button"
                  disabled={row.ticked}
                  onClick={row.ticked ? undefined : () => { onAdd(row.playerId); refocus(); }}
                  style={{
                    width: "100%", boxSizing: "border-box", display: "flex",
                    alignItems: "center", gap: 12, padding: "13px 16px", minHeight: 64,
                    border: "none", background: "transparent", textAlign: "left",
                    borderBottom: i === matches.length - 1 ? "none" : `1px solid ${T.line}`,
                    cursor: row.ticked ? "default" : "pointer",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", font: `600 16px ${T.fontBody}`, color: T.ink }}>
                      {row.displayName}
                    </span>
                    <span style={{
                      display: "block", font: `400 13px ${T.fontBody}`, color: T.mut, marginTop: 1,
                    }}>
                      {row.ticked ? "Already in tonight"
                        : row.onBookingList ? "On tonight's booking list" : "Not on the list"}
                    </span>
                  </span>
                  {/* Sage on a booking, plain on a walk-in: the fill marks the
                      tap the operator makes forty times a night. A ticked row
                      answers the question instead of offering the tap. */}
                  {row.ticked
                    ? <Tag size="sm" tone="quiet">In tonight</Tag>
                    : (
                      <Chip on={row.onBookingList} style={{ minHeight: 38, padding: "4px 16px", fontSize: 14 }}>
                        {row.onBookingList ? "Add" : "Add as walk-in"}
                      </Chip>
                    )}
                </button>
              ))}
            </div>
          )}

          {offerWalkIn && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 16, padding: "18px 26px 8px", boxSizing: "border-box",
            }}>
              <p style={{
                font: `400 15px/1.55 ${T.fontBody}`, color: T.mut, margin: 0, textAlign: "center",
              }}>
                No one called {trimmed} on tonight's booking list.
              </p>
              <SecondaryButton
                onClick={() => { onAddWalkInNamed(trimmed); refocus(); }}
                style={{ width: "auto", padding: "8px 24px" }}
              >
                Add {trimmed} as a walk-in
              </SecondaryButton>
            </div>
          )}

          <div style={{ padding: "16px 22px 6px" }}>
            {/* A section heading rather than a place in the flow, so it drops
                out of sage, which is what every frame that reuses the eyebrow
                this way does. */}
            <Eyebrow style={{ color: T.mut, margin: "0 0 10px" }}>
              In tonight · {inTonight.length}
            </Eyebrow>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {inTonight.map((row) => {
                // A fielded player's chip stays inert: the session would
                // refuse the removal, and a control that does nothing is the
                // kind of silence this step just got cured of. The players
                // tab has the wording for taking a fielded player out.
                const removable = onRemove != null && row.removable !== false;
                return (
                  <Chip
                    key={row.playerId}
                    onClick={removable ? () => onRemove(row.playerId) : undefined}
                    style={{ minHeight: 36, padding: "4px 13px", fontSize: 14, gap: 7 }}
                  >
                    {row.displayName}
                    {row.tier != null && <Tag size="sm">{row.tier}</Tag>}
                    {removable && (
                      <span aria-hidden style={{ color: T.mut, fontSize: 15, lineHeight: 1 }}>×</span>
                    )}
                  </Chip>
                );
              })}
            </div>
          </div>
        </Body>

      <FooterBar helper="Tiers are set right here, per night. B this week can be A next, and only you ever see them. Copy last night is what carries them over.">
        <PrimaryButton onClick={onNext}>Next: split the courts</PrimaryButton>
      </FooterBar>
    </Screen>
  );
};

export default WhoIsHere;
