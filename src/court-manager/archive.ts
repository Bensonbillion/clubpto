// Archive a night before anything clears it (C7).
//
// v3's resetSession() and v4's "End session and reset" both overwrite the
// single game_state row that holds the session. This copies that row into
// game_state_archive first, and THROWS if it cannot — the callers must not
// clear on a failed archive. A reset that silently loses a night is the
// failure this exists to prevent.

import { supabase } from "@/integrations/supabase/client";

export class ArchiveFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveFailed";
  }
}

export interface ArchiveOutcome {
  /** Null when there was nothing stored yet — a reset on an empty row. */
  archivedAt: string | null;
  bytes: number;
}

/**
 * Copy the current game_state row into the archive.
 *
 * Throws ArchiveFailed on any read or write error. Returns
 * `{ archivedAt: null }` when the row does not exist yet, which is not a
 * failure: there is genuinely nothing to lose.
 */
export async function archiveGameStateRow(
  rowId: string,
  reason = "reset"
): Promise<ArchiveOutcome> {
  const { data, error } = await supabase
    .from("game_state")
    .select("state, updated_at")
    .eq("id", rowId)
    .maybeSingle();

  if (error) {
    throw new ArchiveFailed(`Could not read the session to archive it: ${error.message}`);
  }
  if (!data?.state) {
    return { archivedAt: null, bytes: 0 };
  }

  const archivedAt = new Date().toISOString();
  const { data: auth } = await supabase.auth.getUser();

  // Cast: src/integrations/supabase/types.ts is generated and predates this
  // table, so `from` types its name as never. Regenerating needs the
  // service-role key, which does not belong in this repo.
  const insertInto = supabase.from as unknown as (
    table: string
  ) => { insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };

  const { error: insertError } = await insertInto("game_state_archive").insert({
    row_id: rowId,
    state: data.state,
    source_updated_at: data.updated_at,
    archived_at: archivedAt,
    archived_by: auth?.user?.id ?? null,
    reason,
  });

  if (insertError) {
    throw new ArchiveFailed(`Could not archive the session: ${insertError.message}`);
  }

  return { archivedAt, bytes: JSON.stringify(data.state).length };
}

/**
 * Test seam. When set, archiveGameStateRow is replaced — used to prove that a
 * failing archive blocks the reset, which is the half of C7 that a happy-path
 * check would never catch.
 */
let override: typeof archiveGameStateRow | null = null;

export function __setArchiveOverrideForTests(fn: typeof archiveGameStateRow | null) {
  override = fn;
}

export function archiveOrThrow(rowId: string, reason?: string): Promise<ArchiveOutcome> {
  return (override ?? archiveGameStateRow)(rowId, reason);
}
