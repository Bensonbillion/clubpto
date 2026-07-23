// Court Manager v3 — pure roster merge, shared by the classic-roster import
// and the CSV import so dedup logic lives in exactly ONE place.
//
// Merge rules (conservative — never fabricate or collide distinct people):
//   1. same stable id            → update in place
//   2. same first+last name      → update in place (attach contacts)
//   3. UNIQUE first-name match   → update in place (CSV contacts attach to an
//      existing first-name-only entry, e.g. the classic "Benson")
//   4. otherwise                 → add as a new player
// An existing entry is matched at most once, so re-importing is idempotent and
// two people who share a first name never collapse into one.

import type { Player } from "./types";
import { normalizeKey as norm } from "./util";

export interface RosterMergeResult {
  players: Player[];
  added: number;
  updated: number;
}

function fullKey(first: string, last: string | undefined | null): string {
  return `${norm(first)}|${norm(last)}`;
}

/**
 * Merge two rows for the same person. Preference rules make the result
 * order-independent: keep the STABLE (non-csv_) id and the REAL (non-default-B)
 * tier so a classic member never loses their identity or skill tier to a CSV
 * row, whichever is imported first. Fill a missing last name; never blank data.
 */
function attach(existing: Player, incoming: Player): Player {
  const preferIncomingId = existing.id.startsWith("csv_") && !incoming.id.startsWith("csv_");
  return {
    ...existing,
    id: preferIncomingId ? incoming.id : existing.id,
    tier: existing.tier !== "B" ? existing.tier : incoming.tier,
    name: incoming.name.trim() || existing.name,
    lastName: existing.lastName ?? incoming.lastName,
  };
}

function firstNameCounts(players: Player[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of players) {
    const k = norm(p.name);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export function mergeRoster(existing: Player[], incoming: Player[]): RosterMergeResult {
  const players = [...existing];
  const usedIdx = new Set<number>();
  let added = 0;
  let updated = 0;

  // A bare first name is matched ONLY when it is unambiguous on BOTH sides —
  // exactly one such person in the existing roster AND exactly one in the
  // incoming batch. Otherwise we'd either staple an arbitrary surname on the
  // wrong person or collapse two distinct people who happen to share a name.
  const existingFirst = firstNameCounts(existing);
  const incomingFirst = firstNameCounts(incoming);

  for (const inc of incoming) {
    let idx = players.findIndex((p, i) => !usedIdx.has(i) && p.id === inc.id);
    if (idx === -1) {
      idx = players.findIndex(
        (p, i) => !usedIdx.has(i) && fullKey(p.name, p.lastName) === fullKey(inc.name, inc.lastName),
      );
    }
    if (idx === -1) {
      const k = norm(inc.name);
      if ((existingFirst.get(k) ?? 0) === 1 && (incomingFirst.get(k) ?? 0) === 1) {
        // Known-distinct when BOTH carry a last name (the equal-full-name case
        // was already consumed above, so two surnames here means they differ).
        const incHasLast = norm(inc.lastName) !== "";
        idx = players.findIndex(
          (p, i) => !usedIdx.has(i) && norm(p.name) === k && !(incHasLast && norm(p.lastName) !== ""),
        );
      }
    }
    if (idx !== -1) {
      usedIdx.add(idx);
      players[idx] = attach(players[idx], inc);
      updated += 1;
    } else {
      players.push(inc);
      added += 1;
    }
  }

  return { players, added, updated };
}
