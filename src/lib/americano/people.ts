// PTO Americano v4 — people logistics as PURE state transitions (STEP 5).
//
// The engine already carries the whole layer (§7): status filters selection,
// Infinity wait fronts the queue, joinedAtMatchIndex + catchUpUsed drive the
// single catch-up, the fill rule does the arithmetic after departures. These
// reducers only move players between statuses — and enforce the one rule the
// engine can't see: "not here" is a claim about the past, so it is only legal
// for a player with no match history. An illegal transition returns the state
// unchanged (identity — same convention as live.ts), and the UI asks the
// predicates below before offering an action.

import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoSession,
} from "@/types/americano";
import { countedMatches } from "./generator";

const inMatch = (m: AmericanoMatch, id: string) =>
  m.teamA.includes(id) || m.teamB.includes(id);

const isUnplayed = (m: AmericanoMatch) => m.status === "active" || m.status === "pending";

export function poolOf(s: AmericanoSession, playerId: string): AmericanoPool | undefined {
  return s.pools.find((p) => p.playerIds.includes(playerId));
}

/** They were HERE if they appear in any match that HAPPENED — completed or
    voided (a voided match still had them on court). An unplayed active match
    is not history; that is the discard case. */
export function hasHistory(s: AmericanoSession, playerId: string): boolean {
  return s.pools.some((pool) =>
    pool.matches.some((m) => !isUnplayed(m) && inMatch(m, playerId)),
  );
}

/** "Not here" is only truthful for a player who never took the court. */
export function canMarkNotHere(s: AmericanoSession, playerId: string): boolean {
  const p = s.players.find((x) => x.playerId === playerId);
  return !!p && p.status === "present" && !hasHistory(s, playerId);
}

const setStatus = (
  s: AmericanoSession,
  playerId: string,
  patch: Partial<AmericanoPlayer>,
): AmericanoSession => ({
  ...s,
  players: s.players.map((p) => (p.playerId === playerId ? { ...p, ...patch } : p)),
});

/** DISCARD the player's unplayed active match — it never happened: no log
    entry, no id, no co-occurrence, no partnership. Because match ids are
    length-based, the next generation reuses the freed index and the id
    sequence is unaffected. Completed and voided rows never move.

    "It never happened" reaches the PLAYER records too: a late arrival whose
    single catch-up was spent seating them in the discarded match gets it
    back (match.catchUpGranted is the receipt). Otherwise the exemption is
    burned by a match nobody played, and the generator's back-to-back penalty
    then pushes the rejoiner out of the very quartet they were owed. */
const discardUnplayedWith = (s: AmericanoSession, playerId: string): AmericanoSession => {
  const refund = new Set<string>();
  for (const pool of s.pools) {
    for (const m of pool.matches) {
      if (isUnplayed(m) && inMatch(m, playerId)) {
        for (const id of m.catchUpGranted ?? []) refund.add(id);
      }
    }
  }
  return {
    ...s,
    players: refund.size === 0
      ? s.players
      : s.players.map((p) => (refund.has(p.playerId) ? { ...p, catchUpUsed: false } : p)),
    pools: s.pools.map((pool) => ({
      ...pool,
      matches: pool.matches.filter((m) => !(isUnplayed(m) && inMatch(m, playerId))),
    })),
  };
};

/** present → not_arrived. Rejected (identity) unless canMarkNotHere. */
export function markNotHere(s: AmericanoSession, playerId: string): AmericanoSession {
  if (!canMarkNotHere(s, playerId)) return s;
  return discardUnplayedWith(setStatus(s, playerId, { status: "not_arrived" }), playerId);
}

/** not_arrived → present (rejoin). joinedAtMatchIndex = the pool's completed
    count (null at 0 — they are simply on time-ish). catchUpUsed is left
    untouched: the night grants ONE catch-up, not one per rejoin. */
export function markArrived(s: AmericanoSession, playerId: string): AmericanoSession {
  const p = s.players.find((x) => x.playerId === playerId);
  if (!p || p.status !== "not_arrived") return s;
  const pool = poolOf(s, playerId);
  const done = pool ? countedMatches(pool).length : 0;
  return setStatus(s, playerId, {
    status: "present",
    joinedAtMatchIndex: done === 0 ? null : done,
  });
}

/** present → left. Legal any time; the completed record is preserved
    untouched and the fill rule owns the arithmetic from here. An unplayed
    active match discards exactly like not_arrived. */
export function markLeft(s: AmericanoSession, playerId: string): AmericanoSession {
  const p = s.players.find((x) => x.playerId === playerId);
  if (!p || p.status !== "present") return s;
  return discardUnplayedWith(setStatus(s, playerId, { status: "left" }), playerId);
}

/** left → present — the admin's judgment call (UI keeps it behind a confirm).
    History intact; wait and counts govern their place in the queue. */
export function restoreLeft(s: AmericanoSession, playerId: string): AmericanoSession {
  const p = s.players.find((x) => x.playerId === playerId);
  if (!p || p.status !== "left") return s;
  return setStatus(s, playerId, { status: "present" });
}
