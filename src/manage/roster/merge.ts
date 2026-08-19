// Reconciling the bundled roster with whatever the club's table returns.
//
// Pure functions only. No fetching, no client, no React. Everything that can
// go wrong on a live night should be reproducible from a plain array, and
// that is only true while this file has no I/O in it.

import type { RosterName } from "./names";

/**
 * The one ordering rule, in one place.
 *
 * The locale is named explicitly rather than left to the host, because the
 * generated names.ts is sorted at build time on one machine and this runs on
 * every phone that opens the manager. If the two disagreed about where "Ade"
 * sits next to "Adee", the list would visibly reshuffle the moment a remote
 * read landed. Ties fall back to playerId so the order is total, not merely
 * stable by accident of the sort implementation.
 */
const byDisplayName = (a: RosterName, b: RosterName): number =>
  a.displayName.localeCompare(b.displayName, "en") ||
  a.playerId.localeCompare(b.playerId, "en");

/**
 * Fold a remote roster read into the bundled one.
 *
 * The result is always at least as long as `bundled`. That is the whole point
 * of the function, and the rules below exist to keep it true.
 */
export function mergeRoster(
  bundled: readonly RosterName[],
  remote: readonly RosterName[],
): RosterName[] {
  const merged = new Map<string, RosterName>();

  for (const entry of bundled) merged.set(entry.playerId, entry);

  for (const entry of remote) {
    // Remote wins on displayName. If someone opened the database and fixed a
    // spelling, or folded an annotation variant, that correction is newer than
    // the build and should be what the manager reads off the screen tonight.
    // Adding an id that is not in the map is the same write, and covers the
    // other case: a member who joined after the last deploy.
    merged.set(entry.playerId, entry);
  }

  // Bundled ids are never dropped, even when the remote read succeeded.
  //
  // This is the rule that costs the most to get wrong. clubhouse_roster is
  // read under RLS, and a reader who sees a subset is indistinguishable here
  // from a reader who sees the truth: both come back as a shorter list with no
  // error. Treating "absent from the remote list" as "removed" would let a
  // policy change, a filter, or a half-applied migration quietly shrink the
  // list the night runs on, and the failure would only surface as a real
  // person standing on the court who cannot be added.
  //
  // Removing someone from the roster is a deliberate act. Nothing in a read
  // carries that intent, so nothing here infers it.
  //
  // THE COST OF THAT RULE, STATED PLAINLY. Setting `hidden` on one of the 66
  // bundled names does NOT take them out of the manager's picker, because the
  // remote read filters hidden rows out and this merge treats absence as
  // "not visible to me" rather than "gone". So a member who asks to be left
  // out is removed from every clubhouse surface immediately and from THIS one
  // only at the next deploy: edit the seed, run scripts/gen-manage-roster.mjs,
  // commit, ship. That is the procedure, it is two commands, and it is written
  // down here rather than discovered later because the alternative rule, where
  // a short read silently shrinks the night's list, fails in a way nobody can
  // see until a real person is standing on the court unable to be added.

  return [...merged.values()].sort(byDisplayName);
}

/**
 * Find the roster entry a typed walk-in name already refers to.
 *
 * The manager types a name at the door for someone who is not on the list. If
 * that person IS on the list and the typing just did not go through the
 * picker, creating a second person splits their night in two: half their games
 * on one id, half on another, and standings that add up to nothing. Offering
 * the roster row instead is the fix.
 *
 * Returns null when the name is genuinely new, which is the common case and
 * is not a failure.
 */
export function dedupeWalkIn(
  roster: readonly RosterName[],
  typedName: string,
): RosterName | null {
  const needle = typedName.trim().toLowerCase();

  // An empty box is not a match against anything, and without this guard the
  // comparison below would be a question nobody asked.
  if (needle === "") return null;

  // Whole-string equality only. Substring matching is tempting here and is
  // exactly wrong: this roster holds Ade and Adee, Temi and Temitope, Timi and
  // "Timi Olaoye", kept separate on purpose because they co-occurred on the
  // same night and are different people. Typing "Timi" must never resolve to
  // "Timi Olaoye", because the cost is the wrong human in the match.
  return roster.find((entry) => entry.displayName.trim().toLowerCase() === needle) ?? null;
}
