const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@libsql/client');

const turso = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
});

async function query(sql, params = []) {
  return await turso.execute({ sql, args: params });
}

// Normalize header names: "First Name" → "first_name", "Email" → "email", etc.
function normalizeHeaders(record) {
  const mapped = {};
  for (const [key, value] of Object.entries(record)) {
    const normalized = key.trim().toLowerCase().replace(/\s+/g, '_');
    mapped[normalized] = value;
  }
  return mapped;
}

// Clean phone: strip quotes, apostrophes, leading '+
function cleanPhone(raw) {
  if (!raw) return null;
  return raw.replace(/^['"]+/g, '').replace(/['"]+$/g, '').trim() || null;
}

// Clean email: take first email if comma-separated, lowercase, trim
function cleanEmail(raw) {
  if (!raw) return null;
  const first = raw.split(',')[0].trim().toLowerCase();
  return first || null;
}

async function importPlayers(csvFilePath) {
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');

  const rawRecords = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const records = rawRecords.map(normalizeHeaders);

  console.log(`Found ${records.length} rows in CSV\n`);

  let success = 0;
  let duplicates = 0;
  let failed = 0;

  for (const row of records) {
    try {
      const firstName = (row.first_name || '').trim();
      const lastName = (row.last_name || '').trim();

      if (!firstName || !lastName) {
        console.log(`❌ Skipping — missing name: ${JSON.stringify(row)}`);
        failed++;
        continue;
      }

      const email = cleanEmail(row.email);
      const phone = cleanPhone(row.phone);
      const preferredName = (row.preferred_name || '').trim() || null;

      // Check if player exists by email (if provided)
      if (email) {
        const existing = await query(
          'SELECT id, is_deleted FROM players WHERE email = ? LIMIT 1',
          [email]
        );

        if (existing.rows.length > 0) {
          const player = existing.rows[0];
          if (!player.is_deleted) {
            console.log(`⚠️  Duplicate: ${email} (${firstName} ${lastName})`);
            duplicates++;
            continue;
          }

          // Restore soft-deleted player
          await query(
            'UPDATE players SET first_name = ?, last_name = ?, preferred_name = ?, phone = ?, is_deleted = 0, deleted_at = NULL WHERE id = ?',
            [firstName, lastName, preferredName, phone, player.id]
          );
          console.log(`✅ Restored: ${firstName} ${lastName}`);
          success++;
          continue;
        }
      }

      // Create new player
      await query(
        'INSERT INTO players (first_name, last_name, preferred_name, email, phone) VALUES (?, ?, ?, ?, ?)',
        [firstName, lastName, preferredName, email, phone]
      );
      console.log(`✅ Created: ${firstName} ${lastName}`);
      success++;
    } catch (error) {
      console.log(`❌ Error with ${row.first_name} ${row.last_name}: ${error.message}`);
      failed++;
    }
  }

  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`✅ Success: ${success}`);
  console.log(`⚠️  Duplicates: ${duplicates}`);
  console.log(`❌ Failed: ${failed}`);
}

const csvPath = process.argv[2] || './players.csv';
if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  console.log('\nUsage: node scripts/import-players.js [path/to/players.csv]');
  console.log('\nCSV format:');
  console.log('first_name,last_name,preferred_name,email,phone');
  console.log('John,Smith,Johnny,john@example.com,416-555-0101');
  process.exit(1);
}

importPlayers(csvPath)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
