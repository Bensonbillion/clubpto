// Where the roster comes from, and what it does when the club's table is out
// of reach.
//
// One rule governs this file: loadRoster never throws, never rejects, and
// never returns an empty list. The wizard's step 2 is "who is here tonight",
// and there is no version of a padel night where the answer is "the network
// said no". Every branch below ends with names in hand.

import { BUNDLED_ROSTER, type RosterName } from "./names";
import { mergeRoster } from "./merge";
import { clubhouse } from "@/clubhouse/supabaseClient";

/** Where the names on screen actually came from, so the UI can say so. */
export type RosterOrigin = "bundled" | "club";

export interface RosterLoad {
  names: RosterName[];
  origin: RosterOrigin;
  /** A sentence an operator can read mid-night, or null when all is well. */
  error: string | null;
}

// Two sentences, not stack traces. Whoever reads these is standing courtside
// with a phone in one hand, deciding whether to carry on or go find wifi. The
// second half of each tells them the night is not blocked.
//
// NOT_VISIBLE is not an alarm. Until the anon read policy is applied or the
// passcode function ships, an anon reader seeing nothing is the DESIGNED state
// on every phone, every Wednesday. A banner that fires every single night is
// how an operator learns to ignore banners, so nothing renders this string
// today: the wizard says only which list it is showing. It is kept because the
// distinction between "the request failed" and "this reader is not allowed"
// is the first thing anyone debugging the refresh will want.
const UNREADABLE =
  "Could not read the club list. Showing the names that ship with the app.";
const NOT_VISIBLE =
  "The club list came back with nothing to read. Showing the names that ship with the app.";

/**
 * How long to wait for the club list before giving up on it.
 *
 * There was no deadline here, and supabase-js sets none of its own. That is
 * not a theoretical hang: the client is configured with autoRefreshToken, so
 * every request first waits on the auth lock keyed to this origin, and another
 * tab mid token-refresh holds it. The request never opens a socket and never
 * settles, so the hook sat at loading forever with error null, which every
 * reader of that state would take to mean all is well. A refresh that has not
 * answered in six seconds has nothing to add to a night that is already
 * running on the bundled names.
 */
const DEADLINE_MS = 6000;

const TOOK_TOO_LONG =
  "The club list did not answer. Showing the names that ship with the app.";

/** The bundled list, as a fresh mutable array the caller can own. */
const bundledOnly = (error: string | null): RosterLoad => ({
  names: [...BUNDLED_ROSTER],
  origin: "bundled",
  error,
});

export async function loadRoster(): Promise<RosterLoad> {
  try {
    // Raced rather than aborted. Aborting a PostgREST call through supabase-js
    // means threading a signal the query builder only partly honours, and the
    // thing that matters here is that the CALLER stops waiting. A request left
    // running in the background costs one connection and settles into nothing.
    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), DEADLINE_MS));

    const query = clubhouse
      .from("clubhouse_roster")
      .select("player_id,display_name")
      .eq("hidden", false);

    const settled = await Promise.race([query, timeout]);
    if (settled === "timeout") return bundledOnly(TOOK_TOO_LONG);

    const { data, error } = settled;

    // A real error from the query. Network down, project asleep, policy
    // rejection that surfaced properly. Nothing to merge, so hold the bundle.
    if (error) return bundledOnly(UNREADABLE);

    // ZERO ROWS IS NOT AN EMPTY ROSTER. READ THIS BEFORE CHANGING IT.
    //
    // clubhouse_roster's RLS policy grants SELECT to `authenticated` only. The
    // manager's door is a passcode, not a login, so there is no auth session
    // on this client and the request goes out anonymously. PostgREST answers
    // an anon read of a table it may not see with HTTP 200 and `[]`. Not 401,
    // not 403, and `error` is null. Verified against the live project.
    //
    // So an empty array here means "this reader was not allowed to see the
    // rows", not "the club has no members". The table has 66 of them. If this
    // branch treated [] as truth, the manager would open to an empty picker on
    // a night with twenty people waiting, and the code would look correct.
    //
    // The same answer is right even if the club really did empty the table:
    // falling back to the bundle costs nothing, and getting it backwards costs
    // the night.
    if (!data || data.length === 0) return bundledOnly(NOT_VISIBLE);

    // A row with no usable name would render as a blank line in the picker,
    // and a blank line is untappable and unexplainable at 8pm. Drop it here
    // rather than teach every screen to defend against it.
    const rows: RosterName[] = [];
    for (const row of data) {
      const playerId = typeof row?.player_id === "string" ? row.player_id.trim() : "";
      const displayName = typeof row?.display_name === "string" ? row.display_name.trim() : "";
      if (playerId === "" || displayName === "") continue;
      rows.push({ playerId, displayName });
    }

    // Rows came back but none of them were usable. That is the same situation
    // as no rows at all, and it gets the same answer for the same reason.
    if (rows.length === 0) return bundledOnly(NOT_VISIBLE);

    return { names: mergeRoster(BUNDLED_ROSTER, rows), origin: "club", error: null };
  } catch {
    // The client can throw rather than resolve: a DNS failure, an aborted
    // fetch, a phone that dropped off wifi mid-request. The caller is a React
    // effect and an unhandled rejection there would leave the picker on a
    // spinner forever, so the throw stops here and becomes a normal result.
    return bundledOnly(UNREADABLE);
  }
}
