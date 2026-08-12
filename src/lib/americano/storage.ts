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
// v3: AmericanoSession gained the required `players` array (Step 3). Any
// schema-shape change MUST bump this so migrate() runs — a version-2 envelope
// without `players` would otherwise load unmigrated and crash the render.
// v4: migrate structurally HEALS the two court pools — an envelope with a
// missing/empty pools array previously loaded "valid", every added player
// went unassigned, and canStart was vacuously true over zero pools.
export const AMERICANO_SCHEMA_VERSION = 4;

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

function emptyPool(id: string, label: "Court 1" | "Court 2"): AmericanoPool {
  return {
    id, label, playerIds: [], targetMatches: 4, playoffMode: "undecided",
    status: "setup", matches: [],
  };
}

function migrate(oldState: unknown): AmericanoSession | null {
  if (typeof oldState !== "object" || oldState === null) return null;
  const old = oldState as Partial<AmericanoSession>;
  // Recognizably v4-shaped state survives version bumps; anything else
  // (including the pre-spec prototype shape) starts fresh.
  if (!Array.isArray(old.pools) || old.pools.some((p) => !Array.isArray(p?.matches))) return null;
  const players = Array.isArray(old.players) ? old.players : [];

  // STRUCTURAL HEAL: the session must always carry exactly the two courts.
  // An envelope with a missing court (or an empty pools array) once loaded as
  // "valid" — every added player went unassigned and START was vacuously
  // enabled over zero pools. Rebuild whichever court is absent and re-seat
  // any orphaned player by the split rule (C → Court 1, A/B → Court 2).
  const oldPools = old.pools as AmericanoPool[];
  const court2 = oldPools.find((p) => p.id === "court-2") ?? emptyPool("court-2", "Court 2");
  const court1 = oldPools.find((p) => p.id === "court-1") ?? emptyPool("court-1", "Court 1");
  const assigned = new Set([...court2.playerIds, ...court1.playerIds]);
  const orphans2: string[] = [];
  const orphans1: string[] = [];
  for (const p of players) {
    if (!assigned.has(p.playerId)) (p.tier === "C" ? orphans1 : orphans2).push(p.playerId);
  }
  const pools: AmericanoPool[] = [
    { ...court2, playerIds: [...court2.playerIds, ...orphans2] },
    { ...court1, playerIds: [...court1.playerIds, ...orphans1] },
  ];
  const date = typeof old.date === "string" && old.date ? old.date : new Date().toISOString().slice(0, 10);
  return { ...old, date, id: old.id || `night-${date}`, players, pools } as AmericanoSession;
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
