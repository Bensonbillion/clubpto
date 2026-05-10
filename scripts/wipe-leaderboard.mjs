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
  // Step 1: Check what needs to be deleted
  const ledger = await q(
    "SELECT pl.id, pl.player_id, pl.points, pl.reason, pl.created_at, COALESCE(p.preferred_name, p.first_name) as name FROM points_ledger pl JOIN players p ON p.id = pl.player_id WHERE pl.created_at >= '2026-03-15T00:00:00' ORDER BY pl.created_at DESC"
  );

  console.log(`Found ${ledger.rows?.length || 0} ledger entries since Sunday 2026-03-15`);

  if (!ledger.rows || ledger.rows.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  // Aggregate by player
  const byPlayer = {};
  for (const r of ledger.rows) {
    if (!byPlayer[r.player_id]) {
      byPlayer[r.player_id] = { name: r.name, points: 0, wins: 0 };
    }
    byPlayer[r.player_id].points += Number(r.points);
    byPlayer[r.player_id].wins += 1;
  }

  console.log("\nPoints to remove per player:");
  for (const [id, p] of Object.entries(byPlayer)) {
    console.log(`  ${p.name}: ${p.points} pts, ${p.wins} wins`);
  }

  // Step 2: Delete ledger entries
  console.log("\nDeleting ledger entries...");
  const del = await q("DELETE FROM points_ledger WHERE created_at >= '2026-03-15T00:00:00'");
  console.log("Delete result:", JSON.stringify(del));

  // Step 3: Subtract points/wins from player totals
  console.log("\nUpdating player totals...");
  for (const [id, p] of Object.entries(byPlayer)) {
    const result = await q(
      "UPDATE players SET total_points = MAX(0, total_points - ?), total_wins = MAX(0, total_wins - ?) WHERE id = ?",
      [p.points, p.wins, id]
    );
    console.log(`  ${p.name}: -${p.points} pts, -${p.wins} wins`, result.rows !== undefined ? "OK" : JSON.stringify(result));
  }

  // Step 4: Verify
  console.log("\nVerifying...");
  const check = await q("SELECT COUNT(*) as cnt FROM points_ledger WHERE created_at >= '2026-03-15T00:00:00'");
  console.log(`Remaining entries since Sunday: ${check.rows[0].cnt}`);

  const topPlayers = await q("SELECT COALESCE(preferred_name, first_name) as name, total_points, total_wins FROM players WHERE total_points > 0 ORDER BY total_points DESC LIMIT 10");
  console.log("\nTop 10 leaderboard after cleanup:");
  for (const p of topPlayers.rows) {
    console.log(`  ${p.name}: ${p.total_points} pts, ${p.total_wins} wins`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
