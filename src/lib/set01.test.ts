import { describe, it, expect } from "vitest";
import {
  matchWinner,
  pointDiff,
  applySwaps,
  getKnockoutSeeds,
  buildMatchMap,
  calculateWomensStandings,
  womensSFWinnerLabel,
} from "./set01";
import {
  defaultSet01State,
  Stage1Match,
  WomensGroupMatch,
  WomensTeamSlot,
  KnockoutMatch,
} from "@/types/set01";

// ============================================================
// matchWinner / pointDiff
// ============================================================

describe("matchWinner", () => {
  it("returns null when scores incomplete", () => {
    expect(matchWinner({ scoreA: null, scoreB: null })).toBeNull();
    expect(matchWinner({ scoreA: 2, scoreB: null })).toBeNull();
    expect(matchWinner({ scoreA: null, scoreB: 1 })).toBeNull();
  });
  it("returns A when scoreA > scoreB", () => {
    expect(matchWinner({ scoreA: 2, scoreB: 0 })).toBe("A");
    expect(matchWinner({ scoreA: 2, scoreB: 1 })).toBe("A");
  });
  it("returns B when scoreB > scoreA", () => {
    expect(matchWinner({ scoreA: 0, scoreB: 2 })).toBe("B");
    expect(matchWinner({ scoreA: 1, scoreB: 2 })).toBe("B");
  });
  it("returns null when scores are tied (no draws in best-of-3)", () => {
    expect(matchWinner({ scoreA: 1, scoreB: 1 })).toBeNull();
  });
});

describe("pointDiff", () => {
  it("returns absolute difference", () => {
    expect(pointDiff({ scoreA: 2, scoreB: 0 })).toBe(2);
    expect(pointDiff({ scoreA: 0, scoreB: 2 })).toBe(2);
    expect(pointDiff({ scoreA: 2, scoreB: 1 })).toBe(1);
  });
  it("returns null when scores incomplete", () => {
    expect(pointDiff({ scoreA: null, scoreB: 1 })).toBeNull();
  });
});

// ============================================================
// Stage 1 swap rule
// ============================================================

const noScores: Stage1Match[] = [
  { match: 1, seedA: 1, seedB: 12, scoreA: null, scoreB: null },
  { match: 2, seedA: 2, seedB: 11, scoreA: null, scoreB: null },
  { match: 3, seedA: 3, seedB: 10, scoreA: null, scoreB: null },
  { match: 4, seedA: 4, seedB: 9, scoreA: null, scoreB: null },
  { match: 5, seedA: 5, seedB: 16, scoreA: null, scoreB: null },
  { match: 6, seedA: 6, seedB: 15, scoreA: null, scoreB: null },
  { match: 7, seedA: 7, seedB: 14, scoreA: null, scoreB: null },
  { match: 8, seedA: 8, seedB: 13, scoreA: null, scoreB: null },
];

// helper to set scores on a match
const score = (s: Stage1Match[], idx: number, a: number, b: number): Stage1Match[] =>
  s.map((m, i) => (i === idx ? { ...m, scoreA: a, scoreB: b } : m));

describe("applySwaps — no upsets", () => {
  it("identity mapping when no scores entered", () => {
    const fs = applySwaps(noScores);
    expect(fs).toHaveLength(16);
    for (let i = 0; i < 16; i++) {
      expect(fs[i].seed).toBe(i + 1);
      expect(fs[i].originalSeed).toBe(i + 1);
    }
  });

  it("identity mapping when all favourites win", () => {
    let s = noScores;
    // 1-4 all win their band A matches
    s = score(s, 0, 2, 0);
    s = score(s, 1, 2, 0);
    s = score(s, 2, 2, 0);
    s = score(s, 3, 2, 0);
    // 5-8 all win their band B matches
    s = score(s, 4, 2, 0);
    s = score(s, 5, 2, 0);
    s = score(s, 6, 2, 0);
    s = score(s, 7, 2, 0);
    const fs = applySwaps(s);
    for (let i = 0; i < 16; i++) {
      expect(fs[i].originalSeed).toBe(i + 1);
    }
  });
});

describe("applySwaps — top 4 always locked", () => {
  it("seeds 1-4 never change even if they lose Stage 1", () => {
    let s = noScores;
    // All 4 anchor seeds lose
    s = score(s, 0, 0, 2); // seed 1 loses to seed 12
    s = score(s, 1, 0, 2); // seed 2 loses to seed 11
    s = score(s, 2, 0, 2); // seed 3 loses to seed 10
    s = score(s, 3, 0, 2); // seed 4 loses to seed 9
    // No band B losses (5-8 all win), so no open spots in 5-8 band
    s = score(s, 4, 2, 0);
    s = score(s, 5, 2, 0);
    s = score(s, 6, 2, 0);
    s = score(s, 7, 2, 0);
    const fs = applySwaps(s);
    // Top 4 seeds still hold positions 1-4
    expect(fs[0].originalSeed).toBe(1);
    expect(fs[1].originalSeed).toBe(2);
    expect(fs[2].originalSeed).toBe(3);
    expect(fs[3].originalSeed).toBe(4);
    // 5-8 also unchanged because no swap eligible
    expect(fs[4].originalSeed).toBe(5);
    expect(fs[5].originalSeed).toBe(6);
    expect(fs[6].originalSeed).toBe(7);
    expect(fs[7].originalSeed).toBe(8);
  });
});

describe("applySwaps — Band A swap (single)", () => {
  it("promotes a 9-12 winner when there's exactly one 5-8 loss", () => {
    let s = noScores;
    s = score(s, 0, 0, 2); // seed 12 beats seed 1 (Band A upset)
    s = score(s, 1, 2, 0);
    s = score(s, 2, 2, 0);
    s = score(s, 3, 2, 0);
    s = score(s, 4, 0, 2); // seed 16 beats seed 5 (5-8 loss)
    s = score(s, 5, 2, 0);
    s = score(s, 6, 2, 0);
    s = score(s, 7, 2, 0);
    const fs = applySwaps(s);
    // Top 4 still locked
    expect(fs[0].originalSeed).toBe(1);
    // Seed 12 (upsetter) now holds slot 5
    expect(fs[4].originalSeed).toBe(12);
    // Seed 5 (loser) now holds slot 12
    expect(fs[11].originalSeed).toBe(5);
    // Seed 16 promotes to slot 12 -> wait, they got pushed by band B logic
    // Actually let's verify Band B: seed 16 beat seed 5. Seed 16 should now
    // promote into 9-12 (replacing weakest 9-12 = seed 12, but seed 12 already
    // moved out via Band A). So seed 16 goes into the slot vacated by seed 12.
    // After Band A: slot 5 = 12, slot 12 = 5. Slots 9,10,11 still have 9,10,11.
    // Slot 12 currently has 5 (not original 9-12). So band B can't promote into
    // slot 12. It looks for a slot still holding original 9-12.
    // Candidates for band B: slots holding originalSeed in [9,11]. Weakest = slot 11 (seed 11).
    // So seed 16 swaps with seed 11.
    expect(fs[10].originalSeed).toBe(16); // slot 11 now holds seed 16
    // Original seed 11 is bumped to where seed 16 came from = position 16
    // Wait the swap function: swaps originalSeed values between the two slots
    // currently holding them. So slot 16 (which had originalSeed 16) swaps with
    // the slot holding originalSeed 11.
    expect(fs[15].originalSeed).toBe(11); // slot 16 now holds seed 11
  });
});

describe("applySwaps — multiple Band A upsets, point-diff tiebreak", () => {
  it("highest point differential among upsetters gets the single open spot", () => {
    let s = noScores;
    // Two band A upsets — seeds 12 (PD=2) and 11 (PD=1) both win
    s = score(s, 0, 0, 2); // seed 12 beats seed 1, PD=2
    s = score(s, 1, 1, 2); // seed 11 beats seed 2, PD=1
    s = score(s, 2, 2, 0);
    s = score(s, 3, 2, 0);
    // Only ONE band B loss (one open spot in 5-8)
    s = score(s, 4, 0, 2); // seed 16 beats seed 5 (band B upset, also opens 5-8)
    s = score(s, 5, 2, 0);
    s = score(s, 6, 2, 0);
    s = score(s, 7, 2, 0);
    const fs = applySwaps(s);
    // Band A: Seed 12 (higher PD) promoted into slot 5; seed 5 drops to slot 12
    expect(fs[4].originalSeed).toBe(12);
    expect(fs[11].originalSeed).toBe(5);
    // Band B: seed 16 promotes into 9-12 — replaces weakest remaining (slot 11 = seed 11)
    // because slot 12 now holds seed 5 (not a 9-12 original).
    expect(fs[10].originalSeed).toBe(16);
    expect(fs[15].originalSeed).toBe(11);
  });
});

describe("applySwaps — Band B swap", () => {
  it("13-16 winner promotes to 9-12 even if no band A upsets", () => {
    let s = noScores;
    // No band A upsets — all 1-4 win
    s = score(s, 0, 2, 0);
    s = score(s, 1, 2, 0);
    s = score(s, 2, 2, 0);
    s = score(s, 3, 2, 0);
    // One band B upset: seed 13 beats seed 8
    s = score(s, 4, 2, 0);
    s = score(s, 5, 2, 0);
    s = score(s, 6, 2, 0);
    s = score(s, 7, 0, 2); // seed 13 beats seed 8
    const fs = applySwaps(s);
    // Top 4 unchanged
    expect(fs[0].originalSeed).toBe(1);
    // Seed 13 promotes to 9-12 band — replaces weakest remaining 9-12 (seed 12 in slot 12)
    // The swap exchanges originalSeed values between the two slots holding them.
    expect(fs[11].originalSeed).toBe(13); // slot 12 now holds seed 13
    expect(fs[12].originalSeed).toBe(12); // slot 13 now holds seed 12
    // Seed 8 unchanged — band B winners promote to 9-12, NOT to 5-8
    expect(fs[7].originalSeed).toBe(8);
    // Slot 16 still holds seed 16
    expect(fs[15].originalSeed).toBe(16);
  });
});

// ============================================================
// Knockout bracket walking
// ============================================================

describe("getKnockoutSeeds + buildMatchMap", () => {
  it("R16 returns explicit seeds", () => {
    const state = defaultSet01State();
    const map = buildMatchMap(state);
    const r16_1 = state.r16[0];
    const seeds = getKnockoutSeeds(r16_1, map);
    expect(seeds.a).toBe(1);
    expect(seeds.b).toBe(16);
  });

  it("QF returns null seeds before R16 is played", () => {
    const state = defaultSet01State();
    const map = buildMatchMap(state);
    const qf1 = state.qf[0];
    const seeds = getKnockoutSeeds(qf1, map);
    expect(seeds.a).toBeNull();
    expect(seeds.b).toBeNull();
  });

  it("QF resolves to R16 winners' seeds when R16 is complete", () => {
    const state = defaultSet01State();
    state.r16[0] = { ...state.r16[0], scoreA: 2, scoreB: 0 }; // seed 1 wins
    state.r16[1] = { ...state.r16[1], scoreA: 0, scoreB: 2 }; // seed 9 wins (was seedB)
    const map = buildMatchMap(state);
    const seeds = getKnockoutSeeds(state.qf[0], map);
    expect(seeds.a).toBe(1);
    expect(seeds.b).toBe(9);
  });

  it("Final cascades through all rounds", () => {
    const state = defaultSet01State();
    // All R16 seedA wins (top half = seeds 1, 8, 4, 5; bottom = 2, 7, 3, 6)
    state.r16 = state.r16.map((m) => ({ ...m, scoreA: 2, scoreB: 0 }));
    // All QF seedA wins → SF1 = 1 vs 4, SF2 = 2 vs 3
    state.qf = state.qf.map((m) => ({ ...m, scoreA: 2, scoreB: 0 }));
    // All SF seedA wins → Final = 1 vs 2
    state.sf = state.sf.map((m) => ({ ...m, scoreA: 2, scoreB: 0 }));
    const map = buildMatchMap(state);
    const seeds = getKnockoutSeeds(state.f, map);
    expect(seeds.a).toBe(1);
    expect(seeds.b).toBe(2);
  });
});

// ============================================================
// Women's standings
// ============================================================

const teams: WomensTeamSlot[] = ["A", "B", "C", "D", "E"].map((label) => ({
  id: `women-${label}`,
  label,
  player1: { id: `${label}-1`, display: `${label}1` },
  player2: { id: `${label}-2`, display: `${label}2` },
}));

const blankGroup: WomensGroupMatch[] = [
  { id: "G1", teamA: "A", teamB: "B", scoreA: null, scoreB: null },
  { id: "G2", teamA: "B", teamB: "C", scoreA: null, scoreB: null },
  { id: "G3", teamA: "C", teamB: "D", scoreA: null, scoreB: null },
  { id: "G4", teamA: "D", teamB: "E", scoreA: null, scoreB: null },
  { id: "G5", teamA: "A", teamB: "E", scoreA: null, scoreB: null },
];

describe("calculateWomensStandings", () => {
  it("returns 5 teams with zero stats when no matches played", () => {
    const standings = calculateWomensStandings(teams, blankGroup);
    expect(standings).toHaveLength(5);
    standings.forEach((s) => {
      expect(s.w).toBe(0);
      expect(s.l).toBe(0);
      expect(s.diff).toBe(0);
    });
  });

  it("sorts by wins primarily", () => {
    const group: WomensGroupMatch[] = [
      { id: "G1", teamA: "A", teamB: "B", scoreA: 2, scoreB: 0 }, // A wins
      { id: "G2", teamA: "B", teamB: "C", scoreA: 0, scoreB: 2 }, // C wins
      { id: "G3", teamA: "C", teamB: "D", scoreA: 2, scoreB: 1 }, // C wins
      { id: "G4", teamA: "D", teamB: "E", scoreA: 0, scoreB: 2 }, // E wins
      { id: "G5", teamA: "A", teamB: "E", scoreA: 2, scoreB: 1 }, // A wins
    ];
    const standings = calculateWomensStandings(teams, group);
    // C: 2W (most)
    // A: 2W also — tiebreak by diff
    // E: 1W
    // D, B: 0W
    expect(standings[0].w).toBe(2);
    expect(standings[1].w).toBe(2);
    expect(standings[2].label).toBe("E");
    expect(standings[2].w).toBe(1);
  });

  it("breaks ties by point differential", () => {
    const group: WomensGroupMatch[] = [
      { id: "G1", teamA: "A", teamB: "B", scoreA: 2, scoreB: 0 }, // A +2
      { id: "G2", teamA: "B", teamB: "C", scoreA: 0, scoreB: 2 }, // C +2
      { id: "G3", teamA: "C", teamB: "D", scoreA: 2, scoreB: 0 }, // C +2 (was 2-1)
      { id: "G4", teamA: "D", teamB: "E", scoreA: 0, scoreB: 2 }, // E +2
      { id: "G5", teamA: "A", teamB: "E", scoreA: 2, scoreB: 1 }, // A +1
    ];
    const standings = calculateWomensStandings(teams, group);
    // A: 2W, PF=4, PA=1, Diff=+3
    // C: 2W, PF=4, PA=0, Diff=+4
    // Tied on wins. C has higher Diff so ranks first.
    expect(standings[0].label).toBe("C");
    expect(standings[0].diff).toBe(4);
    expect(standings[1].label).toBe("A");
    expect(standings[1].diff).toBe(3);
  });

  it("ignores incomplete matches", () => {
    const group: WomensGroupMatch[] = [
      { id: "G1", teamA: "A", teamB: "B", scoreA: 2, scoreB: 0 },
      { id: "G2", teamA: "B", teamB: "C", scoreA: null, scoreB: null }, // incomplete
      { id: "G3", teamA: "C", teamB: "D", scoreA: null, scoreB: null },
      { id: "G4", teamA: "D", teamB: "E", scoreA: null, scoreB: null },
      { id: "G5", teamA: "A", teamB: "E", scoreA: null, scoreB: null },
    ];
    const standings = calculateWomensStandings(teams, group);
    expect(standings[0].label).toBe("A");
    expect(standings[0].w).toBe(1);
    expect(standings[0].diff).toBe(2);
    // Others all 0
    expect(standings.slice(1).every((s) => s.w === 0)).toBe(true);
  });

  it("uses player names when filled, otherwise team label", () => {
    const standings = calculateWomensStandings(teams, blankGroup);
    expect(standings[0].name).toMatch(/&/);
  });
});

// ============================================================
// womensSFWinnerLabel
// ============================================================

describe("womensSFWinnerLabel", () => {
  it("returns null when SF incomplete", () => {
    const sf = { id: "WSF1", teamA: "A", teamB: "D", scoreA: null, scoreB: null, pointsAwarded: false };
    expect(womensSFWinnerLabel(sf)).toBeNull();
  });
  it("returns teamA label when A wins", () => {
    const sf = { id: "WSF1", teamA: "A", teamB: "D", scoreA: 2, scoreB: 0, pointsAwarded: false };
    expect(womensSFWinnerLabel(sf)).toBe("A");
  });
  it("returns teamB label when B wins", () => {
    const sf = { id: "WSF1", teamA: "A", teamB: "D", scoreA: 0, scoreB: 2, pointsAwarded: false };
    expect(womensSFWinnerLabel(sf)).toBe("D");
  });
});

// ============================================================
// End-to-end bracket smoke test
// ============================================================

describe("end-to-end bracket walk", () => {
  it("plays out full tournament with all higher seeds winning, identifies seed 1 as champion", () => {
    const state = defaultSet01State();

    // R16: every seedA (lower number = higher seed) wins
    state.r16 = state.r16.map((m) => ({ ...m, scoreA: 2, scoreB: 0 }));

    // QF/SF/F: same — top seed always wins
    state.qf = state.qf.map((m) => ({ ...m, scoreA: 2, scoreB: 0 }));
    state.sf = state.sf.map((m) => ({ ...m, scoreA: 2, scoreB: 0 }));
    state.f = { ...state.f, scoreA: 2, scoreB: 0 };

    const map = buildMatchMap(state);
    const finalSeeds = getKnockoutSeeds(state.f, map);
    expect(finalSeeds.a).toBe(1);
    expect(finalSeeds.b).toBe(2);
    expect(matchWinner(state.f)).toBe("A"); // seed 1 wins

    // Top 4 only meet in SF or F
    // SF1 source teams should be from seeds in {1, 8, 4, 5}, SF2 from {2, 7, 3, 6}
    const sf1Seeds = getKnockoutSeeds(state.sf[0], map);
    expect(sf1Seeds.a).toBe(1);
    expect(sf1Seeds.b).toBe(4);
  });
});
