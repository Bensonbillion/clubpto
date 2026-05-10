/**
 * Player CSV Import Script — with deduplication
 *
 * Dedup strategy:
 * 1. Within CSV: group by primary email (lowercased), keep the row with the
 *    longest/most-complete name (filters out abbreviations like "d Eze" vs "daisy Eze")
 * 2. Against DB: skip any row whose primary email already exists in players table
 *
 * Usage: node scripts/import-players.mjs [--dry-run]
 */

import { readFileSync } from "fs";
import { parse } from "path";

// ── Config ──────────────────────────────────────────────────
const FUNCTION_URL =
  "https://ikfbtktofcfkpqxwlfku.supabase.co/functions/v1/turso-proxy";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmJ0a3RvZmNma3BxeHdsZmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDcwNzksImV4cCI6MjA4MzkyMzA3OX0.95w2QWdpJeMz1ob7KgtU7SmJVl88Uf2_xioTkphw3-Y";
const DRY_RUN = process.argv.includes("--dry-run");

async function query(sql, params = []) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Turso proxy error: ${res.status}`);
  }
  return res.json();
}

// ── Parse CSV ───────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV fields
    const matches = [...lines[i].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    if (matches.length < 4) continue;
    const [firstName, lastName, phone, emailRaw] = matches;
    // Take first email if comma-separated
    const email = emailRaw.split(",")[0].trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    // Clean phone: remove leading '+
    const cleanPhone = phone.replace(/^'+/, "").replace(/[^\d+]/g, "");
    rows.push({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      phone: cleanPhone || null,
    });
  }
  return rows;
}

// ── Deduplicate within CSV ──────────────────────────────────
function deduplicateCSV(rows) {
  const byEmail = new Map();
  for (const row of rows) {
    const key = row.email;
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, row);
      continue;
    }
    // Keep the row with the longest first name (more complete, less abbreviated)
    // Also prefer rows with proper last names over single-char ones
    const existingScore =
      existing.firstName.replace(/[^a-zA-Z]/g, "").length +
      existing.lastName.replace(/[^a-zA-Z]/g, "").length;
    const newScore =
      row.firstName.replace(/[^a-zA-Z]/g, "").length +
      row.lastName.replace(/[^a-zA-Z]/g, "").length;
    if (newScore > existingScore) {
      byEmail.set(key, row);
    }
  }
  return Array.from(byEmail.values());
}

// ── Normalize name casing ───────────────────────────────────
function titleCase(s) {
  if (!s) return s;
  // Don't touch names that are intentionally styled (e.g., emojis)
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN — no inserts will be made\n" : "");

  // 1. Read CSV
  const csvText = readFileSync("data/list.csv", "utf-8");
  const csvRows = parseCSV(csvText);
  console.log(`CSV rows parsed: ${csvRows.length}`);

  // 2. Deduplicate within CSV
  const deduped = deduplicateCSV(csvRows);
  console.log(`After CSV dedup: ${deduped.length} unique emails`);
  console.log(
    `  Removed ${csvRows.length - deduped.length} duplicate rows within CSV\n`
  );

  // 3. Fetch existing players from DB
  const dbResult = await query(
    "SELECT email FROM players WHERE is_deleted = 0 AND email IS NOT NULL"
  );
  const existingEmails = new Set(
    dbResult.rows.map((r) => r.email?.toLowerCase()).filter(Boolean)
  );
  console.log(`Existing players in DB: ${existingEmails.size}`);

  // 4. Filter to truly new players
  const newPlayers = deduped.filter((p) => !existingEmails.has(p.email));
  console.log(`New players to insert: ${newPlayers.length}\n`);

  if (newPlayers.length === 0) {
    console.log("✅ No new players to add — database is up to date.");
    return;
  }

  // Show what we'll insert
  console.log("Players to add:");
  console.log("─".repeat(60));
  for (const p of newPlayers) {
    console.log(
      `  ${titleCase(p.firstName)} ${titleCase(p.lastName)} — ${p.email}`
    );
  }
  console.log("─".repeat(60));

  if (DRY_RUN) {
    console.log("\n🔍 Dry run complete. Re-run without --dry-run to insert.");
    return;
  }

  // 5. Insert new players
  let inserted = 0;
  let skipped = 0;
  for (const p of newPlayers) {
    const fn = titleCase(p.firstName);
    const ln = titleCase(p.lastName);
    try {
      await query(
        `INSERT INTO players (first_name, last_name, email, phone, tier, is_deleted, total_points, total_wins)
         VALUES (?, ?, ?, ?, 'C', 0, 0, 0)`,
        [fn, ln, p.email, p.phone]
      );
      inserted++;
      console.log(`  ✅ ${fn} ${ln}`);
    } catch (err) {
      // Likely unique constraint on email — skip
      skipped++;
      console.log(`  ⚠️  Skipped ${fn} ${ln}: ${err.message}`);
    }
  }

  console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch(console.error);
