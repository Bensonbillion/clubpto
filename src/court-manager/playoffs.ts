// Court Manager v3 — playoff selection, seeding, and brackets (§11).
//
// Seeding chain everywhere: Win% → head-to-head → strength of schedule
// (combined Win% of opponents faced) → coin flip (visible, deterministic per
// matchup so re-renders never re-flip). The applied tiebreaker is recorded for
// display. NEVER raw win totals (historical bug: 7W-13L once seeded above
// 4W-0L). Eligibility floor: ≥2 games played to qualify (admin-overridable).

import type { Pair, Player, PlayoffMatch, StandingRow, Tier } from "./types";
import { buildDisplayNames } from "./displayNames";

export interface CompletedRRGame {
  pairIds: [string, string];
  winnerPairId: string;
}

function h2hKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** wins of `a` over `b` minus wins of `b` over `a`, at pair level. */
export function buildPairH2h(games: CompletedRRGame[]): (a: string, b: string) => number {
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

const tierRank = (t: Tier): number => (t === "A" ? 0 : t === "B" ? 1 : 2);

/**
 * Selection: tier priority — A players seed first, then B, then C, each ordered
 * by the seeding chain. THE LEAPFROG EXCEPTION (owner's rule): a lower-tier
 * player who BEAT a higher-tier player head-to-head, with an equal-or-better
 * win %, seeds ABOVE that specific higher player. So a B who beat an A takes
 * priority over that A; a C who beat a B takes priority over that B. (A never
 * plays C in 2-court mode, so C-beat-A cannot occur.) The top 8 of the
 * resulting order make the bracket.
 */
export function seedWednesdayTop8(
  players: Player[],
  pairs: Pair[],
  games: CompletedRRGame[],
  minGames: number = PLAYOFF_MIN_GAMES,
): WednesdaySeeding {
  // Seeds are PAIRS — the night is played in fixed pairs and padel is doubles,
  // so the knockout is pair vs pair (seed 1 PLAYS seed 8). Head-to-head is
  // therefore already at the right granularity.
  const h2h = buildPairH2h(games);
  // Same disambiguated names the rest of the app shows (shared first names get
  // a last-name initial), so a seed reads the same as the court card.
  const playerNameOf = buildDisplayNames(players);
  const labelled = pairStandings(pairs, games).map((r) => {
    const pair = pairs.find((p) => p.id === r.id);
    return {
      ...r,
      name: pair ? pair.playerIds.map((id) => playerNameOf.get(id) ?? id).join(" & ") : r.id,
    };
  });

  const notes: string[] = [];
  const rows = applyFloor(labelled, minGames, notes);

  // Default order: tier priority, each tier sorted by the chain.
  const full = (["A", "B", "C"] as Tier[]).flatMap((t) =>
    sortSeeding(rows.filter((r) => r.tier === t), h2h),
  );

  // Leapfrog pairs: L (strictly lower tier) beat H head-to-head with >= win%.
  const leapfrogs: { L: string; H: string }[] = [];
  for (const L of rows) {
    for (const H of rows) {
      if (tierRank(L.tier) <= tierRank(H.tier)) continue;
      if (h2h(L.id, H.id) <= 0) continue; // L must have won the head-to-head
      if (L.winPct < H.winPct) continue; // with an equal-or-better win %
      leapfrogs.push({ L: L.id, H: H.id });
    }
  }

  // Move each leapfrogger to immediately above the higher player they beat;
  // iterate until stable (small N; the guard is a safety cap).
  const nameOf = new Map(rows.map((r) => [r.id, r] as const));
  const noted = new Set<string>();
  let guard = full.length * full.length + 1;
  let moved = true;
  while (moved && guard-- > 0) {
    moved = false;
    for (const { L, H } of leapfrogs) {
      const li = full.findIndex((r) => r.id === L);
      const hi = full.findIndex((r) => r.id === H);
      if (li === -1 || hi === -1 || li < hi) continue; // already above / missing
      const [row] = full.splice(li, 1);
      full.splice(full.findIndex((r) => r.id === H), 0, row);
      moved = true;
      const key = `${L}>${H}`;
      if (!noted.has(key)) {
        noted.add(key);
        const l = nameOf.get(L);
        const hh = nameOf.get(H);
        if (l && hh) {
          notes.push(
            `${l.name} (${l.tier}) beat ${hh.name} (${hh.tier}) head-to-head with an equal-or-better record — seeds above them.`,
          );
          row.tiebreakApplied = `beat ${hh.name} (${hh.tier}) head-to-head`;
        }
      }
    }
  }

  return { seeds: full.slice(0, 8), notes };
}

/**
 * Standard single-elimination seeding, pair vs pair. With 8 seeds the quarters
 * are 1v8 and 4v5 (top half) and 2v7 and 3v6 (bottom half), so the winners meet
 * in the semis and the top two seeds can only collide in the final. Short
 * fields degrade the standard way: 4-7 seeds → semis (1v4, 2v3); 2-3 → a
 * straight final; fewer than 2 → no bracket.
 */
export function wednesdayBracket(seeds: StandingRow[], pairs: Pair[]): PlayoffMatch[] {
  // A seed is a pair; the team's ids are that pair's two players so the board
  // can render real names.
  const idsOf = (r: StandingRow): string[] =>
    pairs.find((p) => p.id === r.id)?.playerIds.slice() ?? [r.id];
  const side = (i: number) => ({ seedLabel: `${i + 1}`, ids: idsOf(seeds[i]) });

  if (seeds.length >= 8) {
    return [
      { id: "q1", stage: "quarter", court: 1, a: side(0), b: side(7) }, // 1 v 8
      { id: "q2", stage: "quarter", court: 2, a: side(3), b: side(4) }, // 4 v 5
      { id: "q3", stage: "quarter", court: 1, a: side(1), b: side(6) }, // 2 v 7
      { id: "q4", stage: "quarter", court: 2, a: side(2), b: side(5) }, // 3 v 6
    ];
  }
  if (seeds.length >= 4) {
    return [
      { id: "semi1", stage: "semi", court: 1, a: side(0), b: side(3) }, // 1 v 4
      { id: "semi2", stage: "semi", court: 2, a: side(1), b: side(2) }, // 2 v 3
    ];
  }
  if (seeds.length >= 2) {
    return [{ id: "final", stage: "final", court: 1, a: side(0), b: side(1) }];
  }
  return [];
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
