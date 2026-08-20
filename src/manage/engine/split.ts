// The suggested split, and the per-court targets that make whole matches.
//
// "Tier suggests, it never gates." This module is the suggesting half of that
// sentence: it proposes where everyone starts and what each court's target
// should be, and the operator drags names by feel from there. Nothing here is
// enforced. The enforcing half is ./tiers, which judges the matches themselves.
//
// The suggestion follows the counts rather than a fixed rule, because the spec
// is explicit that the key is flexibility. A typical sixteen puts A and B on
// one court and gives C their own (frame A07). A night of 16 A, 4 B and 10 C
// puts all the A's alone and the B's in with the C's (frame B31), because C
// never plays with an A and B is the bridge. Some nights have no C at all.
// One rule generates all of those: C's on the last court, A's on the first,
// and every B placed onto whichever court is currently smaller.

import type { Player } from "../types";
import { tierOf, MIN_CS_FOR_A_C_MATCH, type Tier } from "./tiers";
import { validTargets } from "./rotation";

export interface SplitSuggestion {
  /** playerId -> suggested court number. Every present player appears once. */
  assignment: ReadonlyMap<string, number>;
  /** court number -> suggested target, chosen so size x target divides by 4. */
  targets: ReadonlyMap<number, number>;
  /** Facts the operator should hear before the night starts, not in round two. */
  notes: SplitNote[];
}

export type SplitNote =
  /**
   * Fewer than three C's turned up, so no legal C match can be formed anywhere.
   * The C's play among the B's for the night, still walled off from every A.
   */
  | { kind: "tooFewCs"; cCount: number }
  /**
   * Exactly three C's. Four-C's is impossible, so every C match needs the
   * designated B, who will play more games than their own target. Somebody has
   * to absorb the odd shape: either the B plays extra or the C's finish short,
   * and the B is the volunteer bridge, so the B absorbs it.
   */
  | { kind: "exactlyThreeCs"; courtNumber: number }
  /**
   * A court's size has no valid target at all (fewer than four players), so it
   * cannot run. The operator has to move people before starting.
   */
  | { kind: "courtTooSmall"; courtNumber: number; size: number }
  /**
   * Somebody on this court has no legal foursome at all: no three companions
   * exist for them in any arrangement the laws allow. The second B dragged
   * onto a C court is the usual way, because only the designated B may join C
   * matches and two B's alone cannot make a match of four.
   *
   * suggestSplit never emits this note, and the shell must not expect it to.
   * Stranding is a fact about the court AS IT STANDS, created and cured by
   * hand drags, and the courts screen already re-derives its warnings live
   * because a note frozen at suggestion time keeps warning about a court the
   * operator has fixed. The shell judges it after each drag with
   * engine/substitutes.ts strandedPlayers and phrases the names it gets back.
   */
  | { kind: "stranded"; courtNumber: number; names: string[] };

/**
 * The suggested target for a court of this size.
 *
 * Three matches each when the room divides that way, four otherwise. Four
 * always divides (size x 4 is always a multiple of 4), so every court of at
 * least four players gets a real answer. Frame B31 shows both on one night:
 * sixteen at target 3 is twelve matches, fourteen at target 4 is fourteen.
 */
export function suggestTarget(courtSize: number): number | null {
  if (courtSize < 4) return null;
  const valid = validTargets(courtSize);
  if (valid.includes(3)) return 3;
  if (valid.includes(4)) return 4;
  return valid[0] ?? null;
}

/**
 * Suggest a starting split for the night.
 *
 * `players` is everyone ticked in, in seat order. `courtCount` is how many
 * courts the operator chose. The suggestion never returns an empty court while
 * another court could spare somebody, and it never puts a C on a court that
 * holds an A, because the wall between them is the one law with no exception
 * and a suggestion that starts the night illegal is not a suggestion.
 */
export function suggestSplit(
  players: readonly Player[],
  courtCount: number,
): SplitSuggestion {
  const assignment = new Map<string, number>();
  const notes: SplitNote[] = [];
  const courts = Array.from({ length: Math.max(1, courtCount) }, (_, i) => i + 1);

  const byTier = (t: Tier) => players.filter((p) => tierOf(p) === t);
  const as = byTier("A");
  const bs = byTier("B");
  const cs = byTier("C");

  if (cs.length > 0 && cs.length < MIN_CS_FOR_A_C_MATCH) {
    notes.push({ kind: "tooFewCs", cCount: cs.length });
  }

  const sizes = new Map<number, number>(courts.map((c) => [c, 0]));
  const place = (p: Player, court: number) => {
    assignment.set(p.id, court);
    sizes.set(court, (sizes.get(court) ?? 0) + 1);
  };
  const smallest = (among: readonly number[]): number =>
    among.reduce((best, c) => ((sizes.get(c) ?? 0) < (sizes.get(best) ?? 0) ? c : best));

  if (courts.length === 1) {
    // One court for everyone. The laws in ./tiers handle the mixing per match,
    // so the split has nothing to decide.
    players.forEach((p) => place(p, courts[0]));
  } else {
    // A's fill from the front, C's fill from the back, and the two never meet
    // on a court. A's spill onto the second court only when the first is
    // already carrying its even share, and the spill stops before the C court.
    const evenShare = Math.ceil(players.length / courts.length);
    const cCourt = courts[courts.length - 1];
    const aCourts = courts.slice(0, -1);

    as.forEach((p) => {
      const open = aCourts.filter((c) => (sizes.get(c) ?? 0) < evenShare);
      place(p, open.length > 0 ? smallest(open) : smallest(aCourts));
    });
    cs.forEach((p) => place(p, cCourt));
    // B is the bridge: each one goes to whichever court is currently smaller,
    // which is what turns 16 A, 4 B, 10 C into all-A against B-with-C without
    // that shape ever being written down as a rule.
    bs.forEach((p) => place(p, smallest(courts)));
  }

  const targets = new Map<number, number>();
  for (const c of courts) {
    const size = sizes.get(c) ?? 0;
    const t = suggestTarget(size);
    if (t === null) {
      notes.push({ kind: "courtTooSmall", courtNumber: c, size });
    } else {
      targets.set(c, t);
    }
  }

  if (cs.length === MIN_CS_FOR_A_C_MATCH) {
    const courtOfCs = assignment.get(cs[0].id);
    if (courtOfCs !== undefined) {
      notes.push({ kind: "exactlyThreeCs", courtNumber: courtOfCs });
    }
  }

  return { assignment, targets, notes };
}
