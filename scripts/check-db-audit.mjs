const FUNCTION_URL = 'https://ikfbtktofcfkpqxwlfku.supabase.co/functions/v1/turso-proxy';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmJ0a3RvZmNma3BxeHdsZmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDcwNzksImV4cCI6MjA4MzkyMzA3OX0.95w2QWdpJeMz1ob7KgtU7SmJVl88Uf2_xioTkphw3-Y';

async function q(sql, params) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ sql, params: params || [] }),
  });
  return res.json();
}

async function main() {
  // 1. Schema info
  for (const table of ['players', 'points_ledger', 'pair_history', 'sessions', 'bookings']) {
    const schema = await q(`PRAGMA table_info(${table})`);
    if (schema.rows) {
      console.log(`\n${table} columns:`, schema.rows.map(r => r.name).join(', '));
    } else {
      console.log(`\n${table}: could not read schema`, JSON.stringify(schema).slice(0, 200));
    }
  }

  // 2. Check players modified in last 2 weeks
  console.log("\n\n=== Players created/updated in last 2 weeks ===");
  const recentPlayers = await q("SELECT id, first_name, preferred_name, created_at, total_points, total_wins FROM players WHERE created_at >= '2026-03-05' ORDER BY created_at DESC");
  if (recentPlayers.rows) {
    for (const p of recentPlayers.rows) {
      console.log(`  ${p.preferred_name || p.first_name}: created ${p.created_at}, pts=${p.total_points}, wins=${p.total_wins}`);
    }
    console.log(`Total: ${recentPlayers.rows.length} players`);
  }

  // 3. Check points_ledger activity in last 2 weeks (after our wipe, should only be pre-Sunday)
  console.log("\n=== Points ledger entries in last 2 weeks ===");
  const recentLedger = await q("SELECT pl.created_at, pl.points, pl.reason, COALESCE(p.preferred_name, p.first_name) as name FROM points_ledger pl JOIN players p ON p.id = pl.player_id WHERE pl.created_at >= '2026-03-05' ORDER BY pl.created_at DESC LIMIT 20");
  if (recentLedger.rows) {
    for (const r of recentLedger.rows) {
      console.log(`  ${r.created_at} | ${r.name} | ${r.points} pts | ${r.reason}`);
    }
    console.log(`Showing first 20 of total entries`);
  }

  // 4. Check pair_history
  console.log("\n=== Pair history in last 2 weeks ===");
  const recentPH = await q("SELECT * FROM pair_history WHERE session_date >= '2026-03-05' ORDER BY session_date DESC LIMIT 20");
  if (recentPH.rows) {
    for (const r of recentPH.rows) {
      console.log(`  ${r.session_date} | ${r.player1_name} + ${r.player2_name}`);
    }
    console.log(`Showing first 20`);
  }

  // 5. Check Supabase game_state (this is in Supabase, not Turso)
  console.log("\n=== Note ===");
  console.log("The Turso DB (points_ledger, players, pair_history) has no built-in audit trail.");
  console.log("There are no 'updated_by', 'modified_by', or IP columns in any table.");
  console.log("All writes go through the same Supabase Edge Function (turso-proxy) with the anon key.");
  console.log("There is no way to distinguish WHO made a change — only WHEN it happened.");
}

main().catch(console.error);
