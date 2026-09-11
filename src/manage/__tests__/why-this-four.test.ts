// Frame 11's sentences, and the roster footer's one.
//
// Both are copy the operator reads out to a player who asked why they are
// sitting, so both are tested as strings rather than through a render. The
// rule at issue is the third law (2026-09-10): an A plays one game with the
// B's a night and never a second, which is allowed to hold a least-played
// player back a game. That makes two sentences that used to be flat true
// conditional, and a screen that keeps saying them is the bug.
//
// Half of these drive the engine rather than hand-building a reason. A card
// that reads correctly off a made-up note and wrongly off a real draw is the
// failure this file exists to catch: until 2026-09-11 frame 11 called
// explainMatch, which handed back an empty heldBack whatever the picker had
// done, so the held-back sentence was tested here and unreachable in the app.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../types";
import type { MatchReason } from "../engine/rotation";
import { courtSpread, explainMatch, nextMatch } from "../engine/rotation";
import { leastPlayedWords, mixingWords } from "../screens/play/model";
import { countWord, roundRobinCounts } from "../screens/people/model";

const reasonOf = (over: Partial<MatchReason> = {}): MatchReason => ({
  leastPlayed: ["Benson", "Timi", "Ade", "Sam"].map((name, i) => ({
    playerId: `p${i}`, name, matchesPlayed: 1,
  })),
  courtSpread: 0,
  withinOneGame: true,
  fewestPlayed: true,
  waiting: [],
  balance: { kind: "noAssessedC", cPlayers: [], swap: null },
  mixing: { kind: "noAs", aPlayers: [], heldBack: [] },
  ...over,
});

/** An A and B court on one court, with names the assertions can read. */
const roster = (as: number, bs: number): Player[] => [
  ...Array.from({ length: as }, (_, i) => ({
    id: `a${i + 1}`, name: `A${i + 1}`, walkIn: false, courtNumber: 1, away: false,
    joinedAtMatchIndex: null, tier: "A" as const,
  })),
  ...Array.from({ length: bs }, (_, i) => ({
    id: `b${i + 1}`, name: `B${i + 1}`, walkIn: false, courtNumber: 1, away: false,
    joinedAtMatchIndex: null, tier: "B" as const,
  })),
];

/**
 * Play the night out, stopping at the first draw the caller is looking for,
 * and hand back the reason FRAME 11 would show: explainMatch over the match
 * sitting on court, exactly as ManageApp builds it.
 */
const frameElevenAt = (
  players: Player[],
  target: number,
  wanted: (reason: MatchReason) => boolean,
): MatchReason | null => {
  const played: Match[] = [];
  for (let n = 1; n <= 60; n += 1) {
    const drawn = nextMatch(players, played, 1, target);
    if (!drawn) return null;
    const live: Match = {
      id: `m${n}`, courtNumber: 1, matchIndex: n, teamA: drawn.teamA, teamB: drawn.teamB,
      scoreA: null, scoreB: null, status: "onCourt", startedAt: 0, completedAt: null, stage: null,
    };
    const shown = explainMatch(players, [...played, live], 1, drawn.teamA, drawn.teamB, target);
    if (wanted(shown)) return shown;
    played.push({ ...live, status: "played", scoreA: 2, scoreB: 0, completedAt: 0 });
  }
  return null;
};

/**
 * The card walked the way useSession's projectCard walks it, stepping past
 * the slots the caller names, with frame 11's reason for every row as it
 * goes live and the counts the card itself was drawing from beside it.
 *
 * Stepping past a row is an ordinary night (frame 12b), and it is the one
 * thing that separates the two logs frame 11 could be read off: the card
 * seeds a held row as played, the night's raw list counts it for nobody.
 * So the counts handed back here are the card's, taken before the live row
 * is added, which is what every sentence on the screen has to be true of.
 */
const cardWithSkips = (
  players: Player[],
  target: number,
  skipped: readonly number[],
): { reason: MatchReason; counts: Map<string, number> }[] => {
  const night: Match[] = [];
  const out: { reason: MatchReason; counts: Map<string, number> }[] = [];
  const total = (players.length * target) / 4;
  for (let slot = 1; slot <= total; slot += 1) {
    const asPlayed: Match[] = night.map((m) => ({ ...m, status: "played" as const }));
    const drawn = nextMatch(players, asPlayed, 1, target);
    if (!drawn) break;
    const live: Match = {
      id: `m${slot}`, courtNumber: 1, matchIndex: slot, teamA: drawn.teamA, teamB: drawn.teamB,
      scoreA: null, scoreB: null, status: "onCourt", startedAt: 0, completedAt: null, stage: null,
    };
    out.push({
      reason: explainMatch(players, [...night, live], 1, drawn.teamA, drawn.teamB, target),
      counts: new Map(players.map((p) => [
        p.id,
        asPlayed.filter((m) => [...m.teamA, ...m.teamB].includes(p.id)).length,
      ])),
    });
    night.push(skipped.includes(slot)
      ? { ...live, status: "skipped" }
      : { ...live, status: "played", scoreA: 2, scoreB: 0, completedAt: 0 });
  }
  return out;
};

describe("the first card stays true", () => {
  it("promises the court only while the court is keeping the promise", () => {
    expect(leastPlayedWords(reasonOf())).toBe(
      "Benson, Timi, Ade and Sam had played the fewest games, so they are on."
      + " Nobody on this court is ever more than one game behind.",
    );
    expect(leastPlayedWords(reasonOf({ courtSpread: 2, withinOneGame: false }))).toBe(
      "Benson, Timi, Ade and Sam had played the fewest games, so they are on.",
    );
  });

  it("never claims the fewest when the MIXING law, not the cap, passed somebody over", () => {
    // Three A's and five B's at three each, in order, nothing stepped past.
    // At the fourth game the four at the minimum are the three A's and one B,
    // which is a shape neither mixing law allows, so the picker reaches a
    // player on two games while an A on one sits. The cap did nothing here,
    // so heldBack is empty, and until 2026-09-11 the card answered the player
    // who asked with "they had played the fewest games", which was false.
    const shown = frameElevenAt(roster(3, 5), 3, (r) => !r.fewestPlayed);
    expect(shown).not.toBeNull();
    expect(shown!.mixing.heldBack).toEqual([]);
    const most = Math.max(...shown!.leastPlayed.map((p) => p.matchesPlayed));
    // Somebody off court really has had fewer games than somebody on it.
    expect(shown!.waiting.length).toBeGreaterThan(0);
    for (const p of shown!.waiting) expect(p.matchesPlayed).toBeLessThan(most);
    const words = leastPlayedWords(shown!);
    expect(words).not.toContain("had played the fewest games");
    expect(words).toMatch(/had played fewer and waits? a round/);
    for (const p of shown!.waiting) expect(words).toContain(p.name);
  });

  it("names no cause, because the four on court is not always a four this engine drew", () => {
    // The operator can swap somebody in (frame 15) or tap a row out of turn
    // (frame 12b), and the reason is then describing a lineup a person built.
    // Blaming the balance laws over one of those is the lie the frame's whole
    // design avoids, so this branch says only what the log supports: who has
    // had fewer games. The held-back branch may name its rule, because the
    // replay proved the picker drew that four (2026-09-11).
    const shown = frameElevenAt(roster(3, 5), 3, (r) => !r.fewestPlayed);
    expect(shown).not.toBeNull();
    const words = leastPlayedWords(shown!);
    expect(words).not.toContain("balance law");
    expect(words).not.toContain("because");
    expect(words).not.toContain("so they are on");
  });

  it("never promises a round to somebody who has finished their games", () => {
    // A disrupted night grows the card past the target, so the four on court
    // can be above it while a player who has had all their games sits below
    // them. They are out of the queue and no row is coming, so the card may
    // not tell them they wait a round. Built directly, because the state
    // needs a court whose counts have run past the target.
    const players = roster(2, 2).map((p, i) => ({ ...p, name: `P${i + 1}` }));
    const done = players[0];
    const ms: Match[] = [
      { id: "m1", courtNumber: 1, matchIndex: 1, teamA: [players[1].id, players[2].id],
        teamB: [players[3].id, done.id], scoreA: 2, scoreB: 0, status: "played",
        startedAt: 0, completedAt: 0, stage: null },
      { id: "m2", courtNumber: 1, matchIndex: 2, teamA: [players[1].id, players[2].id],
        teamB: [players[3].id, done.id], scoreA: 2, scoreB: 0, status: "played",
        startedAt: 0, completedAt: 0, stage: null },
    ];
    // Everyone is on two games and the target is two, so nobody is owed one.
    const r = explainMatch(players, ms, 1,
      [players[1].id, players[2].id], [players[3].id, done.id], 2);
    for (const p of r.waiting) expect(p.matchesPlayed).toBeLessThan(2);
    // And the fact the sentence is gated on still counts everybody, finished
    // or not, so a four that is not the fewest can never claim it is.
    const words = leastPlayedWords(r);
    if (!r.fewestPlayed) expect(words).not.toContain("had played the fewest games");
  });

  it("hands a phone three names and a count rather than a roll call", () => {
    // Reached out of order on a big court, every player off it can be below
    // the four, and eleven names in one sentence is not a sentence anybody
    // reads out to the person who asked.
    const many = reasonOf({
      fewestPlayed: false,
      waiting: ["Ese", "Idara", "Kai", "Olu", "Khalid", "Evelyn"].map((name, i) => ({
        playerId: `w${i}`, name, matchesPlayed: 0,
      })),
    });
    expect(leastPlayedWords(many)).toBe(
      "Benson, Timi, Ade and Sam are on. Ese, Idara, Kai and 3 others had played"
      + " fewer and wait a round. Nobody on this court is ever more than one game behind.",
    );
    // One name keeps its own verb.
    const one = reasonOf({
      fewestPlayed: false,
      waiting: [{ playerId: "w0", name: "Ese", matchesPlayed: 0 }],
    });
    expect(leastPlayedWords(one)).toContain("Ese had played fewer and waits a round.");
  });

  it("keeps the fewest-played sentence on the ordinary nights it is true of", () => {
    // The guard above must not swallow the frame's own sentence. Eight A's
    // and eight B's at three each, and the Wednesday roster: every draw of
    // both nights is genuinely the fewest played, so every card says so.
    for (const [as, bs] of [[8, 8], [12, 8]] as const) {
      const players = roster(as, bs);
      const played: Match[] = [];
      for (let n = 1; n <= 40; n += 1) {
        const drawn = nextMatch(players, played, 1, 3);
        if (!drawn) break;
        const live: Match = {
          id: `m${n}`, courtNumber: 1, matchIndex: n, teamA: drawn.teamA, teamB: drawn.teamB,
          scoreA: null, scoreB: null, status: "onCourt", startedAt: 0, completedAt: null, stage: null,
        };
        const shown = explainMatch(players, [...played, live], 1, drawn.teamA, drawn.teamB, 3);
        // Either the four are the fewest, or the card names who is waiting.
        // What it may never do is claim the superlative without the fact.
        const words = leastPlayedWords(shown);
        if (words.includes("had played the fewest games")) {
          expect(shown.fewestPlayed, `${as}A/${bs}B game ${n}`).toBe(true);
          expect(shown.waiting, `${as}A/${bs}B game ${n}`).toEqual([]);
        }
        played.push({ ...live, status: "played", scoreA: 2, scoreB: 0, completedAt: 0 });
      }
    }
  }, 30_000);

  it("says who was passed over rather than claiming these four played fewest", () => {
    // The cap held somebody back, so "they had played the fewest games" is
    // not true of this four and the sentence does not say it.
    const held = reasonOf({
      mixing: {
        kind: "pure",
        aPlayers: ["Benson", "Timi", "Ade", "Sam"].map((name) => ({ name, bGames: 1 })),
        heldBack: [{ name: "Ese" }],
      },
    });
    expect(leastPlayedWords(held)).toBe(
      "Benson, Timi, Ade and Sam are on. Ese had played fewer, but putting them on would"
      + " have cost an A a second game with the B's, so they wait a round.",
    );
    expect(leastPlayedWords(held)).not.toContain("had played the fewest games");
  });

  it("names the other reason a four is passed over, when the four leaves nothing dealable", () => {
    // The cost has two terms. Usually the fairer four charges an A a second
    // game with the B's, now or later, and the sentence says so. Sometimes
    // it prices higher only because the seats it leaves cannot be dealt out
    // into whole lawful games, and somebody would finish short. Naming the
    // third law there tells a player the wrong rule. Reached on the walk-in
    // and leaver sweep, 47 draws of about five hundred held-back ones.
    const held = reasonOf({
      mixing: {
        kind: "pure",
        aPlayers: ["Benson", "Timi", "Ade", "Sam"].map((name) => ({ name, bGames: 1 })),
        heldBack: [{ name: "Ese" }],
        heldBackBy: "unfinished",
      },
    });
    expect(leastPlayedWords(held)).toBe(
      "Benson, Timi, Ade and Sam are on. Ese had played fewer, but putting them on would"
      + " have left somebody short of their games, so they wait a round.",
    );
    expect(leastPlayedWords(held)).not.toContain("second game with the B's");
  });

  it("the two lists on the screen name the same four in the same order", () => {
    // Frame 11's first card reads `leastPlayed` and its fourth reads the
    // A's off the mixing note. Both are on one screen, so a four listed
    // "A3, A4, A5 and A6" up top and "A3, A6, A4 and A5" underneath reads
    // as arbitrary. The picker built its list from the lineup until
    // 2026-09-11; it is the queue's order now, which is what the first
    // card uses.
    const shown = frameElevenAt(roster(6, 2), 4, (r) => r.mixing.aPlayers.length >= 3);
    expect(shown).not.toBeNull();
    const upTop = shown!.leastPlayed.map((p) => p.name)
      .filter((n) => shown!.mixing.aPlayers.some((a) => a.name === n));
    expect(shown!.mixing.aPlayers.map((a) => a.name)).toEqual(upTop);
  });

  it("a stepped-past row cannot make the two cards disagree", () => {
    // Eight A's and four B's at three each, with slot two stepped past
    // (frame 12b). Frame 11 draws the first card and the fourth on one
    // screen, and until 2026-09-11 they were counted off two different
    // logs: the fourth off the card's, where a held row is already played,
    // and the first off the raw list, where it counts for nothing. From
    // slot six on the first card claimed "had played the fewest games"
    // about a four the raw counts did not put lowest, and the same four
    // came out "A3, A4, A1 and A2" up top and "A1, A2, A3 and A4"
    // underneath. Both now read the log the card drew from, so the check
    // below is the printed count against the card's own.
    const players = roster(8, 4);
    const rows = cardWithSkips(players, 3, [2]);
    expect(rows.length).toBe(9);
    for (const { reason, counts } of rows) {
      // The numbers the first card's sentence is printed from ARE the
      // card's numbers. Everything else on the screen follows from this:
      // "had played the fewest games" is said about a four the card put
      // lowest, and "X had played fewer" about somebody the card puts
      // lower, rather than about somebody the raw list does.
      expect(reason.leastPlayed.map((p) => [p.name, p.matchesPlayed]))
        .toEqual(reason.leastPlayed.map((p) => [p.name, counts.get(p.playerId)]));
      // And one four is listed one way. The fourth card's A's are in queue
      // order, the first card's in played order, and on one log those are
      // the same order.
      const upTop = reason.leastPlayed.map((p) => p.name)
        .filter((n) => reason.mixing.aPlayers.some((a) => a.name === n));
      expect(reason.mixing.aPlayers.map((a) => a.name)).toEqual(upTop);
    }
  });

  it("holds with two rows stepped past, on the roster that printed the wrong held-back name", () => {
    // Six A's and six B's at four each with slots two and three stepped
    // past. Slot nine was the draw that read "had played fewer" over a
    // name the printed counts did not put lower: heldBack came off the
    // replay, which counts a held row as played, and the counts beside it
    // did not. One log, one answer.
    const players = roster(6, 6);
    const rows = cardWithSkips(players, 4, [2, 3]);
    expect(rows.length).toBe(12);
    for (const { reason, counts } of rows) {
      expect(reason.leastPlayed.map((p) => p.matchesPlayed))
        .toEqual(reason.leastPlayed.map((p) => counts.get(p.playerId)));
      const most = Math.max(...reason.leastPlayed.map((p) => p.matchesPlayed));
      // Whoever the cap held back had played fewer than the four it held
      // them back from, by the counts the same screen shows.
      for (const held of reason.mixing.heldBack) {
        const id = players.find((p) => p.name === held.name)!.id;
        expect(counts.get(id)!).toBeLessThan(most);
      }
    }
  });

  it("reaches the screen: a real held-back draw read back through explainMatch", () => {
    // Six A's and six B's at four each. The third game is the first the cap
    // reorders: two B's on no games at all wait a round, because dealing
    // them would have cost an A a second game with the B's. Frame 11 opens
    // on the match ON COURT, so this is the path that used to print "had
    // played the fewest games" over a four that had not.
    const shown = frameElevenAt(roster(6, 6), 4, (r) => r.mixing.heldBack.length > 0);
    expect(shown).not.toBeNull();
    expect(shown!.mixing.heldBack.map((h) => h.name)).toEqual(["B5", "B6"]);
    const words = leastPlayedWords(shown!);
    expect(words).not.toContain("had played the fewest games");
    expect(words).toContain("B5 and B6 had played fewer");
    expect(words).toContain("so they wait a round");
  });

  it("claims nothing for a four it cannot match to a draw", () => {
    // A hand-arranged four, or a card played out of order, is not a draw
    // this engine made. explainMatch falls back to what the log supports
    // and the frame prints its ordinary sentence.
    const players = roster(6, 6);
    const shown = explainMatch(players, [], 1, ["a1", "b1"], ["a2", "b2"], 4);
    expect(shown.mixing.heldBack).toEqual([]);
    // With no target at all the replay is never attempted, which is what
    // keeps nextMatch from drawing every row of the card twice.
    expect(explainMatch(players, [], 1, ["a1", "b1"], ["a2", "b2"]).mixing.heldBack).toEqual([]);
  });
});

describe("the fourth card, one game with the B's", () => {
  it("is absent when there is no A in the match", () => {
    expect(mixingWords({ kind: "noAs", aPlayers: [], heldBack: [] })).toBeNull();
  });

  it("states the allowance for a match with no B, and names who has not spent it", () => {
    // "pure" knows the four holds no B, and now knows each A's count. It
    // does NOT say the missing game is coming: six A's and six B's at four
    // each have room for two mixed games, so two A's never meet the B's.
    const words = mixingWords({
      kind: "pure",
      aPlayers: [
        { name: "Benson", bGames: 1 }, { name: "Timi", bGames: 1 },
        { name: "Ade", bGames: 0 }, { name: "Sam", bGames: 0 },
      ],
      heldBack: [],
    });
    expect(words).toBe(
      "Benson, Timi, Ade and Sam are in a match with no B in it. One game with the B's a"
      + " night is the whole allowance, and Ade and Sam have not had theirs.",
    );
    expect(words).not.toContain("still to come");
  });

  it("says the game is behind them only when it is behind all four", () => {
    expect(mixingWords({
      kind: "pure",
      aPlayers: ["Benson", "Timi", "Ade", "Sam"].map((name) => ({ name, bGames: 1 })),
      heldBack: [],
    })).toBe(
      "Benson, Timi, Ade and Sam have had their game with the B's already. One game a night"
      + " is the whole allowance, so this one is among the A's.",
    );
    expect(mixingWords({
      kind: "pure", aPlayers: [{ name: "Benson", bGames: 2 }], heldBack: [],
    })).toBe(
      "Benson has had their game with the B's already. One game a night is the whole"
      + " allowance, so this one is among the A's.",
    );
  });

  it("names the one game when these A's are having it", () => {
    expect(mixingWords({
      kind: "firstBGame",
      aPlayers: [{ name: "Benson", bGames: 0 }, { name: "Timi", bGames: 0 }],
      heldBack: [],
    })).toBe("Benson and Timi are having their one game with the B's.");
    expect(mixingWords({
      kind: "firstBGame", aPlayers: [{ name: "Benson", bGames: 0 }], heldBack: [],
    })).toBe("Benson is having their one game with the B's.");
  });

  it("counts the repeat rather than calling every repeat a second", () => {
    expect(mixingWords({
      kind: "secondBGame",
      aPlayers: [{ name: "Benson", bGames: 0 }, { name: "Timi", bGames: 1 }],
      heldBack: [],
    })).toBe(
      "Benson and Timi are in with the B's. Timi meets them for the second time."
      + " One game with the B's a night is the allowance, and this four is past it.",
    );
    // A third, which the old wording called a second.
    expect(mixingWords({
      kind: "secondBGame",
      aPlayers: [{ name: "Benson", bGames: 0 }, { name: "Timi", bGames: 2 }],
      heldBack: [],
    })).toContain("Timi meets them for the third time.");
    // Two charged A's on the same count, and on different ones.
    expect(mixingWords({
      kind: "secondBGame",
      aPlayers: [{ name: "Benson", bGames: 1 }, { name: "Timi", bGames: 1 }],
      heldBack: [],
    })).toContain("Benson and Timi meet them for the second time.");
    expect(mixingWords({
      kind: "secondBGame",
      aPlayers: [{ name: "Benson", bGames: 1 }, { name: "Timi", bGames: 2 }],
      heldBack: [],
    })).toContain("Benson meets them for the second time, Timi for the third.");
  });

  it("speaks of one A in the singular, and claims no spreading on a lone-A court", () => {
    const words = mixingWords({
      kind: "secondBGame", aPlayers: [{ name: "Benson", bGames: 1 }], heldBack: [],
    });
    expect(words).toBe(
      "Benson is in with the B's. Benson meets them for the second time. One game with the"
      + " B's a night is the allowance, and this four is past it.",
    );
    expect(words).not.toContain("are in with");
    expect(words).not.toContain("one of them");
    expect(words).not.toContain("spread rather than stacked");
  });

  it("reads a real draw: the first four out on an A and B court are having their game", () => {
    const players = roster(4, 4);
    const first = nextMatch(players, [], 1, 4)!;
    expect(first.reason.mixing.kind).toBe("firstBGame");
    expect(mixingWords(first.reason.mixing)).toContain("having their one game with the B's");
  });

  it("reads a real draw: one A on a court of B's meets them a third time, and is told so", () => {
    // One A and three B's at four each. The A has nobody to hand the seats
    // to, so every game is theirs and the card counts them up.
    const third = frameElevenAt(roster(1, 3), 4, (r) =>
      r.mixing.aPlayers.some((a) => a.bGames === 2));
    expect(third).not.toBeNull();
    expect(mixingWords(third!.mixing)).toBe(
      "A1 is in with the B's. A1 meets them for the third time. One game with the B's a"
      + " night is the allowance, and this four is past it.",
    );
  });
});

describe("the card after a row is skipped", () => {
  /**
   * The card, walked the way useSession projectCard walks one: a row already
   * on court or stepped past goes into the running log AS PLAYED before the
   * next row is drawn, because the card is a picture of a night in which
   * every row gets played. Each slot hands back the picker's own note and
   * the note frame 11 shows over the same four once it is on court.
   */
  const cardWithASkippedRow = (players: Player[], target: number, slots: number) => {
    const matches: Match[] = [];
    const row = (n: number, four: { teamA: readonly [string, string]; teamB: readonly [string, string] },
      status: Match["status"]): Match => ({
      id: `m${n}`, courtNumber: 1, matchIndex: n,
      teamA: [...four.teamA] as [string, string], teamB: [...four.teamB] as [string, string],
      scoreA: status === "played" ? 2 : null, scoreB: status === "played" ? 0 : null,
      status, startedAt: 0, completedAt: status === "played" ? 0 : null, stage: null,
    });
    const seeded = () => matches.map((m) => ({ ...m, status: "played" as const }));

    // Frame 12b: the operator steps past the first row. It keeps its slot and
    // the four keep the game they owe, so the card draws around it.
    const first = nextMatch(players, [], 1, target)!;
    matches.push(row(1, first, "skipped"));

    const walked: { picker: MatchReason["mixing"]; frame: MatchReason["mixing"] }[] = [];
    for (let n = 2; n <= slots; n += 1) {
      const drawn = nextMatch(players, seeded(), 1, target);
      if (!drawn) break;
      const live = row(n, drawn, "onCourt");
      walked.push({
        picker: drawn.reason.mixing,
        frame: explainMatch(players, [...matches, live], 1, drawn.teamA, drawn.teamB, target).mixing,
      });
      matches.push(row(n, drawn, "played"));
    }
    return walked;
  };

  it("counts the skipped row's game with the B's, the way the picker already did", () => {
    // Eight A's and four B's at three each, with the first row stepped past.
    // That row is A1 and A2's one game with the B's: the picker has spent
    // their allowance and will never deal them another mixed game. Until
    // 2026-09-11 frame 11 read the night's raw list, where a skipped row
    // counts for nothing, and printed "A1 and A2 have not had theirs" over
    // the pure four in slot six. The card was promising a game the night
    // could not keep, which is the one thing the frame exists to avoid.
    const walked = cardWithASkippedRow(roster(8, 4), 3, 9);
    expect(walked.length).toBeGreaterThan(5);
    for (const { picker, frame } of walked) {
      expect(frame.kind).toBe(picker.kind);
      expect(frame.aPlayers).toEqual(picker.aPlayers);
      expect(frame.heldBack).toEqual(picker.heldBack);
    }
  });

  it("never offers an A a game with the B's their allowance is already spent on", () => {
    const walked = cardWithASkippedRow(roster(8, 4), 3, 9);
    const pure = walked.filter((w) => w.frame.kind === "pure"
      && w.frame.aPlayers.some((a) => a.name === "A1"));
    expect(pure.length).toBeGreaterThan(0);
    for (const { frame } of pure) {
      expect(frame.aPlayers.find((a) => a.name === "A1")!.bGames).toBe(1);
      expect(mixingWords(frame)).toContain("have had their game with the B's already");
      expect(mixingWords(frame)).not.toContain("have not had theirs");
    }
  });
});

describe("the roster footer reads the court", () => {
  it("keeps the old promise while the counts keep it", () => {
    expect(roundRobinCounts(0)).toBe("Counts never drift more than one game apart.");
    expect(roundRobinCounts(1)).toBe("Counts never drift more than one game apart.");
  });

  it("says the gap and names no cause for it", () => {
    // The cap can cost exactly one game, so a court three apart is a walk-in
    // or a leaver rather than the rule, and a court two apart can simply be
    // three games into a fresh deal. One number cannot tell them apart, so
    // the sentence stops at the number.
    expect(roundRobinCounts(2)).toBe("Counts are two games apart right now.");
    expect(roundRobinCounts(3)).toBe("Counts are three games apart right now.");
    expect(roundRobinCounts(4)).not.toContain("one game with the B's");
    expect(roundRobinCounts(4)).not.toContain("hold a player back");
  });

  it("spells the gap rather than printing a figure", () => {
    // The list these words come from stopped at twelve until 2026-09-11, on
    // the grounds that a court does not hold more. It does: twenty on one
    // court is the Wednesday roster, and the same list counts the room on
    // the leaves-early screen.
    expect(roundRobinCounts(13)).toBe("Counts are thirteen games apart right now.");
    expect(countWord(20)).toBe("twenty");
    expect(countWord(21)).toBe("twenty-one");
  });

  it("takes its number from the same place frame 11 takes its promise", () => {
    // One game played by four of the eight, so the court sits a game apart
    // and the promise still holds.
    const players: Player[] = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => ({
      id, name: id.toUpperCase(), walkIn: false, courtNumber: 1, away: false,
      joinedAtMatchIndex: null,
    }));
    const one: Match[] = [{
      id: "m1", courtNumber: 1, matchIndex: 1, teamA: ["a", "b"], teamB: ["c", "d"],
      scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
    }];
    expect(courtSpread(players, one, 1)).toBe(1);
    expect(roundRobinCounts(courtSpread(players, one, 1)))
      .toBe("Counts never drift more than one game apart.");
    expect(courtSpread(players, [], 1)).toBe(0);
  });
});
