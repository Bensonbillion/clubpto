// Stranding and substitution, the two questions a hand-arranged court raises.
//
// Both shapes under test here came out of the stress script, not imagination:
// an operator really can drag a second B onto the C court, and a night really
// can put two C's on a court of A's. The laws in engine/tiers.ts make both
// players unschedulable, and the failure this file guards against is silence:
// a player the queue can never deal sits on the bench all night with nothing
// on screen saying why.

import { describe, expect, it } from "vitest";
import type { Match, Player, PlayerTier } from "../../types";
import { legalSubstitutes, strandedPlayers, swapIntoMatch } from "../substitutes";
import { lawContextFor } from "../rotation";

const P = (id: string, court: number, tier?: PlayerTier): Player => ({
  id,
  name: id.toUpperCase(),
  walkIn: false,
  courtNumber: court,
  away: false,
  joinedAtMatchIndex: null,
  ...(tier !== undefined ? { tier } : {}),
});

const live = (
  court: number,
  teamA: [string, string],
  teamB: [string, string],
): Match => ({
  id: `m-${teamA.join("")}-${teamB.join("")}`,
  courtNumber: court,
  matchIndex: 1,
  teamA,
  teamB,
  scoreA: null,
  scoreB: null,
  status: "onCourt",
  startedAt: 1,
  completedAt: null,
  stage: null,
});

const ids = (players: readonly Player[]) => players.map((p) => p.id);

describe("stranded players", () => {
  it("strands the second B on a C court, and only the second B", () => {
    // Stress script shape one. Only the designated B may join C matches, and
    // two B's alone cannot form a B match of four, so the spare B has no
    // legal foursome anywhere on the court. Without this detection they sit
    // out the whole night and nothing on screen ever explains it.
    const players = [
      P("b1", 1, "B"),
      P("b2", 1, "B"),
      ...Array.from({ length: 10 }, (_, i) => P(`c${i + 1}`, 1, "C")),
    ];
    expect(ids(strandedPlayers(players, 1))).toEqual(["b2"]);
  });

  it("strands two C's on a court of A's with no B's, and no A with them", () => {
    // Stress script shape two. Below three C's the court runs relaxed, so
    // these C's may play among B's, but there are no B's here and the wall
    // against A's never moves. Missing this would let the split screen bless
    // a court where two beginners can never once walk on.
    const players = [
      ...Array.from({ length: 6 }, (_, i) => P(`a${i + 1}`, 1, "A")),
      P("c1", 1, "C"),
      P("c2", 1, "C"),
    ];
    expect(ids(strandedPlayers(players, 1))).toEqual(["c1", "c2"]);
  });

  it("strands nobody on a court the laws can fully deal", () => {
    // The designated B with three C's is the tightest legal court there is:
    // every match must be those exact four. If even this court reported a
    // stranding, the warning would fire on every normal C court and the
    // operator would learn to ignore it.
    const players = [P("b1", 1, "B"), P("c1", 1, "C"), P("c2", 1, "C"), P("c3", 1, "C")];
    expect(strandedPlayers(players, 1)).toEqual([]);
  });

  it("treats an unassessed player as a B, so a spare unassessed strands too", () => {
    // Unassessed counts as B everywhere the laws look, and stranding must
    // agree. If it did not, dragging an unassessed player onto the C court
    // would raise no warning while the queue still refused to ever deal them.
    const players = [
      P("b1", 1, "B"),
      P("u1", 1),
      ...Array.from({ length: 6 }, (_, i) => P(`c${i + 1}`, 1, "C")),
    ];
    expect(ids(strandedPlayers(players, 1))).toEqual(["u1"]);
  });

  it("ignores away players on both sides of the question", () => {
    // An away player takes no new games, so they cannot be stranded, and
    // they cannot rescue anybody as company they will never actually be. Here
    // the only other C's are away, so the present C is judged against a court
    // that in truth holds nobody they may play with.
    const away = (p: Player): Player => ({ ...p, away: true });
    const players = [
      ...Array.from({ length: 4 }, (_, i) => P(`a${i + 1}`, 1, "A")),
      P("c1", 1, "C"),
      away(P("c2", 1, "C")),
      away(P("c3", 1, "C")),
    ];
    expect(ids(strandedPlayers(players, 1))).toEqual(["c1"]);
  });

  it("returns whole players, because the caller is a warning sentence", () => {
    // The shell phrases "NAME has nobody to play with" from this result. An
    // id-only answer would send the screen back to the roster to look the
    // name up, and a mismatch there would print an id at the operator.
    const players = [
      P("b1", 1, "B"),
      P("b2", 1, "B"),
      P("c1", 1, "C"),
      P("c2", 1, "C"),
      P("c3", 1, "C"),
    ];
    const stranded = strandedPlayers(players, 1);
    expect(stranded).toHaveLength(1);
    expect(stranded[0].name).toBe("B2");
  });
});

describe("legal substitutes", () => {
  it("offers only B's when a B leaves a match that holds two, unassessed included", () => {
    // The stress script's case. The match has a B on each side by law, so the
    // vacated seat must stay a B seat: judging the four names without their
    // sides would offer an A who then stands exactly where the protected B
    // was, which is the hunted-B game the first law exists to prevent.
    const players = [
      P("a1", 1, "A"), P("a2", 1, "A"), P("a3", 1, "A"),
      P("b1", 1, "B"), P("b2", 1, "B"), P("b3", 1, "B"),
      P("u1", 1),
    ];
    const match = live(1, ["a1", "b1"], ["a2", "b2"]);
    const offered = legalSubstitutes(match, "b1", players, lawContextFor(players, 1));
    // u1 is unassessed and counts as B, so keeping them out of this list
    // would shrink the bench for no reason the laws recognise.
    expect(ids(offered)).toEqual(["b3", "u1"]);
  });

  it("offers only the other C's when a C leaves a C match", () => {
    // The court holds a spare B beyond the designated one. Swapping the spare
    // B into a C match would either make two B's in it or replace the one
    // consistent face the C's were promised, so the only legal list is the
    // benched C's.
    const players = [
      P("b1", 1, "B"), P("b2", 1, "B"),
      P("c1", 1, "C"), P("c2", 1, "C"), P("c3", 1, "C"), P("c4", 1, "C"), P("c5", 1, "C"),
    ];
    const match = live(1, ["c1", "c2"], ["c3", "b1"]);
    const offered = legalSubstitutes(match, "c1", players, lawContextFor(players, 1));
    expect(ids(offered)).toEqual(["c4", "c5"]);
  });

  it("never offers the spare B for the designated B's own seat", () => {
    // The designated B is the same person all night. If their seat could be
    // refilled by any B on the bench, the C's would meet a rotating cast,
    // which is precisely what designation exists to prevent. The four-C shape
    // is the only legal refill.
    const players = [
      P("b1", 1, "B"), P("b2", 1, "B"),
      P("c1", 1, "C"), P("c2", 1, "C"), P("c3", 1, "C"), P("c4", 1, "C"),
    ];
    const match = live(1, ["c1", "c2"], ["c3", "b1"]);
    const offered = legalSubstitutes(match, "b1", players, lawContextFor(players, 1));
    expect(ids(offered)).toEqual(["c4"]);
  });

  it("draws the bench from this court only, present players only", () => {
    // A substitute list that reached across the room would move a player
    // between courts as a side effect of a swap, and an away player offered
    // here would put somebody who already left the building into a live game.
    const players = [
      P("a1", 1, "A"), P("a2", 1, "A"),
      P("b1", 1, "B"), P("b2", 1, "B"), P("b3", 1, "B"),
      { ...P("b4", 1, "B"), away: true },
      P("b5", 2, "B"),
    ];
    const match = live(1, ["a1", "b1"], ["a2", "b2"]);
    const offered = legalSubstitutes(match, "b1", players, lawContextFor(players, 1));
    expect(ids(offered)).toEqual(["b3"]);
  });

  it("offers nobody for a seat that is not in the match", () => {
    // A mis-tapped id must not crash the night or invent a bench. Empty is
    // the honest answer: there is no seat to fill.
    const players = [P("b1", 1, "B"), P("b2", 1, "B"), P("b3", 1, "B"), P("b4", 1, "B"), P("b5", 1, "B")];
    const match = live(1, ["b1", "b2"], ["b3", "b4"]);
    expect(legalSubstitutes(match, "b5", players, lawContextFor(players, 1))).toEqual([]);
  });
});

describe("swapIntoMatch", () => {
  it("replaces the seat on the same side and moves nothing else", () => {
    // The other three were legal where they stand and the substitute was
    // judged FOR that seat. A swap that reshuffled sides would invalidate the
    // very judgement that allowed it.
    const match = live(1, ["a1", "b1"], ["a2", "b2"]);
    const swapped = swapIntoMatch(match, "b1", "b3");
    expect(swapped.teamA).toEqual(["a1", "b3"]);
    expect(swapped.teamB).toEqual(["a2", "b2"]);
    expect(swapped.id).toBe(match.id);
    expect(swapped.status).toBe(match.status);
  });

  it("returns a new match and leaves the original untouched", () => {
    // The screens hold the previous match while the new one renders. A swap
    // written in place would change a lineup the operator is still reading.
    const match = live(1, ["a1", "b1"], ["a2", "b2"]);
    const swapped = swapIntoMatch(match, "b2", "b3");
    expect(swapped).not.toBe(match);
    expect(match.teamB).toEqual(["a2", "b2"]);
  });

  it("changes nothing when the outgoing id is not in the match", () => {
    // The same posture as legalSubstitutes: a mis-tap changes nothing rather
    // than corrupting a team.
    const match = live(1, ["a1", "b1"], ["a2", "b2"]);
    const swapped = swapIntoMatch(match, "zz", "b3");
    expect(swapped.teamA).toEqual(match.teamA);
    expect(swapped.teamB).toEqual(match.teamB);
  });
});
