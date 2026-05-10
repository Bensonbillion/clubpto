// ============================================================
// Set 01 / Courtside Social — Turso schema setup
// ============================================================
// Creates the tournament_state table in Turso (the operational DB) and seeds
// the row for tournament_id 'set01'. Run once before the tournament:
//
//   node scripts/init-set01-tournament.mjs
//
// Idempotent — safe to run multiple times.
// ============================================================

const FUNCTION_URL = "https://ikfbtktofcfkpqxwlfku.supabase.co/functions/v1/turso-proxy";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmJ0a3RvZmNma3BxeHdsZmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDcwNzksImV4cCI6MjA4MzkyMzA3OX0.95w2QWdpJeMz1ob7KgtU7SmJVl88Uf2_xioTkphw3-Y";

async function q(sql, params) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ sql, params: params || [] }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function main() {
  console.log("[set01] Creating tournament_state table in Turso…");

  await q(`
    CREATE TABLE IF NOT EXISTS tournament_state (
      id TEXT NOT NULL PRIMARY KEY,
      state TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )
  `);
  console.log("[set01] ✓ table ready");

  // Seed the set01 row if it doesn't exist
  const existing = await q("SELECT id FROM tournament_state WHERE id = ?", ["set01"]);
  if (!existing.rows || existing.rows.length === 0) {
    await q("INSERT INTO tournament_state (id, state) VALUES (?, ?)", ["set01", "{}"]);
    console.log("[set01] ✓ seeded set01 row");
  } else {
    console.log("[set01] ✓ set01 row already exists");
  }

  // Verify
  const verify = await q("SELECT id, length(state) as state_len, updated_at FROM tournament_state WHERE id = ?", [
    "set01",
  ]);
  console.log("[set01] verification:", verify.rows?.[0]);
  console.log("[set01] done.");
}

main().catch((err) => {
  console.error("[set01] FAILED:", err);
  process.exit(1);
});
