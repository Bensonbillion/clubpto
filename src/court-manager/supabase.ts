// Court Manager v3 — Supabase background sync (§13).
//
// localStorage stays the live source of truth; this adapter is the background
// mirror for cross-device RESUME and the roster. It writes to its OWN row
// ("cm_v3_session") in the game_state table — the legacy rows ("current",
// "open_current") are read-only here and never written.

import { supabase } from "@/integrations/supabase/client";
import type { Envelope, RemoteSync } from "./persistence";
import type { Player, Tier } from "./types";

const ROW_ID = "cm_v3_session";
const LEGACY_ROW_ID = "current";

export function supabaseRemote<T>(): RemoteSync<T> {
  return {
    async push(envelope) {
      const { error } = await supabase.from("game_state").upsert({
        id: ROW_ID,
        state: JSON.parse(JSON.stringify(envelope)),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    async pull() {
      const { data, error } = await supabase
        .from("game_state")
        .select("state")
        .eq("id", ROW_ID)
        .maybeSingle();
      if (error) throw error;
      return (data?.state as Envelope<T> | null) ?? null;
    },
  };
}

/**
 * READ-ONLY import of the classic manager's shared roster. Stable player IDs
 * are preserved (Architectural Law #2) so multi-week identity survives the
 * rebuild. Check-in state is NOT imported — check-in is per-night.
 */
export async function fetchClassicRoster(): Promise<Player[]> {
  const { data, error } = await supabase
    .from("game_state")
    .select("state")
    .eq("id", LEGACY_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  const roster: unknown[] = (data?.state as { roster?: unknown[] } | null)?.roster ?? [];
  const players: Player[] = [];
  for (const raw of roster) {
    const p = raw as { id?: unknown; name?: unknown; skillLevel?: unknown };
    if (!p?.id || !p?.name) continue;
    const tier: Tier = p.skillLevel === "A" || p.skillLevel === "B" || p.skillLevel === "C" ? p.skillLevel : "B";
    players.push({
      id: String(p.id),
      name: String(p.name),
      tier,
      isVip: false,
      isCoach: false,
      checkedIn: false,
    });
  }
  return players;
}
