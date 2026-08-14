// The database half of the alias mapping. The decisions themselves are made
// in aliases.ts, which never touches Supabase — this file only reads what is
// already stored and performs the single write.
//
// WHICH CLIENT. The ENGINE client (storageKey "engine-auth"), not the
// clubhouse one. Two clients share this Supabase project and each keeps its
// own session: the clubhouse client holds a member's login from /club, the
// engine client holds the admin's from the /manage passcode pad. Aliases are
// admin-only, and Publish happens on the court manager, so the admin's
// session is the one in this slot. Using the clubhouse client here would
// make is_engine_admin() false and every write fail with 42501.

import { supabase } from "@/integrations/supabase/client";
import type { AliasRow } from "./aliases";

export class AliasCommitFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AliasCommitFailed";
  }
}

/** Cast: the generated Database type predates clubhouse_player_alias. */
function aliasTable() {
  return supabase.from as unknown as (table: string) => {
    select: (columns: string) => Promise<{
      data: { kind: string; value: string; player_id: string }[] | null;
      error: { message: string } | null;
    }>;
    upsert: (
      rows: Record<string, unknown>[],
      options: { onConflict: string }
    ) => Promise<{ error: { message: string } | null }>;
  };
}

/**
 * Every mapping stored today. Throws rather than returning an empty list on
 * failure: a read error that reads as "nothing is mapped yet" would put 24
 * already-answered names back in front of the admin, and the second answer
 * would overwrite the first.
 */
export async function fetchAliases(): Promise<AliasRow[]> {
  const { data, error } = await aliasTable()("clubhouse_player_alias").select("kind, value, player_id");
  if (error) throw new AliasCommitFailed(`Could not read the name mappings: ${error.message}`);
  return (data ?? [])
    .filter((r) => r.kind === "engine_player_id")
    .map((r) => ({ kind: "engine_player_id" as const, value: r.value, playerId: r.player_id }));
}

/**
 * Write the confirmed mappings. ONE statement, so a bad row takes the whole
 * set with it and there is no such thing as half a confirmation. Call this
 * at the moment of Publish, never as the admin taps through the list.
 *
 * Returns the number of rows written. Zero rows is a no-op, not a request.
 */
export async function commitAliasesOrThrow(rows: AliasRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;
  if (!userId) {
    // The check constraint would refuse a null confirmed_by anyway; failing
    // here says why, instead of surfacing a constraint name to an admin.
    throw new AliasCommitFailed("Not signed in, so there is nobody to record as having confirmed these.");
  }

  const { error } = await aliasTable()("clubhouse_player_alias").upsert(
    rows.map((r) => ({
      kind: r.kind,
      value: r.value,
      player_id: r.playerId,
      // Everything here came off a confirmation screen. The database refuses
      // an unverified engine alias outright (migration 006).
      verified: true,
      confirmed_by: userId,
    })),
    { onConflict: "kind,value" }
  );

  if (error) throw new AliasCommitFailed(`Could not save the name mappings: ${error.message}`);
  return rows.length;
}

/**
 * The roster, read as the ADMIN through the engine client.
 *
 * src/clubhouse/data/reads.ts has a fetchRoster() already, but it runs on the
 * clubhouse client, which on /manage holds no session at all — the admin is
 * signed in on "engine-auth". Migration 006 added is_engine_admin() to the
 * roster policy precisely so this read returns every member, hidden ones
 * included: a hidden player who cannot be offered as a candidate can never be
 * mapped, and would silently stop getting attendance.
 */
export async function fetchRosterAsAdmin(): Promise<{ playerId: string; displayName: string }[]> {
  const { data, error } = await aliasTable()("clubhouse_roster").select("player_id, display_name");
  if (error) throw new AliasCommitFailed(`Could not read the roster: ${error.message}`);
  return (data as unknown as { player_id: string; display_name: string }[] ?? [])
    .map((r) => ({ playerId: r.player_id, displayName: r.display_name }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
