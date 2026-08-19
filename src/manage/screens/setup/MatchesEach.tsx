// Frame 08 — How many matches each. Step 4 of 4.
//
// Every game needs four players, so a court of N running a target of T plays
// N*T/4 matches, and that has to land on a whole number or somebody finishes
// the night a game short. `validTargets` is the same arithmetic the rotation
// engine runs, imported rather than repeated so the screen can never offer a
// target the engine would refuse.
//
// Targets that do not divide stay on screen, greyed, carrying the reason. The
// whole point of the frame is that the manager reads why a number is gone
// instead of wondering where it went.

import { totalMatches, validTargets } from "../../engine/rotation";
import { Body, FooterBar, Num, PrimaryButton, Screen, T } from "../../ui/primitives";
import { H1, QuietLine, SETUP, StepCounter, Sub, TopBar } from "./shell";

/** The four targets the frame draws. Availability is decided per court size. */
const OFFERED = [2, 3, 4, 5];

/**
 * Descriptive copy exists for these three only. A target with no line drawn
 * against it renders its numeral alone rather than borrowed wording.
 */
const REASONS: Record<number, string> = {
  3: "The usual on two courts.",
  4: "Long night. Extend later if there is time.",
};

export interface MatchesEachProps {
  /** "Court 1". The sub line and the footer sentence both name it. */
  courtLabel: string;
  /** Players on that court, from step 3. Every target divides into this. */
  courtSize: number;
  /** The chosen target. */
  selected: number;
  onSelect: (target: number) => void;
  /** Fills the `2` row. Null when no estimate exists. */
  minutesPerMatch: number | null;
  /** Back returns to frame 07. */
  onBack: () => void;
  onNext: () => void;
}

// FLAG: no loading or error variant is drawn for this frame. Nothing rendered.

export const MatchesEach = ({
  courtLabel, courtSize, selected, onSelect, minutesPerMatch, onBack, onNext,
}: MatchesEachProps) => {
  const available = validTargets(courtSize);
  // The drawn reason names the nearest target that does divide, which is the
  // smallest valid one: "15 players needs a target of 4."
  const nearest = available.length > 0 ? available[0] : null;

  const label = (target: number) => {
    if (!available.includes(target)) {
      // FLAG: with no valid target at all the sentence has no number to name,
      // so the row carries its numeral and nothing else. Needs copy.
      if (nearest == null) return null;
      return (
        <>
          <Num size={20}>{courtSize}</Num>{" "}players needs a target of{" "}
          <Num size={20}>{nearest}</Num>.
        </>
      );
    }
    if (target === 2) {
      // FLAG: the `2` row is entirely the minutes estimate. Without one there
      // is no sentence to print, so the row shows its numeral alone.
      if (minutesPerMatch == null) return null;
      return <>Short night, about <Num size={20}>{minutesPerMatch}</Num> minutes each.</>;
    }
    // FLAG: target 5 has no descriptive line anywhere in either wireframe. It
    // is drawn only in its unavailable state, so when it divides cleanly the
    // row renders bare. Needs copy.
    return REASONS[target] ?? null;
  };

  const blocked = available.length === 0;
  // A target that does not divide has no whole match count to state, so the
  // sentence waits for a selection the arithmetic actually supports.
  const stateable = available.includes(selected);

  return (
    <Screen>
      <TopBar onBack={onBack} right={<StepCounter step={4} />} />

      <Body style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <H1>How many matches each?</H1>
        <Sub>
          {courtLabel} has <Num size={20}>{courtSize}</Num> players. Every target below has to
          divide into fours.
        </Sub>

        <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          {OFFERED.map((target) => {
            const on = target === selected;
            const usable = available.includes(target);
            const body = (
              <>
                <Num size={34} style={{ width: 34, flexShrink: 0 }}>{target}</Num>
                <span style={{
                  font: on ? "600 15px Inter, sans-serif" : "400 15px Inter, sans-serif",
                  // Greyed rows keep full-colour text so the reason stays readable.
                  color: on ? T.limeInk : usable ? T.ink60 : T.ink,
                }}>
                  {label(target)}
                </span>
              </>
            );
            const skin = {
              borderRadius: T.radius, padding: "14px 16px", boxSizing: "border-box" as const,
              display: "flex", alignItems: "center", gap: 14, width: "100%",
              textAlign: "left" as const,
            };

            return usable ? (
              <button
                key={target}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onSelect(target)}
                style={{
                  ...skin, cursor: "pointer",
                  border: on ? `2px solid ${T.ink}` : `1px solid ${T.line}`,
                  background: on ? T.lime : "transparent",
                  color: on ? T.limeInk : T.ink,
                }}
              >{body}</button>
            ) : (
              <div
                key={target}
                aria-disabled
                style={{
                  ...skin, border: `1px dashed ${SETUP.lineDashed}`, opacity: 0.55,
                  background: "transparent", color: T.ink,
                }}
              >{body}</div>
            );
          })}
        </div>

        <QuietLine style={{ marginTop: "auto" }}>
          Greyed targets stay visible so the reason is readable, not hidden.
        </QuietLine>
      </Body>

      {/*
        FLAG: when no target divides there is no state to restate, and no copy
        is drawn for it, so the status line is dropped and Next is blocked
        with the reasons left on screen.
      */}
      <FooterBar helper={!stateable ? undefined : (
        <>
          <Num size={22}>{selected}</Num>{" "}each means{" "}
          <Num size={22}>{totalMatches(courtSize, selected)}</Num> matches on {courtLabel}.
        </>
      )}>
        <PrimaryButton disabled={blocked} onClick={onNext}>Next: review</PrimaryButton>
      </FooterBar>
    </Screen>
  );
};

export default MatchesEach;
