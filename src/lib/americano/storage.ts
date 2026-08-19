// PTO Americano v4 — persistence (STEP 1, brief §9 "kept").
//
// The EXISTING Court Manager pattern, reused rather than reinvented: the
// generic localStorage-first store from src/court-manager/persistence.ts —
// synchronous local write on every change, Supabase background sync, load
// order localStorage → Supabase → defaults. Americano state lives under its
// OWN key and its OWN game_state row; the pairs-based system's state and the
// shared roster are never written by this module.

import { supabase } from "@/integrations/supabase/client";
import {
  createSessionStore,
  type Envelope,
  type RemoteSync,
  type SessionStore,
  type SyncStatus,
} from "@/court-manager/persistence";
import type { AmericanoSession, AmericanoTier } from "@/types/americano";
import { AMERICANO_SCHEMA_VERSION, migrateAmericanoSession } from "./migrate";
import { clubToday } from "@/lib/clubDate";

export const AMERICANO_STORAGE_KEY = "cm_v4_session";
export const AMERICANO_ROW_ID = "cm_v4_session";
// The schema version + all healing live in ./migrate (pure, fixture-guarded
// by __tests__/schema.test.ts — shape and version move together, always).
export { AMERICANO_SCHEMA_VERSION };

export type { SessionStore, SyncStatus };

function americanoRemote(): RemoteSync<AmericanoSession> {
  return {
    async push(envelope) {
      const { error } = await supabase.from("game_state").upsert({
        id: AMERICANO_ROW_ID,
        state: JSON.parse(JSON.stringify(envelope)),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    async pull() {
      const { data, error } = await supabase
        .from("game_state")
        .select("state")
        .eq("id", AMERICANO_ROW_ID)
        .maybeSingle();
      if (error) throw error;
      return (data?.state as unknown as Envelope<AmericanoSession> | null) ?? null;
    },
  };
}

export interface AmericanoStoreConfig {
  defaults: () => AmericanoSession;
  onSyncStatusChange?: (status: SyncStatus) => void;
}

/**
 * The night's store. save() on every state change; load() is the
 * resumeSession() path — any device picks up the last synced state.
 */
export function createAmericanoStore(config: AmericanoStoreConfig): SessionStore<AmericanoSession> {
  return createSessionStore<AmericanoSession>({
    storageKey: AMERICANO_STORAGE_KEY,
    schemaVersion: AMERICANO_SCHEMA_VERSION,
    storage: window.localStorage,
    remote: americanoRemote(),
    defaults: config.defaults,
    // Toronto, not UTC (C6) — see src/lib/clubDate.ts.
    migrate: (oldState) => migrateAmericanoSession(oldState, clubToday()),
    onSyncStatusChange: config.onSyncStatusChange,
  });
}

/* ── shared roster (READ-ONLY) ───────────────────────────────────── */

export interface SharedRosterEntry {
  playerId: string;
  displayName: string;
  lastName?: string;
  tier: AmericanoTier;
}

const ROSTER_ROW_ID = "cm_v3_session";

/** Names + hidden tiers with stable ids, read from the shared roster row.
    Reads freely; the ONLY write this module ever performs on it is the
    quick-add APPEND below — existing rows are never mutated. */
export async function fetchSharedRoster(): Promise<SharedRosterEntry[]> {
  const { data, error } = await supabase
    .from("game_state")
    .select("state")
    .eq("id", ROSTER_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  const raw =
    (data?.state as { state?: { players?: unknown[] } } | null)?.state?.players ?? [];
  const out: SharedRosterEntry[] = [];
  for (const entry of raw) {
    const p = entry as { id?: unknown; name?: unknown; lastName?: unknown; tier?: unknown };
    if (typeof p?.id !== "string" || typeof p?.name !== "string") continue;
    out.push({
      playerId: p.id,
      displayName: p.name,
      lastName: typeof p.lastName === "string" && p.lastName ? p.lastName : undefined,
      tier: p.tier === "A" || p.tier === "B" || p.tier === "C" ? p.tier : "B",
    });
  }
  return out;
}

/**
 * Quick-add (STEP 3): INSERT a brand-new player into the shared roster —
 * append-only. The row is read, the new entry appended with a fresh stable
 * id, and written back; every existing entry passes through byte-untouched.
 */
export async function appendSharedRosterEntry(
  displayName: string,
  tier: AmericanoTier,
): Promise<SharedRosterEntry> {
  const name = displayName.trim();
  if (!name) throw new Error("A name is required.");
  const { data, error } = await supabase
    .from("game_state")
    .select("state")
    .eq("id", ROSTER_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  const envelope = (data?.state ?? { state: { players: [] } }) as {
    state?: { players?: unknown[] };
  };
  const players = envelope.state?.players ?? [];
  const entry = { id: `plv4-${Date.now().toString(36)}-${players.length}`, name, tier };
  const nextEnvelope = {
    ...envelope,
    state: { ...(envelope.state ?? {}), players: [...players, entry] },
  };
  const { error: writeError } = await supabase.from("game_state").upsert({
    id: ROSTER_ROW_ID,
    state: JSON.parse(JSON.stringify(nextEnvelope)),
    updated_at: new Date().toISOString(),
  });
  if (writeError) throw writeError;
  return { playerId: entry.id, displayName: name, tier };
}
