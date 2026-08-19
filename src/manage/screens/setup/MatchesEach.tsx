// Frame 08, Matches each. Step 4 of 4.
//
// Every game needs four players, so a court of N running a target of T plays
// N*T/4 matches, and that has to land on a whole number or somebody finishes
// the night a game short. `validTargets` is the same arithmetic the rotation
// engine runs, imported rather than repeated so this screen can never offer a
// target the engine would refuse.
//
// Frame 26 sets the rule this screen exists to follow: the app states the
// consequence rather than hiding the maths. So a target that does not divide
// stays on screen carrying its reason in full ("10 players by 3 does not
// divide into fours"), and a target that does divide says how many matches
// that actually buys. Ten a side reads its way to a target of 4 without the
// operator doing any arithmetic and without a number silently disappearing.

import type { CSSProperties } from "react";
import { totalMatches, validTargets } from "../../engine/rotation";
import { Body, FooterBar, PrimaryButton, Screen, T } from "../../ui/primitives";
import { SetupHeader, Why } from "./shell";

/** The three targets frame 08 draws. Availability is decided per court size. */
const OFFERED = [3, 4, 5];

export interface MatchesEachProps {
  /**
   * Players on a court. The frame assumes the courts are even, which is what
   * frame 07 spends its whole screen keeping true, so one size describes them
   * all.
   */
  courtSize: number;
  /** How many courts run this target. Turns "per court" into "on the night". */
  courtCount: number;
  /** The chosen target. */
  selected: number;
  onSelect: (target: number) => void;
  /**
   * Rough length of one match, used only to say what a longer target costs in
   * time. Null and that clause is dropped rather than estimated.
   */
  minutesPerMatch: number | null;
  /** Back returns to frame 07. */
  onBack?: () => void;
  onNext: () => void;
}

export const MatchesEach = ({
  courtSize, courtCount, selected, onSelect, minutesPerMatch, onBack, onNext,
}: MatchesEachProps) => {
  const available = validTargets(courtSize);
  // The shortest target that divides is the night's baseline: it is the one
  // that keeps its own name, and every longer option is priced against it.
  const shortest = available.length > 0 ? available[0] : null;
  const shortestMatches = shortest != null ? totalMatches(courtSize, shortest) : 0;

  const title = (target: number): string => {
    if (!available.includes(target)) return "Unavailable";
    if (target === selected || shortest == null || target === shortest) {
      return `${target} matches each`;
    }
    return "Longer night";
  };

  const body = (target: number): string => {
    if (!available.includes(target)) {
      // The frame spells the numbers out because it is a mockup with one
      // headcount in it. Digits here, because the real ones are whatever
      // walked through the door.
      return `${courtSize} players by ${target} does not divide into fours.`;
    }

    const perCourt = totalMatches(courtSize, target);
    const parts = [
      courtCount > 1
        ? `${perCourt} matches per court, ${perCourt * courtCount} on the night.`
        : `${perCourt} matches on the night.`,
    ];

    if (target === selected) parts.push("Partners rotate every round.");

    const extra = (perCourt - shortestMatches) * (minutesPerMatch ?? 0);
    if (minutesPerMatch != null && extra > 0) parts.push(`Adds about ${extra} minutes.`);

    return parts.join(" ");
  };

  // A target the arithmetic refuses cannot be started, so the forward action
  // waits for one that works and leaves the reasons on screen.
  const ready = available.includes(selected);

  return (
    <Screen>
      <SetupHeader title="How many matches each?" step="4 of 4" onBack={onBack} />
      <Why>Every game needs four players, so the target has to divide the court.</Why>

      <Body style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {OFFERED.map((target) => {
            const usable = available.includes(target);
            const on = usable && target === selected;

            // The chosen target is the one filled card on the screen. Both the
            // other rows sit at half strength whether they are merely unchosen
            // or genuinely impossible, exactly as the frame draws them: the
            // copy is what separates the two, not the treatment.
            //
            // The card geometry is written out here rather than reached for
            // through the Card primitive, because a sage FILL is not one of the
            // three tones a card has and a card wrapped around a button would
            // put the tap target inside the shape instead of on it.
            const skin: CSSProperties = {
              display: "flex", alignItems: "center", gap: 18, width: "100%",
              boxSizing: "border-box", textAlign: "left",
              background: on ? T.acc : T.raised,
              border: `${on ? 2 : 1.5}px solid ${on ? T.acc : T.line}`,
              borderRadius: T.radius, padding: "16px 18px",
              color: on ? T.accInk : T.ink,
              opacity: on ? 1 : 0.5,
            };

            const inside = (
              <>
                <span style={{
                  fontFamily: T.fontHead, fontWeight: 400, fontSize: on ? 44 : 38,
                  fontVariantNumeric: "tabular-nums", width: 44, textAlign: "center",
                  flexShrink: 0,
                }}>{target}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={on ? {
                    display: "block", fontFamily: T.fontHead, fontWeight: 400, fontSize: 18,
                  } : {
                    display: "block", font: `600 16px ${T.fontBody}`,
                  }}>{title(target)}</span>
                  <span style={{
                    display: "block", font: `400 14px/1.45 ${T.fontBody}`,
                    color: on ? T.accInk : T.mut, marginTop: 3,
                  }}>{body(target)}</span>
                </span>
              </>
            );

            return usable ? (
              <button
                key={target}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onSelect(target)}
                style={{ ...skin, cursor: "pointer" }}
              >{inside}</button>
            ) : (
              <div key={target} aria-disabled style={skin}>{inside}</div>
            );
          })}
        </div>
      </Body>

      <FooterBar helper="The guide updates as people arrive or leave.">
        <PrimaryButton disabled={!ready} onClick={onNext}>Next: ready</PrimaryButton>
      </FooterBar>
    </Screen>
  );
};

export default MatchesEach;
