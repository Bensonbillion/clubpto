// Court Manager v3 — playoff selection, seeding, and brackets (§11).
//
// Seeding chain everywhere: Win% → head-to-head → strength of schedule
// (combined Win% of opponents faced) → coin flip (visible, deterministic per
// matchup so re-renders never re-flip). The applied tiebreaker is recorded for
// display. NEVER raw win totals (historical bug: 7W-13L once seeded above
// 4W-0L). Eligibility floor: ≥2 games played to qualify (admin-overridable).

import type { Pair, Player, PlayoffMatch, StandingRow, Tier } from "./types";

export interface CompletedRRGame {
  pairIds: [string, string];
  winnerPairId: string;
}

function h2hKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** wins of `a` over `b` minus wins of `b` over `a`, at pair level. */
function buildPairH2h(games: CompletedRRGame[]): (a: string, b: string) => number {
  const wins = new Map<string, number>(); // key → net wins for the lexicographically smaller id
  for (const g of games) {
    const [p, q] = g.pairIds;
    const key = h2hKey(p, q);
    const small = p < q ? p : q;
    const delta = g.winnerPairId === small ? 1 : -1;
    wins.set(key, (wins.get(key) ?? 0) + delta);
  }
  return (a, b) => {
    if (a === b) return 0;
    const net = wins.get(h2hKey(a, b)) ?? 0;
    return a < b ? net : -net;
  };
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export function pairStandings(pairs: Pair[], games: CompletedRRGame[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    pairs.map((p) => [
      p.id,
      { id: p.id, name: p.id, tier: p.tier, wins: 0, losses: 0, winPct: 0, sos: 0, gamesPlayed: 0 },
    ]),
  );
  const opponents = new Map<string, string[]>(pairs.map((p) => [p.id, []]));
  for (const g of games) {
    for (const pid of g.pairIds) {
      const row = rows.get(pid);
      if (!row) continue;
      row.gamesPlayed += 1;
      if (g.winnerPairId === pid) row.wins += 1;
      else row.losses += 1;
      opponents.get(pid)?.push(g.pairIds[0] === pid ? g.pairIds[1] : g.pairIds[0]);
    }
  }
  for (const row of rows.values()) {
    row.winPct = row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0;
  }
  // Strength of schedule: mean Win% of opponents faced ("who had the harder road").
  for (const row of rows.values()) {
    const opps = opponents.get(row.id) ?? [];
    row.sos =
      opps.length > 0
        ? opps.reduce((sum, id) => sum + (rows.get(id)?.winPct ?? 0), 0) / opps.length
        : 0;
  }
  return [...rows.values()];
}

/** Fixed pairs: each player inherits their pair's record (Wednesday bracket is per PLAYER). */
export function playerStandings(players: Player[], pairs: Pair[], games: CompletedRRGame[]): StandingRow[] {
  const pairRows = new Map(pairStandings(pairs, games).map((r) => [r.id, r]));
  const pairOf = new Map<string, Pair>();
  for (const pair of pairs) for (const pid of pair.playerIds) pairOf.set(pid, pair);
  const rows: StandingRow[] = [];
  for (const player of players) {
    const pair = pairOf.get(player.id);
    const base = pair ? pairRows.get(pair.id) : undefined;
    rows.push({
      id: player.id,
      name: player.name,
      tier: player.tier,
      wins: base?.wins ?? 0,
      losses: base?.losses ?? 0,
      winPct: base?.winPct ?? 0,
      sos: base?.sos ?? 0,
      gamesPlayed: base?.gamesPlayed ?? 0,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The seeding chain
// ---------------------------------------------------------------------------

/** Deterministic coin flip: same two ids always land the same way (§11 — visible, honest, never re-flips on re-render). */
export function coinFlipWinner(idA: string, idB: string): string {
  const [lo, hi] = idA < idB ? [idA, idB] : [idB, idA];
  let h = 0;
  const key = `${lo}|${hi}`;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return (h & 1) === 0 ? lo : hi;
}

/**
 * Sort rows by Win% → H2H → strength of schedule → coin flip, annotating each
 * row that a tiebreaker (not Win%) placed above its neighbor. `h2h(a, b)` is
 * positive when a leads the head-to-head. Never raw win totals.
 */
export function sortSeeding(rows: StandingRow[], h2h: (a: string, b: string) => number): StandingRow[] {
  const compare = (a: StandingRow, b: StandingRow): { cmp: number; reason?: string } => {
    if (b.winPct !== a.winPct) return { cmp: b.winPct - a.winPct };
    const net = h2h(a.id, b.id);
    if (net !== 0) return { cmp: -net, reason: "wins head-to-head" };
    if (b.sos !== a.sos) return { cmp: b.sos - a.sos, reason: "wins on strength of schedule" };
    return { cmp: coinFlipWinner(a.id, b.id) === a.id ? -1 : 1, reason: "wins the coin flip" };
  };

  const sorted = [...rows]
    .map((r) => ({ ...r, tiebreakApplied: undefined as string | undefined }))
    .sort((a, b) => compare(a, b).cmp);

  for (let i = 0; i < sorted.length - 1; i++) {
    const { cmp, reason } = compare(sorted[i], sorted[i + 1]);
    if (cmp < 0 && reason) sorted[i].tiebreakApplied = reason;
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Wednesday (/manage 2-court): unified top-8 PLAYER bracket
// ---------------------------------------------------------------------------

export interface WednesdaySeeding {
  seeds: StandingRow[];
  notes: string[];
}

/**
 * Eligibility floor (§11): fewer than `minGames` games played → not seeded.
 * Prevents a late pair's 1-0 (100%) from seeding #1 over a 3-1 pair.
 * Admin-overridable by passing minGames: 0.
 */
export const PLAYOFF_MIN_GAMES = 2;

function applyFloor(rows: StandingRow[], minGames: number, notes?: string[]): StandingRow[] {
  const cut = rows.filter((r) => r.gamesPlayed < minGames);
  if (notes && cut.length > 0) {
    notes.push(
      `Not eligible (fewer than ${minGames} games): ${cut.map((r) => r.name).join(", ")}. Admin can override in settings.`,
    );
  }
  return rows.filter((r) => r.gamesPlayed >= minGames);
}

/**
 * Selection: all A players first, then B by the chain. C players don't enter —
 * except the C-beat-B override: a C player whose pair beat a B player's pair in
 * round robin takes that B player's spot and seeds at their position.
 */
export function seedWednesdayTop8(
  players: Player[],
  pairs: Pair[],
  games: CompletedRRGame[],
  minGames: number = PLAYOFF_MIN_GAMES,
): WednesdaySeeding {
  const h2hPairs = buildPairH2h(games);
  const pairOf = new Map<string, string>();
  for (const pair of pairs) for (const pid of pair.playerIds) pairOf.set(pid, pair.id);
  const h2h = (a: string, b: string) => {
    const pa = pairOf.get(a);
    const pb = pairOf.get(b);
    if (!pa || !pb || pa === pb) return 0;
    return h2hPairs(pa, pb);
  };

  const notes: string[] = [];
  const rows = applyFloor(playerStandings(players, pairs, games), minGames, notes);
  const byTier = (t: Tier) => sortSeeding(rows.filter((r) => r.tier === t), h2h);

  const selection = [...byTier("A"), ...byTier("B")].slice(0, 8);

  // C-beat-B override (2-court only — structurally impossible in 3-court).
  for (const c of byTier("C")) {
    const cPair = pairOf.get(c.id);
    if (!cPair) continue;
    // Lowest-seeded B in the selection whose pair lost the head-to-head to C's pair.
    for (let i = selection.length - 1; i >= 0; i--) {
      const b = selection[i];
      if (b.tier !== "B") continue;
      const bPair = pairOf.get(b.id);
      if (!bPair || h2hPairs(cPair, bPair) <= 0) continue;
      notes.push(`${c.name} (C) beat ${b.name} (B) head-to-head — takes their playoff spot at seed ${i + 1}.`);
      selection[i] = { ...c, tiebreakApplied: "C-beat-B override" };
      break;
    }
  }

  for (const s of selection) {
    if (s.tiebreakApplied && s.tiebreakApplied !== "C-beat-B override") {
      notes.push(`Seed ${selection.indexOf(s) + 1} (${s.name}): ${s.tiebreakApplied}.`);
    }
  }
  return { seeds: selection, notes };
}

/** Seeds 1&8 vs 4&5, 2&7 vs 3&6 as doubles teams; semis simultaneous, then the final. */
export function wednesdayBracket(seeds: StandingRow[]): PlayoffMatch[] {
  if (seeds.length !== 8) {
    throw new Error(`Wednesday bracket needs exactly 8 seeded players (got ${seeds.length}).`);
  }
  const team = (i: number, j: number) => ({
    seedLabel: `${i + 1} & ${j + 1}`,
    ids: [seeds[i].id, seeds[j].id],
  });
  return [
    { id: "semi1", stage: "semi", court: 1, a: team(0, 7), b: team(3, 4) },
    { id: "semi2", stage: "semi", court: 2, a: team(1, 6), b: team(2, 5) },
  ];
}

// ---------------------------------------------------------------------------
// Sunday (/manage 3-court): per-court brackets
// ---------------------------------------------------------------------------

export interface CourtBracket {
  court: number;
  kind: "semis" | "straight_final" | "none";
  matches: PlayoffMatch[];
}

/** Top 4 pairs by the chain: #1v#4, #2v#3, then final; <4 pairs → straight final. */
export function courtBracket(
  court: number,
  pairs: Pair[],
  games: CompletedRRGame[],
  minGames: number = PLAYOFF_MIN_GAMES,
): CourtBracket {
  const h2h = buildPairH2h(games);
  const rows = sortSeeding(applyFloor(pairStandings(pairs, games), minGames), h2h);
  const pairTeam = (r: StandingRow, seed: number) => ({ seedLabel: `${seed}`, ids: [r.id] });

  if (rows.length >= 4) {
    const [s1, s2, s3, s4] = rows;
    return {
      court,
      kind: "semis",
      matches: [
        { id: `c${court}-semi1`, stage: "semi", court, a: pairTeam(s1, 1), b: pairTeam(s4, 4) },
        { id: `c${court}-semi2`, stage: "semi", court, a: pairTeam(s2, 2), b: pairTeam(s3, 3) },
      ],
    };
  }
  if (rows.length >= 2) {
    return {
      court,
      kind: "straight_final",
      matches: [
        { id: `c${court}-final`, stage: "final", court, a: pairTeam(rows[0], 1), b: pairTeam(rows[1], 2) },
      ],
    };
  }
  return { court, kind: "none", matches: [] };
}

// ---------------------------------------------------------------------------
// /manage2 (open mode): pure Win% chain, no tier priority
// ---------------------------------------------------------------------------

export function seedOpen(
  pairs: Pair[],
  games: CompletedRRGame[],
  courtCount: 1 | 2,
  minGames: number = PLAYOFF_MIN_GAMES,
): StandingRow[] {
  const h2h = buildPairH2h(games);
  const rows = sortSeeding(applyFloor(pairStandings(pairs, games), minGames), h2h);
  return rows.slice(0, courtCount === 1 ? 4 : 8);
}
