// Frame 07 — Courts. Step 3 of 4.
//
// Players stay on their court all night, so this split is the one setup
// decision that cannot be undone later without moving somebody mid-night.
// That is why the whole roster is on screen as chips rather than behind a
// count: the manager reads the two lists and fixes the split by tapping.
//
// The seeding letter is a setup-time hint only. It rides inside the chip in
// faint ink and never appears again once the night starts.

import { Fragment } from "react";
import {
  Body, Card, FooterBar, Num, PrimaryButton, Screen, SecondaryButton, T,
} from "../../ui/primitives";
import { H1, pad2, QuietLine, SETUP, StepCounter, Sub, TopBar } from "./shell";

/**
 * v2 offers exactly these. Three-court support is out of scope until the
 * option is added back explicitly, so this is a constant rather than a prop.
 */
const COUNT_OPTIONS = [1, 2] as const;

export interface CourtChip {
  playerId: string;
  displayName: string;
  /** Optional. Most chips carry none. */
  seedLetter: "A" | "B" | "C" | null;
}

export interface SetupCourt {
  courtNumber: number;
  /** "Court 1". The rest of the app keys on this identity. */
  label: string;
  /** The default split is balanced; tapping a chip rebalances it by hand. */
  players: CourtChip[];
}

export interface CourtsProps {
  /** One entry per court at the current count, in court order. */
  courts: SetupCourt[];
  /** 1 or 2. Changing it re-splits everyone and re-renders the cards. */
  courtCount: number;
  onCourtCountChange: (count: number) => void;
  /** Moves that player to the other court. */
  onMovePlayer: (playerId: string) => void;
  /** The empty court card's only action. */
  onAssignPlayers: (courtNumber: number) => void;
  /** Back returns to frame 06. */
  onBack: () => void;
  onNext: () => void;
}

const Chip = ({ chip, onMove }: { chip: CourtChip; onMove: (() => void) | null }) => {
  const inside = (
    <>
      {chip.displayName}
      {chip.seedLetter != null && <span style={{ color: T.ink45 }}> {chip.seedLetter}</span>}
    </>
  );
  const skin = {
    font: "600 14px Inter, sans-serif", whiteSpace: "nowrap" as const,
    border: `1px solid ${SETUP.lineChip}`, borderRadius: 999, padding: "6px 11px",
    background: "transparent", color: T.ink,
  };
  // With one court there is nowhere to move to, so the chip is not a control.
  return onMove == null
    ? <span style={skin}>{inside}</span>
    : <button type="button" onClick={onMove} style={{ ...skin, cursor: "pointer" }}>{inside}</button>;
};

const EmptyCourt = ({ court, onAssign }: { court: SetupCourt; onAssign: () => void }) => (
  // v1 frame 24b. The dashed card replaces the whole court card, count and all.
  <Card style={{
    border: `1px dashed ${SETUP.lineDashed}`, padding: "26px 16px",
    alignItems: "center", gap: 12,
  }}>
    <span style={{ font: "800 16px Inter, sans-serif" }}>{court.label}</span>
    <p style={{
      font: "400 14px/1.5 Inter, sans-serif", color: T.ink60, margin: 0, textAlign: "center",
    }}>
      No one on {court.label} yet.
    </p>
    <SecondaryButton onClick={onAssign} style={{ width: "auto", minHeight: 46, padding: "8px 22px" }}>
      Assign players
    </SecondaryButton>
  </Card>
);

export const Courts = ({
  courts, courtCount, onCourtCountChange, onMovePlayer, onAssignPlayers, onBack, onNext,
}: CourtsProps) => {
  const sizes = courts.map((c) => c.players.length);
  const even = courts.length > 1 && sizes.every((n) => n === sizes[0]);

  /*
    Only the even two-court sentence is drawn. The spec directs deriving the
    rest from the same shape: one declarative line, no em dash. Both derived
    forms state the split plainly and still need sign-off.
  */
  const helper = even ? (
    <>Both courts are even at <Num size={22}>{sizes[0]}</Num>.</>
  ) : (
    <>
      {courts.map((court, i) => (
        <Fragment key={court.courtNumber}>
          {i > 0 && ", "}{court.label} has <Num size={22}>{court.players.length}</Num>
        </Fragment>
      ))}.
    </>
  );

  return (
    <Screen>
      <TopBar onBack={onBack} right={<StepCounter step={3} />} />

      <Body style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <H1>How many courts?</H1>
        <Sub>Two courts means two sets of standings.</Sub>

        <div role="radiogroup" style={{ display: "flex", gap: 10 }}>
          {COUNT_OPTIONS.map((n) => {
            const on = n === courtCount;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onCourtCountChange(n)}
                style={{
                  flex: 1, height: 56, borderRadius: T.radius, cursor: "pointer",
                  boxSizing: "border-box",
                  border: on ? `2px solid ${T.ink}` : `1px solid ${T.line}`,
                  background: on ? T.lime : "transparent",
                  color: on ? T.limeInk : T.ink,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {/* The count tiles are drawn unpadded; only the court sizes pad. */}
                <Num size={36}>{n}</Num>
              </button>
            );
          })}
        </div>

        <QuietLine>Tap a name to move it. The letter is a seeding hint and never shows on court.</QuietLine>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {courts.map((court) => court.players.length === 0 ? (
            <EmptyCourt key={court.courtNumber} court={court} onAssign={() => onAssignPlayers(court.courtNumber)} />
          ) : (
            <Card key={court.courtNumber} style={{ border: `1px solid ${T.line}`, gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ font: "700 17px Inter, sans-serif" }}>{court.label}</span>
                <Num size={26}>{pad2(court.players.length)}</Num>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {court.players.map((chip) => (
                  <Chip
                    key={chip.playerId}
                    chip={chip}
                    onMove={courts.length > 1 ? () => onMovePlayer(chip.playerId) : null}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Body>

      <FooterBar helper={helper}>
        <PrimaryButton onClick={onNext}>Next: matches each</PrimaryButton>
      </FooterBar>
    </Screen>
  );
};

export default Courts;
