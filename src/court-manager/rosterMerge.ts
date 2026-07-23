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

/** Fill only a missing last name; never blank out data the existing row already has. */
function attach(existing: Player, incoming: Player): Player {
  return {
    ...existing,
    name: incoming.name.trim() || existing.name,
    lastName: existing.lastName ?? incoming.lastName,
  };
}

export function mergeRoster(existing: Player[], incoming: Player[]): RosterMergeResult {
  const players = [...existing];
  const usedIdx = new Set<number>();
  let added = 0;
  let updated = 0;

  // Count first-name occurrences so a first-name-only match is used only when unambiguous.
  const firstNameCounts = new Map<string, number>();
  for (const p of players) {
    const k = norm(p.name);
    firstNameCounts.set(k, (firstNameCounts.get(k) ?? 0) + 1);
  }

  for (const inc of incoming) {
    let idx = players.findIndex((p, i) => !usedIdx.has(i) && p.id === inc.id);
    if (idx === -1) {
      idx = players.findIndex(
        (p, i) => !usedIdx.has(i) && fullKey(p.name, p.lastName) === fullKey(inc.name, inc.lastName),
      );
    }
    if (idx === -1) {
      const k = norm(inc.name);
      if ((firstNameCounts.get(k) ?? 0) === 1) {
        idx = players.findIndex((p, i) => !usedIdx.has(i) && norm(p.name) === k);
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
