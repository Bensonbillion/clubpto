// Clubhouse Supabase client — points at BENSON'S OWN project
// ("CLUB PTO" org, project flahcijysipymafazhxq), NOT the Lovable-managed
// engine project. Deliberate architecture (2026-08-26): the clubhouse
// (auth, published data, member identity) lives in a database the club
// fully controls; Court Manager keeps its own project. PIPE-1's isolation
// is enforced by literal project separation.
//
// The publishable key is safe to ship in the browser by design (RLS
// guards every table; see src/clubhouse/migrations/001_clubhouse.sql).
import { createClient } from "@supabase/supabase-js";

const CLUBHOUSE_URL = "https://flahcijysipymafazhxq.supabase.co";
const CLUBHOUSE_PUBLISHABLE_KEY = "sb_publishable_A_qnd2YHwLgEXHtJZ7yghQ_VgW3vKaq";

export const clubhouse = createClient(CLUBHOUSE_URL, CLUBHOUSE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    // Distinct storage key: the engine's client owns the default slot.
    storageKey: "clubhouse-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});
