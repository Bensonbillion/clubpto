// Frame 07, Split the courts. Step 3 of 4.
//
// Players stay on their court all night, so this is the one setup decision
// that cannot be undone later without moving somebody mid-night. That is why
// the whole room is on screen as chips rather than behind a count: the
// operator reads the two lists and fixes the split by tapping.
//
// The split ARRIVES pre-sorted, from the tiers set on the way in, and the
// operator adjusts it by hand. The spec's phrase for the whole screen is "tier
// suggests, it never gates": a typical night puts A and B on one court and
// gives C their own, but a night of 16 A, 4 B and 10 C splits the other way,
// because B is the bridge and the C court needs B's to fill it. So nothing
// here refuses a move, and nothing here moves anybody on the operator's
// behalf once they start dragging.
//
// A tier tag rides a chip only where somebody was actually assessed, and the
// footer sentence says exactly that. Everyone else is unlabelled, which is not
// a gap: an unassessed player counts as B everywhere it matters, B is the tier
// with no restrictions on it, and printing a guess on their chip would dress a
// default up as a judgement somebody made.

import type { PlayerTier } from "../../types";
import {
  Body, Card, FooterBar, PrimaryButton, Screen, SecondaryButton, T, Tag,
} from "../../ui/primitives";
import { Chip, SetupHeader, Why } from "./shell";

/** The counts frame 07 offers. Three courts is drawn, so three is offered. */
const COUNT_OPTIONS = [1, 2, 3] as const;

/**
 * Spelled out, because frame 27b writes "drop back to two courts" rather than
 * "to 2 courts". Only the counts this screen can offer need a word.
 */
const COUNT_WORDS: Record<number, string> = { 1: "one court", 2: "two courts" };

export interface CourtChip {
  playerId: string;
  displayName: string;
  /**
   * Tonight's tier, where somebody set one. Null is the common case and draws
   * no tag at all: the balance rules treat an unassessed player as B, but that
   * is a default the engine applies, not an assessment this chip may claim.
   */
  tier: PlayerTier | null;
}

export interface SetupCourt {
  courtNumber: number;
  /** "Court 1". The rest of the app keys on this identity. */
  label: string;
  /** The split as it stands. Tapping a name moves it to the next court. */
  players: CourtChip[];
}

export interface CourtsProps {
  /** One entry per court at the current count, in court order. */
  courts: SetupCourt[];
  /** 1, 2 or 3. Changing it re-splits everyone and re-renders the cards. */
  courtCount: number;
  onCourtCountChange: (count: number) => void;
  /** Moves that player to the next court, wrapping back to the first. */
  onMovePlayer: (playerId: string) => void;
  /** The empty court card's only action. */
  onAssignPlayers: (courtNumber: number) => void;
  /** Back returns to frame 06. */
  onBack?: () => void;
  onNext: () => void;
}

/** One name, with what the club knows about them riding inside the pill. */
const PlayerChip = ({ chip, onMove }: { chip: CourtChip; onMove: (() => void) | null }) => (
  <Chip
    onClick={onMove ?? undefined}
    style={{ minHeight: 36, padding: "4px 13px", fontSize: 14, gap: 7 }}
  >
    {chip.displayName}
    {chip.tier != null && <Tag size="sm">{chip.tier}</Tag>}
  </Chip>
);

/** Frame 27b. The dashed card replaces the court card, count and all. */
const EmptyCourt = ({ court, courtCount, onAssign }: {
  court: SetupCourt; courtCount: number; onAssign: () => void;
}) => {
  // The second clause is an offer to undo the court that is empty, so it only
  // exists while there is a smaller split to drop back to.
  const fallback = COUNT_WORDS[courtCount - 1];

  return (
    <Card style={{
      border: `1.5px dashed ${T.line}`, padding: "28px 18px", alignItems: "center", gap: 12,
    }}>
      <span style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18 }}>{court.label}</span>
      <p style={{
        font: `400 14.5px/1.6 ${T.fontBody}`, color: T.mut, margin: 0, textAlign: "center",
      }}>
        Nobody on {court.label} yet. Drag names across
        {fallback != null ? `, or drop back to ${fallback}` : ""}.
      </p>
      <SecondaryButton onClick={onAssign} style={{ width: "auto", minHeight: 46, padding: "8px 24px" }}>
        Assign players
      </SecondaryButton>
    </Card>
  );
};

export const Courts = ({
  courts, courtCount, onCourtCountChange, onMovePlayer, onAssignPlayers, onBack, onNext,
}: CourtsProps) => (
  <Screen>
    <SetupHeader title="Split the courts" step="3 of 4" onBack={onBack} />
    {/* The frame writes this with a dash where the colon is. Same sentence,
        same clause order, and no em dash in the codebase. */}
    <Why>
      Started from the suggested split: A and B share a court, C get their own.
      Drag anything; the counts follow you.
    </Why>

    <Body style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div role="radiogroup" style={{ display: "flex", gap: 10 }}>
        {COUNT_OPTIONS.map((n) => (
          <Chip
            key={n}
            radio
            on={n === courtCount}
            onClick={() => onCourtCountChange(n)}
            style={{ flex: 1, minHeight: 52 }}
          >
            {/* The digit is a value, so it wears the display face; the word
                beside it is part of a sentence and stays in body type. */}
            <span style={{
              fontFamily: T.fontHead, fontWeight: 400, fontSize: 20,
              fontVariantNumeric: "tabular-nums",
            }}>{n}</span>
            {n === 1 ? "court" : "courts"}
          </Chip>
        ))}
      </div>

      {courts.map((court) => court.players.length === 0 ? (
        <EmptyCourt
          key={court.courtNumber}
          court={court}
          courtCount={courtCount}
          onAssign={() => onAssignPlayers(court.courtNumber)}
        />
      ) : (
        <Card key={court.courtNumber} style={{ gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18 }}>
              {court.label}
            </span>
            {/* Sage, because the count is the number the operator is levelling. */}
            <span style={{
              fontFamily: T.fontHead, fontWeight: 400, fontSize: 20,
              fontVariantNumeric: "tabular-nums", color: T.acc,
            }}>{court.players.length}</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {court.players.map((chip) => (
              <PlayerChip
                key={chip.playerId}
                chip={chip}
                // With one court there is nowhere to move to, so the chip is
                // not a control.
                onMove={courts.length > 1 ? () => onMovePlayer(chip.playerId) : null}
              />
            ))}
          </div>
        </Card>
      ))}
    </Body>

    <FooterBar helper="Tier chips show only where someone was actually assessed. Everyone else is unlabelled, because that is the truth of the data.">
      <PrimaryButton onClick={onNext}>Next: matches each</PrimaryButton>
    </FooterBar>
  </Screen>
);

export default Courts;
