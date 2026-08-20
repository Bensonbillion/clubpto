// The card must grow for a late arrival, or the court bricks.
//
// Found running the 30-player stress script on the live site. A17 joined
// Court 1 mid-flight and the card absorbed him while it still had projected
// rows. But once every row was played with A17 on three of four, the card was
// spent, no new row could exist, and the court fell into the readiness hold
// with a spent button and no words: A17 could never get his fourth game, the
// court could never complete, and the playoff could never seed. The operator
// was walled off from their own night.
//
// The rule that fixes it is the same one the designated-B overshoot already
// established: NOBODY FINISHES SHORT. When a present player is still owed and
// the spent rows cannot serve them, the card grows enough rows for the most
// owed player, and the overshoot lands on players who already had their
// games, which the spec's own words absorb: nobody exceeds anyone by more
// than the disruptions explain.

import { describe, expect, it } from "vitest";
import type { Match, Player, Session } from "../../types";
import { scheduleFor } from "../../useSession";

const P = (id: string, court: number, away = false): Player => ({
  id, name: id, walkIn: false, courtNumber: court, away, joinedAtMatchIndex: null,
});

let seq = 0;
const played = (slot: number, a: [string, string], b: [string, string]): Match => ({
  id: `m${++seq}`, courtNumber: 1, matchIndex: slot, teamA: a, teamB: b,
  scoreA: 7, scoreB: 5, status: "played", startedAt: slot, completedAt: slot * 1000, stage: null,
});

describe("a spent card with somebody still owed grows a row", () => {
  it("the late arrival's remaining games fit on fresh rows", () => {
    // Four players play out a 3-target card (3 rows), then a fifth arrives.
    seq = 0;
    const players = ["a", "b", "c", "d"].map((x) => P(x, 1));
    const matches = [
      played(1, ["a", "b"], ["c", "d"]),
      played(2, ["a", "c"], ["b", "d"]),
      played(3, ["a", "d"], ["b", "c"]),
    ];
    const late = P("late", 1);
    const session: Session = {
      id: "n", dayLabel: "W", date: "d", status: "running",
      players: [...players, late], courts: [], matches,
      startedAt: 1, endedAt: null,
    };
    const rows = scheduleFor(session, { number: 1, targetMatches: 3, playoffSeeded: false, champion: null });
    // Three spent rows cannot serve `late`, who is owed three. The card must
    // hold at least three more rows, each fielding the late arrival.
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const pending = rows.filter((r) => r.status !== "played");
    expect(pending.length).toBeGreaterThanOrEqual(3);
    for (const r of pending.slice(0, 3)) {
      expect([...(r.teamA ?? []), ...(r.teamB ?? [])]).toContain("late");
    }
  });
});
