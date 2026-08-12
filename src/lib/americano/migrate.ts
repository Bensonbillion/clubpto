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

import type {
  AmericanoPlayer, AmericanoPool, AmericanoSession,
} from "@/types/americano";

export const AMERICANO_SCHEMA_VERSION = 5;

export function emptyPool(id: string, label: "Court 1" | "Court 2"): AmericanoPool {
  return {
    id, label, playerIds: [], targetMatches: 4, playoffMode: "undecided",
    status: "setup", matches: [],
  };
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

  const pools: AmericanoPool[] = [
    { ...court2, playerIds: [...court2.playerIds, ...orphans2] },
    { ...court1, playerIds: [...court1.playerIds, ...orphans1] },
  ];
  const date = typeof old.date === "string" && old.date ? old.date : today;
  const healed: AmericanoSession = {
    ...(old as AmericanoSession),
    id: old.id || `night-${date}`,
    date,
    players,
    pools,
  };
  // Dedupe so re-migrating an already-healed state is idempotent — the same
  // unresolved orphan must not stack a new copy of its error on every load.
  const unique = [...new Set(integrityErrors)];
  if (unique.length > 0) healed.integrityErrors = unique;
  else delete healed.integrityErrors;
  return healed;
}
