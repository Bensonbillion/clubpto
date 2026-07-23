// Court Manager — unambiguous display names (Architectural Law #2).
//
// The real roster is full of shared first names (Temi x6, Timi x5, Samuel x4).
// A helper checking someone in, or a court card reading "Timi & Ade", must be
// able to tell WHICH Timi. The owner's rule:
//
//   • unique first name        → just the first name ("Benson")
//   • shared first name        → add the last-name INITIAL ("Timi A.")
//   • same initial as another  → add as many last-name letters as it takes
//                                ("Timi Ad." vs "Timi Ak.")
//
// Only the people who actually collide get a suffix, so the common case stays
// clean. Someone with a shared first name and NO last name on file keeps the
// bare first name — there is nothing honest to disambiguate with, and inventing
// a suffix would be worse than showing the admin they need to add a last name.

import type { Player } from "./types";

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Shortest prefix of `last` that no other last name in `others` shares.
 * Returns the whole last name if even that doesn't separate them (true twins).
 */
function shortestDistinguishingPrefix(last: string, others: string[]): string {
  for (let len = 1; len <= last.length; len++) {
    const prefix = norm(last.slice(0, len));
    if (!others.some((o) => norm(o.slice(0, len)) === prefix)) return last.slice(0, len);
  }
  return last;
}

/**
 * playerId → the name to SHOW. Pass the whole roster: disambiguation is only
 * meaningful relative to everyone else who might be on court tonight.
 */
export function buildDisplayNames(players: Player[]): Map<string, string> {
  const groups = new Map<string, Player[]>();
  for (const p of players) {
    const key = norm(p.name);
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }

  const out = new Map<string, string>();
  for (const group of groups.values()) {
    // Unique first name — nothing to add.
    if (group.length === 1) {
      out.set(group[0].id, group[0].name.trim());
      continue;
    }
    for (const p of group) {
      const last = (p.lastName ?? "").trim();
      if (!last) {
        // Shared first name but no last name on file — show it bare and let the
        // admin fix the roster rather than fabricate a suffix.
        out.set(p.id, p.name.trim());
        continue;
      }
      const rivals = group
        .filter((q) => q.id !== p.id)
        .map((q) => (q.lastName ?? "").trim())
        .filter((l) => l.length > 0);
      const prefix = shortestDistinguishingPrefix(last, rivals);
      out.set(p.id, `${p.name.trim()} ${prefix}.`);
    }
  }
  return out;
}
