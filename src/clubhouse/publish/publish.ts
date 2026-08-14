// Sending the night. One call, one transaction, one answer.
//
// Every decision was already made in plan.ts; this file exists to make the
// single RPC call and to make its failure legible. The engine client, not the
// clubhouse one — Publish happens on the court manager, where the admin's
// session lives (storageKey "engine-auth").

import { supabase } from "@/integrations/supabase/client";
import type { PublishPayload } from "./plan";

export class PublishFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishFailed";
  }
}

/** What landed, straight from the database, for the confirm screen to show. */
export interface PublishCounts {
  session_id: string;
  pairs: number;
  results: number;
  champions: number;
  finalists: number;
  attendance: number;
  aliases: number;
}

/**
 * A Postgres error, turned into something an admin can act on at 11pm.
 *
 * The function raises its own refusals already written in plain language, so
 * those pass through untouched. What is translated here is everything the
 * database says in its own voice — a constraint name helps nobody standing
 * courtside with a tablet.
 */
function readable(message: string, code?: string): string {
  if (code === "42501" || /row-level security|not signed in as a court manager/i.test(message)) {
    return "Your court manager sign-in has expired, so nothing was published. Enter the passcode again and retry.";
  }
  if (code === "PGRST202" || /could not find the function|schema cache/i.test(message)) {
    return "This app cannot find the publish routine in the database. Migration 007 has not been applied.";
  }
  if (/duplicate key|unique constraint/i.test(message)) {
    return "Part of this night is already filed under a different id. Nothing was published — send this to the club before retrying.";
  }
  if (/violates foreign key/i.test(message)) {
    return "Somebody in this night is not on the roster, so nothing was published. Match every name, then retry.";
  }
  if (/fetch|network|failed to fetch/i.test(message)) {
    return "The club's database could not be reached, so nothing was published. Check the connection and retry.";
  }
  return message;
}

/**
 * Publish the night.
 *
 * Throws PublishFailed on ANY problem, and the failure is total: the whole
 * write is one statement inside one function, so a refusal leaves the
 * published record exactly as it was. There is no half-published night.
 */
export async function publishSessionOrThrow(payload: PublishPayload): Promise<PublishCounts> {
  // Cast: src/integrations/supabase/types.ts is generated and predates this
  // function, so `rpc` types its name as `never`. Regenerating those types
  // needs the service-role key, which does not belong in this repo.
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: PublishCounts | null; error: { message: string; code?: string } | null }>;

  let data: PublishCounts | null = null;
  let error: { message: string; code?: string } | null = null;
  try {
    ({ data, error } = await rpc("publish_session", {
      p_session: payload.session,
      p_pairs: payload.pairs,
      p_results: payload.results,
      p_champions: payload.champions,
      p_finalists: payload.finalists,
      p_attendance: payload.attendance,
      p_aliases: payload.aliases,
    }));
  } catch (thrown) {
    throw new PublishFailed(readable(thrown instanceof Error ? thrown.message : String(thrown)));
  }

  if (error) throw new PublishFailed(readable(error.message, error.code));
  if (!data) {
    // The call succeeded and said nothing. Reporting that as published would
    // be the exact failure this whole design exists to prevent.
    throw new PublishFailed(
      "The database accepted the night but did not confirm what it wrote, so this is not being reported as published. Check the clubhouse before retrying."
    );
  }
  return data;
}
