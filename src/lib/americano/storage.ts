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

export const AMERICANO_STORAGE_KEY = "cm_v4_session";
export const AMERICANO_ROW_ID = "cm_v4_session";
export const AMERICANO_SCHEMA_VERSION = 2;

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
      return (data?.state as Envelope<AmericanoSession> | null) ?? null;
    },
  };
}

function migrate(oldState: unknown): AmericanoSession | null {
  if (typeof oldState !== "object" || oldState === null) return null;
  const old = oldState as Partial<AmericanoSession>;
  // Recognizably v4-shaped state survives version bumps; anything else
  // (including the pre-spec prototype shape) starts fresh.
  if (!Array.isArray(old.pools) || old.pools.some((p) => !Array.isArray(p?.matches))) return null;
  return old as AmericanoSession;
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
    migrate,
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
    This module never writes it. */
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
