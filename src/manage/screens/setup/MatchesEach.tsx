// Frame 08, Matches each. Step 4 of 4.
//
// Every game needs four players, so a court of N running a target of T plays
// N*T/4 matches, and that has to land on a whole number or somebody finishes
// the night a game short. `validTargets` is the same arithmetic the rotation
// engine runs, imported rather than repeated so this screen can never offer a
// target the engine would refuse.
//
// TARGETS ARE PER COURT. Frame B31's footer says so in as many words, and its
// two cards prove it on one night: sixteen divides at 3 for twelve matches
// while fourteen divides only at 4 for fourteen. So each court answers the
// question for itself, on this one screen because the frame draws both courts
// on one step, seeded by the suggestion made at the split, and the forward
// action waits until every court's answer divides.
//
// Frame 26 sets the rule the copy follows: the app states the consequence
// rather than hiding the maths. So a target that does not divide stays on
// screen carrying its reason in full ("10 players by 3 does not divide into
// fours"), and a target that does divide says how many matches that actually
// buys.

import type { CSSProperties } from "react";
import { totalMatches, validTargets } from "../../engine/rotation";
import { Body, FooterBar, PrimaryButton, Screen, T } from "../../ui/primitives";
import { SetupHeader, Why } from "./shell";

/** The three targets frame 08 draws. Availability is decided per court size. */
const OFFERED = [3, 4, 5];

export interface MatchesEachCourt {
  courtNumber: number;
  /** "Court 1". */
  label: string;
  /** Players on that court as the split stands. */
  size: number;
  /** This court's target as it stands, seeded from the suggested split. */
  selected: number;
}

export interface MatchesEachProps {
  /** One entry per court, in court order. Every court holds its own answer. */
  courts: MatchesEachCourt[];
  onSelect: (courtNumber: number, target: number) => void;
  /**
   * Rough length of one match, used only to say what a longer target costs in
   * time. Null and that clause is dropped rather than estimated.
   */
  minutesPerMatch: number | null;
  /** Back returns to frame 07. */
  onBack?: () => void;
  onNext: () => void;
}

/**
 * The targets a court of this size can actually run.
 *
 * `validTargets` only checks divisibility, so the floor of four is applied
 * here: without it a court of three would offer target 4 because 3 x 4
 * divides, which is arithmetic about a match nobody can field.
 */
const runnable = (size: number): number[] => (size >= 4 ? validTargets(size) : []);

/** One court's three option cards, sized and priced from its own headcount. */
const CourtTargets = ({ court, oneCourt, minutesPerMatch, onSelect }: {
  court: MatchesEachCourt;
  /** True on a one-court night, where "this court" and "the night" are one. */
  oneCourt: boolean;
  minutesPerMatch: number | null;
  onSelect: (target: number) => void;
}) => {
  const available = runnable(court.size);
  // The shortest target that divides is this court's baseline: it is the one
  // that keeps its own name, and every longer option is priced against it.
  const shortest = available.length > 0 ? available[0] : null;
  const shortestMatches = shortest != null ? totalMatches(court.size, shortest) : 0;

  const title = (target: number): string => {
    if (!available.includes(target)) return "Unavailable";
    if (target === court.selected || shortest == null || target === shortest) {
      return `${target} matches each`;
    }
    return "Longer night";
  };

  const body = (target: number): string => {
    // No frame draws a too-small court reaching this step; the split screen
    // already carries the warning, so the reason here is one plain sentence.
    if (court.size < 4) {
      return `${court.size} players cannot make a match of four.`;
    }
    if (!available.includes(target)) {
      // The frame spells the numbers out because it is a mockup with one
      // headcount in it. Digits here, because the real ones are whatever
      // walked through the door.
      return `${court.size} players by ${target} does not divide into fours.`;
    }

    const perCourt = totalMatches(court.size, target);
    const parts = [
      oneCourt
        ? `${perCourt} matches on the night.`
        : `${perCourt} matches on this court.`,
    ];

    if (target === court.selected) parts.push("Partners rotate every round.");

    const extra = (perCourt - shortestMatches) * (minutesPerMatch ?? 0);
    if (minutesPerMatch != null && extra > 0) parts.push(`Adds about ${extra} minutes.`);

    return parts.join(" ");
  };

  return (
    <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {OFFERED.map((target) => {
        const usable = available.includes(target);
        const on = usable && target === court.selected;

        // The chosen target is the one filled card in the group. Both the
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
  );
};

export const MatchesEach = ({
  courts, onSelect, minutesPerMatch, onBack, onNext,
}: MatchesEachProps) => {
  // A target the arithmetic refuses cannot be started, so the forward action
  // waits until EVERY court's answer works and leaves the reasons on screen.
  const ready = courts.every((c) => runnable(c.size).includes(c.selected));

  // Frame B31's own footer line, with its em dash restructured to a comma.
  // The frame draws a two-court night, so "both" is its word; more courts
  // than the frame drew extend the sentence, and one court keeps frame 08's.
  const helper = courts.length === 1
    ? "The guide updates as people arrive or leave."
    : courts.length === 2
      ? "Targets are per court, both make whole matches."
      : "Targets are per court, every court makes whole matches.";

  return (
    <Screen>
      <SetupHeader title="How many matches each?" step="4 of 4" onBack={onBack} />
      <Why>Every game needs four players, so the target has to divide the court.</Why>

      <Body style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 26 }}>
        {courts.map((court) => (
          <section key={court.courtNumber} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* One court needs no heading: the whole screen is its card, which
                is exactly what frame 08 draws. The header row is frame B31's,
                label left and the count in the accent, matching frame 07. */}
            {courts.length > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: T.fontHead, fontWeight: 400, fontSize: 18 }}>
                  {court.label}
                </span>
                <span style={{
                  fontFamily: T.fontHead, fontWeight: 400, fontSize: 20,
                  fontVariantNumeric: "tabular-nums", color: T.acc,
                }}>{court.size}</span>
              </div>
            )}
            <CourtTargets
              court={court}
              oneCourt={courts.length === 1}
              minutesPerMatch={minutesPerMatch}
              onSelect={(target) => onSelect(court.courtNumber, target)}
            />
          </section>
        ))}
      </Body>

      <FooterBar helper={helper}>
        <PrimaryButton disabled={!ready} onClick={onNext}>Next: ready</PrimaryButton>
      </FooterBar>
    </Screen>
  );
};

export default MatchesEach;
