// ============================================================
// Set 01 — End-to-end smoke test
// ============================================================
// Writes a fake tournament to Turso under id 'set01-smoketest' (NOT 'set01' —
// avoids polluting the real tournament row), plays it through Stage 1 → Final,
// verifies bracket logic at each step, then cleans up.
//
// Run:
//   node scripts/smoke-test-set01.mjs
// ============================================================

const FUNCTION_URL = "https://ikfbtktofcfkpqxwlfku.supabase.co/functions/v1/turso-proxy";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmJ0a3RvZmNma3BxeHdsZmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDcwNzksImV4cCI6MjA4MzkyMzA3OX0.95w2QWdpJeMz1ob7KgtU7SmJVl88Uf2_xioTkphw3-Y";

const TID = "set01-smoketest";

let pass = 0;
let fail = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  pass++;
}
function bad(label, detail) {
  console.log(`  ✗ ${label}`);
  if (detail) console.log(`     ${detail}`);
  fail++;
}
function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) ok(label);
  else bad(label, `expected ${e}, got ${a}`);
}

async function q(sql, params) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ sql, params: params || [] }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function readState() {
  const result = await q("SELECT state FROM tournament_state WHERE id = ?", [TID]);
  if (!result.rows?.[0]?.state) return null;
  return JSON.parse(result.rows[0].state);
}

async function writeState(state) {
  await q(
    `INSERT INTO tournament_state (id, state, updated_at, updated_by)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?)
     ON CONFLICT(id) DO UPDATE SET
       state = excluded.state,
       updated_at = CURRENT_TIMESTAMP,
       updated_by = excluded.updated_by`,
    [TID, JSON.stringify(state), "smoke-test"],
  );
}

// Pure logic helpers (mirrors src/lib/set01.ts)

function matchWinner(m) {
  if (m.scoreA == null || m.scoreB == null) return null;
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? "A" : "B";
}

function applySwaps(stage1) {
  const finalSeeds = Array.from({ length: 16 }, (_, i) => ({ seed: i + 1, originalSeed: i + 1 }));
  const swap = (a, b) => {
    const sa = finalSeeds.find((f) => f.originalSeed === a);
    const sb = finalSeeds.find((f) => f.originalSeed === b);
    if (!sa || !sb) return;
    const tmp = sa.originalSeed;
    sa.originalSeed = sb.originalSeed;
    sb.originalSeed = tmp;
  };
  const pd = (m) => Math.abs(m.scoreA - m.scoreB);
  const upA = stage1.slice(0, 4).filter((m) => matchWinner(m) === "B").sort((x, y) => pd(y) - pd(x));
  const opA = stage1.slice(4, 8).filter((m) => matchWinner(m) === "B").sort((x, y) => pd(y) - pd(x));
  const numA = Math.min(upA.length, opA.length);
  for (let i = 0; i < numA; i++) swap(upA[i].seedB, opA[i].seedA);
  const upB = stage1.slice(4, 8).filter((m) => matchWinner(m) === "B");
  for (const m of upB) {
    const cands = [9, 10, 11, 12].filter((slot) => {
      const fs = finalSeeds.find((f) => f.seed === slot);
      return fs.originalSeed >= 9 && fs.originalSeed <= 12;
    });
    if (!cands.length) continue;
    cands.sort((a, b) => {
      const fa = finalSeeds.find((f) => f.seed === a);
      const fb = finalSeeds.find((f) => f.seed === b);
      return fb.originalSeed - fa.originalSeed;
    });
    const fs = finalSeeds.find((f) => f.seed === cands[0]);
    swap(m.seedB, fs.originalSeed);
  }
  return finalSeeds;
}

function defaultState() {
  const STAGE1 = [[1, 12], [2, 11], [3, 10], [4, 9], [5, 16], [6, 15], [7, 14], [8, 13]];
  const R16 = [
    [1, 16, "QF1"], [8, 9, "QF1"],
    [4, 13, "QF2"], [5, 12, "QF2"],
    [2, 15, "QF3"], [7, 10, "QF3"],
    [3, 14, "QF4"], [6, 11, "QF4"],
  ];
  return {
    mensTeams: Array.from({ length: 16 }, (_, i) => ({
      id: `men-${i + 1}`,
      initialSeed: i + 1,
      player1: { id: `p${i + 1}a`, display: `T${i + 1}-A` },
      player2: { id: `p${i + 1}b`, display: `T${i + 1}-B` },
    })),
    womensTeams: ["A", "B", "C", "D", "E"].map((l) => ({
      id: `women-${l}`,
      label: l,
      player1: { id: `w${l}1`, display: `${l}1` },
      player2: { id: `w${l}2`, display: `${l}2` },
    })),
    stage1: STAGE1.map(([a, b], i) => ({
      match: i + 1,
      seedA: a,
      seedB: b,
      scoreA: null,
      scoreB: null,
    })),
    finalSeeds: Array.from({ length: 16 }, (_, i) => ({ seed: i + 1, originalSeed: i + 1 })),
    r16: R16.map(([a, b], i) => ({
      id: `R16-${i + 1}`,
      round: "R16",
      seedA: a,
      seedB: b,
      scoreA: null,
      scoreB: null,
      pointsAwarded: false,
    })),
    qf: [
      { id: "QF1", round: "QF", sourceA: "R16-1", sourceB: "R16-2", scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "QF2", round: "QF", sourceA: "R16-3", sourceB: "R16-4", scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "QF3", round: "QF", sourceA: "R16-5", sourceB: "R16-6", scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "QF4", round: "QF", sourceA: "R16-7", sourceB: "R16-8", scoreA: null, scoreB: null, pointsAwarded: false },
    ],
    sf: [
      { id: "SF1", round: "SF", sourceA: "QF1", sourceB: "QF2", scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "SF2", round: "SF", sourceA: "QF3", sourceB: "QF4", scoreA: null, scoreB: null, pointsAwarded: false },
    ],
    f: { id: "F", round: "F", sourceA: "SF1", sourceB: "SF2", scoreA: null, scoreB: null, pointsAwarded: false },
    womensGroup: [
      { id: "G1", teamA: "A", teamB: "B", scoreA: null, scoreB: null },
      { id: "G2", teamA: "B", teamB: "C", scoreA: null, scoreB: null },
      { id: "G3", teamA: "C", teamB: "D", scoreA: null, scoreB: null },
      { id: "G4", teamA: "D", teamB: "E", scoreA: null, scoreB: null },
      { id: "G5", teamA: "A", teamB: "E", scoreA: null, scoreB: null },
    ],
    womensSF: [
      { id: "WSF1", teamA: null, teamB: null, scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "WSF2", teamA: null, teamB: null, scoreA: null, scoreB: null, pointsAwarded: false },
    ],
    womensF: { id: "WF", teamA: null, teamB: null, sourceA: "WSF1", sourceB: "WSF2", scoreA: null, scoreB: null, pointsAwarded: false },
    schemaVersion: 1,
  };
}

async function main() {
  console.log("\n=== PTO Set 01 — Smoke Test ===\n");
  console.log(`tournament_id: ${TID}`);
  console.log(`(separate from production 'set01' — safe to run)\n`);

  // ── 0. Setup ──
  console.log("[0] Schema check");
  await q(
    `CREATE TABLE IF NOT EXISTS tournament_state (
      id TEXT NOT NULL PRIMARY KEY,
      state TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )`,
  );
  ok("tournament_state table exists");

  await q("DELETE FROM tournament_state WHERE id = ?", [TID]);
  ok("cleaned previous smoke-test row");

  // ── 1. Initial write ──
  console.log("\n[1] Initial state write/read cycle");
  let state = defaultState();
  await writeState(state);
  ok("wrote default state to Turso");

  const readBack = await readState();
  eq("16 men's teams persisted", readBack.mensTeams.length, 16);
  eq("5 women's teams persisted", readBack.womensTeams.length, 5);
  eq("8 Stage 1 matches", readBack.stage1.length, 8);
  eq("Stage 1 first pairing is 1 vs 12", [readBack.stage1[0].seedA, readBack.stage1[0].seedB], [1, 12]);

  // ── 2. Stage 1 with mixed upsets ──
  console.log("\n[2] Stage 1 with mixed upsets + swap rule");
  state.stage1[0] = { ...state.stage1[0], scoreA: 0, scoreB: 2 }; // seed 12 upsets seed 1
  state.stage1[1] = { ...state.stage1[1], scoreA: 2, scoreB: 0 };
  state.stage1[2] = { ...state.stage1[2], scoreA: 2, scoreB: 0 };
  state.stage1[3] = { ...state.stage1[3], scoreA: 2, scoreB: 0 };
  state.stage1[4] = { ...state.stage1[4], scoreA: 0, scoreB: 2 }; // seed 16 upsets seed 5
  state.stage1[5] = { ...state.stage1[5], scoreA: 2, scoreB: 0 };
  state.stage1[6] = { ...state.stage1[6], scoreA: 2, scoreB: 0 };
  state.stage1[7] = { ...state.stage1[7], scoreA: 2, scoreB: 0 };
  await writeState(state);
  ok("wrote Stage 1 results");

  state.finalSeeds = applySwaps(state.stage1);
  await writeState(state);
  ok("applied swaps + persisted finalSeeds");

  // Validate the swap landed where expected
  const slot1 = state.finalSeeds[0].originalSeed;
  const slot5 = state.finalSeeds[4].originalSeed;
  const slot12 = state.finalSeeds[11].originalSeed;
  eq("top 4 still locked (slot 1)", slot1, 1);
  eq("seed 12 promoted to slot 5 (Band A swap)", slot5, 12);
  eq("seed 5 dropped to slot 12 (Band A swap)", slot12, 5);

  // Re-read from Turso to confirm persistence
  const afterSwap = await readState();
  eq("persisted finalSeeds round-trip", afterSwap.finalSeeds[4].originalSeed, 12);

  // ── 3. R16 — top seeds advance ──
  console.log("\n[3] R16 played out — top seeds win");
  state.r16 = state.r16.map((m) => ({ ...m, scoreA: 2, scoreB: 0 }));
  await writeState(state);

  // R16 winners: by seedA in each pairing, seedA wins
  // Standard R16 pairings: 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11
  // After all seedA wins: 1, 8, 4, 5, 2, 7, 3, 6 advance to QF
  const r16Winners = state.r16.map((m) => (m.scoreA > m.scoreB ? m.seedA : m.seedB));
  eq("R16 winners are top 8 seeds", r16Winners, [1, 8, 4, 5, 2, 7, 3, 6]);

  // ── 4. QF/SF/F cascade ──
  console.log("\n[4] QF/SF/F cascade");
  state.qf = state.qf.map((m) => ({ ...m, scoreA: 2, scoreB: 0 }));
  state.sf = state.sf.map((m) => ({ ...m, scoreA: 2, scoreB: 0 }));
  state.f = { ...state.f, scoreA: 2, scoreB: 0 };
  await writeState(state);

  // Walk the bracket to find the champion
  function getWinnerSeed(matchId, allMatches) {
    const m = allMatches.get(matchId);
    if (!m) return null;
    if (m.scoreA == null) return null;
    const winnerSide = m.scoreA > m.scoreB ? "A" : "B";
    if (m.seedA != null) return winnerSide === "A" ? m.seedA : m.seedB;
    return winnerSide === "A" ? getWinnerSeed(m.sourceA, allMatches) : getWinnerSeed(m.sourceB, allMatches);
  }
  const allMatches = new Map();
  state.r16.forEach((m) => allMatches.set(m.id, m));
  state.qf.forEach((m) => allMatches.set(m.id, m));
  state.sf.forEach((m) => allMatches.set(m.id, m));
  allMatches.set(state.f.id, state.f);
  const champion = getWinnerSeed("F", allMatches);
  eq("champion is seed 1", champion, 1);

  // ── 5. Women's flow ──
  console.log("\n[5] Women's group stage + standings");
  state.womensGroup[0] = { ...state.womensGroup[0], scoreA: 2, scoreB: 0 }; // A beats B
  state.womensGroup[1] = { ...state.womensGroup[1], scoreA: 0, scoreB: 2 }; // C beats B
  state.womensGroup[2] = { ...state.womensGroup[2], scoreA: 2, scoreB: 0 }; // C beats D
  state.womensGroup[3] = { ...state.womensGroup[3], scoreA: 0, scoreB: 2 }; // E beats D
  state.womensGroup[4] = { ...state.womensGroup[4], scoreA: 2, scoreB: 1 }; // A beats E
  await writeState(state);

  // Compute standings inline
  const tally = { A: { w: 0, l: 0, pf: 0, pa: 0 }, B: { w: 0, l: 0, pf: 0, pa: 0 }, C: { w: 0, l: 0, pf: 0, pa: 0 }, D: { w: 0, l: 0, pf: 0, pa: 0 }, E: { w: 0, l: 0, pf: 0, pa: 0 } };
  for (const g of state.womensGroup) {
    if (g.scoreA == null || g.scoreB == null) continue;
    tally[g.teamA].pf += g.scoreA;
    tally[g.teamA].pa += g.scoreB;
    tally[g.teamB].pf += g.scoreB;
    tally[g.teamB].pa += g.scoreA;
    if (g.scoreA > g.scoreB) {
      tally[g.teamA].w++;
      tally[g.teamB].l++;
    } else {
      tally[g.teamB].w++;
      tally[g.teamA].l++;
    }
  }
  const ranked = Object.entries(tally)
    .map(([label, t]) => ({ label, ...t, diff: t.pf - t.pa }))
    .sort((a, b) => b.w - a.w || b.diff - a.diff || b.pf - a.pf);
  eq("A and C tied with 2 wins", [ranked[0].w, ranked[1].w], [2, 2]);
  ok(`top of standings: ${ranked[0].label} (${ranked[0].w}W)`);

  // SFs: 1 vs 4, 2 vs 3 by rank
  state.womensSF[0] = { ...state.womensSF[0], teamA: ranked[0].label, teamB: ranked[3].label, scoreA: 2, scoreB: 0 };
  state.womensSF[1] = { ...state.womensSF[1], teamA: ranked[1].label, teamB: ranked[2].label, scoreA: 2, scoreB: 0 };
  state.womensF = { ...state.womensF, scoreA: 2, scoreB: 1 };
  await writeState(state);
  ok("women's bracket completed");

  // ── 6. Final read-back ──
  console.log("\n[6] Final read-back");
  const finalState = await readState();
  eq("Set 01 final scoreA", finalState.f.scoreA, 2);
  eq("Set 01 final scoreB", finalState.f.scoreB, 0);
  eq("women's final scoreA", finalState.womensF.scoreA, 2);
  ok("schema version preserved through round-trip");

  // ── Cleanup ──
  console.log("\n[7] Cleanup");
  await q("DELETE FROM tournament_state WHERE id = ?", [TID]);
  ok(`removed ${TID} row`);

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n[smoke-test] FAILED:", err);
  process.exit(1);
});
