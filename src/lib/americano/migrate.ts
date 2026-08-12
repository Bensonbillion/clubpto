// PTO Americano v4 — schema versioning + envelope healing (pure).
//
// THE RULE, self-enforced by __tests__/schema.test.ts: any change to the
// persisted AmericanoSession shape moves AMERICANO_SCHEMA_VERSION and the
// canonical fixture TOGETHER. A version-matched envelope loads unmigrated,
// so an unbumped shape change is the white-screen class of bug.
//
// Version history:
//   v2 — Step 1 shape (no session.players).
//   v3 — session.players added.
//   v4 — structural heal of the two court pools introduced.
//   v5 — phase-AWARE healing + integrityErrors surface (Step 4 addendum):
//        setup-phase orphans re-seat by the split rule; once the session is
//        active (or any pool has matches), a player who appears in ANY match
//        (voided included) is NEVER silently re-seated — an orphan with
//        history becomes a surfaced hard error instead.
//   v6 — AmericanoMatch.catchUpGranted (Step 5): the receipt for a late
//        arrival's single catch-up, so discarding an unplayed match refunds
//        the exemption instead of burning it. Optional and additive — a v5
//        envelope loads unchanged, its in-flight matches simply carry no
//        receipt (worst case: one exemption not refunded, exactly today's
//        behaviour).
//   v9 — Configurable match format (Step F): AmericanoPool.matchFormat and
//        AmericanoSession.defaultMatchFormat, and the result shape
//        generalizes from a hard-coded "2-0"/"2-1" alphabet to
//        { winner, setsLost } (best of N) | { winner, loserPoints } (a single
//        game to T). Legacy scores convert by their loser's game count, which
//        is BEHAVIOURALLY identical: at best of 3, games won − games lost is
//        the original +2 / +1.
//   v8 — AmericanoPool.groupFlipResolutions REPLACES coinFlipResolutions
//        (Step 6.2): a coin-decided TOTAL ORDER over an exact tied set,
//        instead of a bag of pairwise verdicts that computeStandings could
//        only read between adjacent rows. Each legacy pairwise resolution
//        becomes a two-member group record — order [winner, loser], the coin
//        preserved in the audit trail — which reproduces exactly what the old
//        model did for a healthy two-player tie.
//   v7 — AmericanoPool.coinFlipResolutions (Step 6): the visible coin flips
//        run tonight. The ONLY standings-related state ever persisted — the
//        table itself is always recomputed. Optional and additive; a v6
//        envelope loads with no flips recorded, which is the honest state of
//        a night where none were run.

import type {
  AmericanoPlayer, AmericanoPool, AmericanoSession, GroupFlipRecord,
} from "@/types/americano";
import { computeRecords, strengthOfSchedule } from "./standings";
import { DEFAULT_FORMAT } from "./format";

/**
 * Legacy pairwise coin flips → two-member group records. The order is
 * [winner, loser] and the coin itself is kept in the trail, so a tie that was
 * healthy under the old model reads identically under the new one. The line
 * is taken from the pool as it stands: if the pair is no longer tied, the
 * record is stale and liveness drops it on the next read — exactly what the
 * old staleness rule did.
 */
function convertLegacyFlips(pool: AmericanoPool): AmericanoPool {
  const legacy = pool.coinFlipResolutions;
  if (!legacy || legacy.length === 0) {
    if (!("coinFlipResolutions" in pool)) return pool;
    const cleaned = { ...pool };
    delete cleaned.coinFlipResolutions;
    return cleaned;
  }
  const records = computeRecords(pool);
  const EMPTY = { matchesPlayed: 0, wins: 0, losses: 0, gameDiff: 0 };
  const converted: GroupFlipRecord[] = legacy.map((f) => {
    const loser = f.winner === f.a ? f.b : f.a;
    const r = records.get(f.winner) ?? EMPTY;
    return {
      members: [f.a, f.b].sort(),
      line: {
        w: r.wins, l: r.losses, diff: r.gameDiff,
        sos: strengthOfSchedule(pool, f.winner),
      },
      order: [f.winner, loser],
      flips: [{ a: f.a, b: f.b, winner: f.winner, at: f.at }],
    };
  });
  const next = { ...pool, groupFlipResolutions: [...(pool.groupFlipResolutions ?? []), ...converted] };
  delete next.coinFlipResolutions;
  return next;
}

export const AMERICANO_SCHEMA_VERSION = 9;

export function emptyPool(id: string, label: "Court 1" | "Court 2"): AmericanoPool {
  return {
    id, label, playerIds: [], targetMatches: 4, playoffMode: "undecided",
    status: "setup", matches: [], matchFormat: DEFAULT_FORMAT,
  };
}

/** Legacy results carried the winner's score as a string ("2-0"/"2-1"); the
    generalized shape records only what the LOSERS took, so the winner's total
    is implied by the format. Same match, same differential. */
function convertLegacyResults(pool: AmericanoPool): AmericanoPool {
  let touched = false;
  const matches = pool.matches.map((m) => {
    const legacy = m.result as { winner: "A" | "B"; score?: string } | null;
    if (!legacy || typeof legacy.score !== "string") return m;
    touched = true;
    const setsLost = Number(legacy.score.split("-")[1] ?? 0);
    return { ...m, result: { winner: legacy.winner, setsLost } };
  });
  return touched ? { ...pool, matches } : pool;
}

/** A pool with no recorded format predates Step F, so it played best of 3. */
function ensureFormat(pool: AmericanoPool): AmericanoPool {
  return pool.matchFormat ? pool : { ...pool, matchFormat: DEFAULT_FORMAT };
}

/** The canonical default session at the CURRENT schema version. The fixture
    test serializes this and compares against the committed fixture — a fixed
    date keeps it deterministic. */
export function canonicalSession(date = "2026-01-01"): AmericanoSession {
  return {
    id: `night-${date}`,
    date,
    sessionName: "",
    players: [],
    pools: [emptyPool("court-2", "Court 2"), emptyPool("court-1", "Court 1")],
    defaultMatchFormat: DEFAULT_FORMAT,
    isPractice: false,
    status: "setup",
  };
}

const inAnyMatch = (pools: AmericanoPool[], playerId: string): boolean =>
  pools.some((pool) =>
    pool.matches.some((m) => m.teamA.includes(playerId) || m.teamB.includes(playerId)),
  );

/**
 * Upgrade + heal an older (or damaged) envelope state. `today` is injected so
 * the module stays clock-free. Returns null only for unrecognizable shapes.
 */
export function migrateAmericanoSession(
  oldState: unknown,
  today: string,
): AmericanoSession | null {
  if (typeof oldState !== "object" || oldState === null) return null;
  const old = oldState as Partial<AmericanoSession>;
  if (!Array.isArray(old.pools) || old.pools.some((p) => !Array.isArray(p?.matches))) return null;
  const players: AmericanoPlayer[] = Array.isArray(old.players) ? old.players : [];

  // Structure: the session always carries exactly the two courts. Rebuild a
  // missing shell; recorded membership and matches pass through untouched.
  const oldPools = old.pools as AmericanoPool[];
  const court2 = oldPools.find((p) => p.id === "court-2") ?? emptyPool("court-2", "Court 2");
  const court1 = oldPools.find((p) => p.id === "court-1") ?? emptyPool("court-1", "Court 1");

  // Phase-aware orphan handling (Step 4 addendum). Setup remedy: re-seat by
  // the split rule. Active phase: pool membership WITH history is immutable —
  // a matchless orphan may still be seated (harmless bookkeeping), but an
  // orphan who has played is a surfaced hard error, never a silent re-seat.
  const activePhase =
    old.status === "active" || old.status === "complete" ||
    oldPools.some((p) => p.matches.length > 0);
  const assigned = new Set([...court2.playerIds, ...court1.playerIds]);
  const orphans2: string[] = [];
  const orphans1: string[] = [];
  const integrityErrors: string[] = [...(old.integrityErrors ?? [])];
  for (const p of players) {
    if (assigned.has(p.playerId)) continue;
    if (activePhase && inAnyMatch([court2, court1], p.playerId)) {
      integrityErrors.push(
        `${p.displayName} has match history but belongs to no pool — assign them manually; their record was not touched.`,
      );
      continue;
    }
    (p.tier === "C" ? orphans1 : orphans2).push(p.playerId);
  }

  const heal = (p: AmericanoPool) =>
    convertLegacyResults(ensureFormat(convertLegacyFlips(p)));
  const pools: AmericanoPool[] = [
    heal({ ...court2, playerIds: [...court2.playerIds, ...orphans2] }),
    heal({ ...court1, playerIds: [...court1.playerIds, ...orphans1] }),
  ];
  const date = typeof old.date === "string" && old.date ? old.date : today;
  const healed: AmericanoSession = {
    ...(old as AmericanoSession),
    id: old.id || `night-${date}`,
    date,
    players,
    pools,
    defaultMatchFormat: old.defaultMatchFormat ?? DEFAULT_FORMAT,
  };
  // Dedupe so re-migrating an already-healed state is idempotent — the same
  // unresolved orphan must not stack a new copy of its error on every load.
  const unique = [...new Set(integrityErrors)];
  if (unique.length > 0) healed.integrityErrors = unique;
  else delete healed.integrityErrors;
  return healed;
}
