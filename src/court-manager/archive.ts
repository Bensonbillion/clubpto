// Archive a night before anything clears it (C7 / C7a).
//
// v3's resetSession() and v4's "End session and reset" both overwrite the
// single game_state row that holds the session. This copies it into
// game_state_archive first, and THROWS if it cannot — the callers must not
// clear on a failed archive.
//
// WHY BOTH COPIES (C7a). Archiving only the remote row loses a night that
// never synced: a push failing since 7pm leaves remote empty or stale while
// the device holds the only real copy, and "nothing stored yet" would then
// report nothing to lose and clear it. Archiving only the in-memory envelope
// inverts the same bug: two admins, one on a stale tab hits reset, and the
// other device's newer commits go unarchived. So: archive the remote row,
// and additionally archive this device's envelope when it differs.
//
// Two rows for one reset is expected and correct. They are told apart by the
// `reason` column ("remote" / "local"), which is why no variant column exists.

import { supabase } from "@/integrations/supabase/client";

export class ArchiveFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveFailed";
  }
}

export type ArchiveSource = "remote" | "local";

export interface ArchivedCopy {
  source: ArchiveSource;
  archivedAt: string;
  bytes: number;
}

export interface ArchiveOutcome {
  /** Empty only when remote AND memory were both empty — nothing to lose. */
  archived: ArchivedCopy[];
}

export interface ArchiveOptions {
  /** This device's current envelope, from SessionStore.snapshot(). */
  local?: unknown;
  /** Which reset path asked, recorded alongside the source. */
  label?: string;
}

/** Cast: the generated Database type predates game_state_archive. */
function archiveInsert(row: Record<string, unknown>) {
  const insertInto = supabase.from as unknown as (
    table: string
  ) => { insert: (r: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
  return insertInto("game_state_archive").insert(row);
}

async function writeCopy(
  rowId: string,
  source: ArchiveSource,
  state: unknown,
  sourceUpdatedAt: string | null,
  archivedAt: string,
  label: string | undefined,
  userId: string | null
): Promise<ArchivedCopy> {
  const { error } = await archiveInsert({
    row_id: rowId,
    state,
    source_updated_at: sourceUpdatedAt,
    archived_at: archivedAt,
    archived_by: userId,
    reason: label ? `${source} — ${label}` : source,
  });
  if (error) {
    throw new ArchiveFailed(`Could not archive the ${source} copy of the session: ${error.message}`);
  }
  return { source, archivedAt, bytes: JSON.stringify(state).length };
}

/**
 * Copy the current night into the archive: the remote game_state row, plus
 * this device's envelope when it differs.
 *
 * Throws ArchiveFailed if the read fails or EITHER insert fails. Returns an
 * empty list only when there is genuinely nothing anywhere to lose.
 */
export async function archiveGameStateRow(
  rowId: string,
  options: ArchiveOptions = {}
): Promise<ArchiveOutcome> {
  const { local, label } = options;

  const { data, error } = await supabase
    .from("game_state")
    .select("state, updated_at")
    .eq("id", rowId)
    .maybeSingle();

  if (error) {
    throw new ArchiveFailed(`Could not read the session to archive it: ${error.message}`);
  }

  const remoteState = data?.state ?? null;
  const localState = local ?? null;

  // The ONLY safe early return: nothing anywhere.
  if (remoteState === null && localState === null) {
    return { archived: [] };
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // Distinct timestamps so both rows satisfy unique (row_id, archived_at).
  const base = Date.now();
  const archived: ArchivedCopy[] = [];

  if (remoteState !== null) {
    archived.push(
      await writeCopy(
        rowId,
        "remote",
        remoteState,
        data?.updated_at ?? null,
        new Date(base).toISOString(),
        label,
        userId
      )
    );
  }

  // Only when it actually differs — an in-sync device would otherwise double
  // every archive for no benefit.
  const differs = localState !== null && JSON.stringify(localState) !== JSON.stringify(remoteState);
  if (differs) {
    archived.push(
      await writeCopy(
        rowId,
        "local",
        localState,
        null,
        new Date(base + 1).toISOString(),
        label,
        userId
      )
    );
  }

  return { archived };
}

/**
 * Test seam. Used to prove that a failing archive blocks the reset, which is
 * the half a happy-path check would never catch.
 */
let override: typeof archiveGameStateRow | null = null;

export function __setArchiveOverrideForTests(fn: typeof archiveGameStateRow | null) {
  override = fn;
}

export function archiveOrThrow(rowId: string, options?: ArchiveOptions): Promise<ArchiveOutcome> {
  return (override ?? archiveGameStateRow)(rowId, options);
}
