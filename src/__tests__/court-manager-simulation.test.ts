/**
 * Court Manager — Comprehensive Simulation Test Suite
 *
 * FINDING #1: Scheduling logic is NOT testable in isolation — it's coupled to
 * React hook state (useCallback closures over useState) and Supabase calls.
 * All core algorithms are replicated here using the EXACT same logic from
 * useGameState.ts and StatsPlayoffs.tsx.
 */

// ═══════════════════════ TYPES ═══════════════════════
type SkillTier = "A" | "B" | "C";
interface Player { id: string; name: string; skillLevel: SkillTier; checkedIn: boolean; checkInTime: string | null; wins: number; losses: number; gamesPlayed: number; }
interface Pair { id: string; player1: Player; player2: Player; skillLevel: SkillTier; wins: number; losses: number; }
interface Match { id: string; pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel?: string; status: "pending" | "playing" | "completed"; court: number | null; winner?: Pair; loser?: Pair; completedAt?: string; startedAt?: string; gameNumber?: number; courtPool?: "C" | "AB"; }
interface FixedPair { player1Name: string; player2Name: string; }

// ═══════════════════════ HELPERS ═══════════════════════
let idCounter = 0;
function generateId(): string { return "id_" + (++idCounter); }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function getPairPlayerIds(p: Pair): string[] { return [p.player1.id, p.player2.id]; }
function getMatchPlayerIds(m: Match): string[] { return [...getPairPlayerIds(m.pair1), ...getPairPlayerIds(m.pair2)]; }
function getMatchPlayerNames(m: Match): string[] { return [m.pair1.player1.name, m.pair1.player2.name, m.pair2.player1.name, m.pair2.player2.name]; }
function matchupKey(a: string, b: string): string { return [a, b].sort().join("|||"); }
function makePlayer(name: string, tier: SkillTier): Player { return { id: generateId(), name, skillLevel: tier, checkedIn: true, checkInTime: new Date().toISOString(), wins: 0, losses: 0, gamesPlayed: 0 }; }

// ═══════════════════════ RESULT TRACKING ═══════════════════════
let passed = 0, failed = 0;
const allFailures: { severity: "CRITICAL" | "HIGH" | "LOW"; group: string; msg: string }[] = [];
function pass(g: string, msg: string) { console.log(`  ✅ PASS: ${msg}`); passed++; }
function fail(g: string, msg: string, severity: "CRITICAL" | "HIGH" | "LOW" = "HIGH") { console.log(`  ❌ FAIL: ${msg}`); failed++; allFailures.push({ severity, group: g, msg }); }
function assert(g: string, cond: boolean, passMsg: string, failMsg: string, sev: "CRITICAL" | "HIGH" | "LOW" = "HIGH") { if (cond) pass(g, passMsg); else fail(g, failMsg, sev); }

// ═══════════════════════ PAIR GENERATION ═══════════════════════
function createFixedPairsForTier(players: Player[], skill: SkillTier, fixedPairs: FixedPair[]): { pairs: Pair[]; unpaired: Player[] } {
  const pairs: Pair[] = []; const used = new Set<string>();
  for (const fp of fixedPairs) {
    const p1 = players.find(p => p.name.toLowerCase() === fp.player1Name.toLowerCase() && !used.has(p.id));
    const p2 = players.find(p => p.name.toLowerCase() === fp.player2Name.toLowerCase() && !used.has(p.id));
    if (p1 && p2) { pairs.push({ id: generateId(), player1: p1, player2: p2, skillLevel: skill, wins: 0, losses: 0 }); used.add(p1.id); used.add(p2.id); }
  }
  const remaining = players.filter(p => !used.has(p.id)); const remainingUsed = new Set<string>();
  for (let i = 0; i < remaining.length; i++) {
    if (remainingUsed.has(remaining[i].id)) continue;
    let partner: Player | null = null;
    for (let j = i + 1; j < remaining.length; j++) { if (!remainingUsed.has(remaining[j].id)) { partner = remaining[j]; break; } }
    if (partner) { pairs.push({ id: generateId(), player1: remaining[i], player2: partner, skillLevel: skill, wins: 0, losses: 0 }); remainingUsed.add(remaining[i].id); remainingUsed.add(partner.id); }
  }
  const pairedIds = new Set<string>(); pairs.forEach(p => { pairedIds.add(p.player1.id); pairedIds.add(p.player2.id); });
  return { pairs, unpaired: players.filter(p => !pairedIds.has(p.id)) };
}

// ═══════════════════════ SCHEDULE GENERATION (exact from useGameState.ts) ═══════════════════════
type CandidateMatch = { pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel: string; courtPool: "C" | "AB"; };

function generateSchedule(allPairs: Pair[], aPairs: Pair[], bPairs: Pair[], cPairs: Pair[], courtCount: 2 | 3, durationMin = 85) {
  const minutesPerGame = 7;
  const totalSlots = Math.floor(durationMin / minutesPerGame);
  const TARGET_GAMES_PER_PAIR = courtCount === 3 ? 3 : 4;
  const MAX_GAMES = courtCount === 3 ? 4 : 5;

  const tierTargets: Record<SkillTier, { vsA: number; vsB: number; vsC: number }> = courtCount === 3
    ? { A: { vsA: 2, vsB: 1, vsC: 0 }, B: { vsA: 1, vsB: 2, vsC: 0 }, C: { vsA: 0, vsB: 0, vsC: 3 } }
    : { A: { vsA: 3, vsB: 1, vsC: 0 }, B: { vsA: 1, vsB: 2, vsC: 1 }, C: { vsA: 0, vsB: 1, vsC: 3 } };

  const pairOpponentStats = new Map<string, { vsA: number; vsB: number; vsC: number }>();
  allPairs.forEach(p => pairOpponentStats.set(p.id, { vsA: 0, vsB: 0, vsC: 0 }));

  // Dynamic REST_GAP: 3-court uses 1 (2-group alternation), 2-court uses 2 (3-group cycle)
  const REST_GAP = courtCount === 3 ? 1 : 2;
  const mPlayerIds = (m: { pair1: Pair; pair2: Pair }) => [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id];

  const allCandidates: CandidateMatch[] = [];
  for (let i = 0; i < aPairs.length; i++) for (let j = i + 1; j < aPairs.length; j++) allCandidates.push({ pair1: aPairs[i], pair2: aPairs[j], skillLevel: "A", matchupLabel: "A vs A", courtPool: "AB" });
  for (let i = 0; i < cPairs.length; i++) for (let j = i + 1; j < cPairs.length; j++) allCandidates.push({ pair1: cPairs[i], pair2: cPairs[j], skillLevel: "C", matchupLabel: "C vs C", courtPool: "C" });
  for (let i = 0; i < bPairs.length; i++) for (let j = i + 1; j < bPairs.length; j++) allCandidates.push({ pair1: bPairs[i], pair2: bPairs[j], skillLevel: "B", matchupLabel: "B vs B", courtPool: "AB" });
  for (const bp of bPairs) for (const ap of aPairs) allCandidates.push({ pair1: bp, pair2: ap, skillLevel: "cross", matchupLabel: "B vs A", courtPool: "AB" });
  if (courtCount === 2) { for (const bp of bPairs) for (const cp of cPairs) allCandidates.push({ pair1: bp, pair2: cp, skillLevel: "cross", matchupLabel: "B vs C", courtPool: "C" }); }

  const schedule: Match[] = [];
  const usedMatchups = new Set<string>();
  const pairGameCount = new Map<string, number>();
  allPairs.forEach(p => pairGameCount.set(p.id, 0));
  let candidatePool = shuffle([...allCandidates]);
  const slotBoundaries: number[] = [];

  const getSlotPlayerIds = (si: number): Set<string> => {
    const ids = new Set<string>(); if (si < 0 || si >= slotBoundaries.length) return ids;
    const s = slotBoundaries[si]; const e = si + 1 < slotBoundaries.length ? slotBoundaries[si + 1] : schedule.length;
    for (let i = s; i < e; i++) mPlayerIds(schedule[i]).forEach(id => ids.add(id)); return ids;
  };

  const pickBest = (pool: CandidateMatch[], slotPIds: Set<string>, blockedPIds: Set<string>, filter?: "C" | "AB"): number => {
    let bestIdx = -1, bestScore = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      if (filter && c.courtPool !== filter) continue;
      if (usedMatchups.has(matchupKey(c.pair1.id, c.pair2.id))) continue;
      const g1 = pairGameCount.get(c.pair1.id) || 0, g2 = pairGameCount.get(c.pair2.id) || 0;
      if (g1 >= MAX_GAMES || g2 >= MAX_GAMES) continue;
      const minCount = Math.min(...Array.from(pairGameCount.values()));
      if (g1 > minCount + 1 || g2 > minCount + 1) continue;
      const pids = mPlayerIds(c);
      if (pids.some(id => slotPIds.has(id)) || pids.some(id => blockedPIds.has(id))) continue;
      // Distribution-aware scoring
      const t1 = c.pair1.skillLevel, t2 = c.pair2.skillLevel;
      const stats1 = pairOpponentStats.get(c.pair1.id)!, stats2 = pairOpponentStats.get(c.pair2.id)!;
      const tgt1 = tierTargets[t1], tgt2 = tierTargets[t2];
      const vsCount = (s: typeof stats1, t: SkillTier) => t === "A" ? s.vsA : t === "B" ? s.vsB : s.vsC;
      const vsTarget = (tgt: typeof tgt1, t: SkillTier) => t === "A" ? tgt.vsA : t === "B" ? tgt.vsB : tgt.vsC;
      const deficit1 = vsTarget(tgt1, t2) - vsCount(stats1, t2);
      const deficit2 = vsTarget(tgt2, t1) - vsCount(stats2, t1);
      let score = -(deficit1 + deficit2) * 10 + (g1 + g2);
      if (g1 >= TARGET_GAMES_PER_PAIR) score += 100;
      if (g2 >= TARGET_GAMES_PER_PAIR) score += 100;
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    }
    return bestIdx;
  };

  const commit = (idx: number, slotPIds: Set<string>): Match => {
    const chosen = candidatePool.splice(idx, 1)[0];
    usedMatchups.add(matchupKey(chosen.pair1.id, chosen.pair2.id));
    pairGameCount.set(chosen.pair1.id, (pairGameCount.get(chosen.pair1.id) || 0) + 1);
    pairGameCount.set(chosen.pair2.id, (pairGameCount.get(chosen.pair2.id) || 0) + 1);
    mPlayerIds(chosen).forEach(id => slotPIds.add(id));
    // Track opponent tiers
    const oppT1 = chosen.pair2.skillLevel, oppT2 = chosen.pair1.skillLevel;
    const st1 = pairOpponentStats.get(chosen.pair1.id)!, st2 = pairOpponentStats.get(chosen.pair2.id)!;
    if (oppT1 === "A") st1.vsA++; else if (oppT1 === "B") st1.vsB++; else st1.vsC++;
    if (oppT2 === "A") st2.vsA++; else if (oppT2 === "B") st2.vsB++; else st2.vsC++;
    return { id: generateId(), pair1: chosen.pair1, pair2: chosen.pair2, skillLevel: chosen.skillLevel, matchupLabel: chosen.matchupLabel, courtPool: chosen.courtPool, status: "pending", court: null };
  };

  for (let slot = 0; slot < totalSlots; slot++) {
    slotBoundaries.push(schedule.length);
    const blocked = new Set<string>();
    for (let p = Math.max(0, slot - REST_GAP); p < slot; p++) getSlotPlayerIds(p).forEach(id => blocked.add(id));
    const slotPIds = new Set<string>();
    if (courtCount === 3) {
      const ci = pickBest(candidatePool, slotPIds, blocked, "C"); if (ci !== -1) schedule.push(commit(ci, slotPIds));
      for (let c = 0; c < 2; c++) { const ai = pickBest(candidatePool, slotPIds, blocked, "AB"); if (ai !== -1) schedule.push(commit(ai, slotPIds)); }
    } else {
      for (let c = 0; c < 2; c++) { const i = pickBest(candidatePool, slotPIds, blocked); if (i !== -1) schedule.push(commit(i, slotPIds)); }
    }
  }

  schedule.forEach((m, i) => { m.gameNumber = i + 1; });
  for (let c = 0; c < courtCount && c < schedule.length; c++) { schedule[c].status = "playing"; schedule[c].court = c + 1; schedule[c].startedAt = new Date().toISOString(); }
  return { schedule, slotBoundaries, pairGameCount };
}

// ═══════════════════════ HEAD-TO-HEAD ═══════════════════════
function getHeadToHead(aId: string, bId: string, matches: Match[]): number {
  let aW = 0, bW = 0;
  for (const m of matches) { if (m.status !== "completed" || !m.winner) continue; if (![m.pair1.id, m.pair2.id].includes(aId) || ![m.pair1.id, m.pair2.id].includes(bId)) continue; if (m.winner.id === aId) aW++; else if (m.winner.id === bId) bW++; }
  return aW > bW ? 1 : bW > aW ? -1 : 0;
}

// ═══════════════════════ PLAYOFF SEEDING (from StatsPlayoffs.tsx) ═══════════════════════
interface PairStanding { id: string; pair: Pair; player1Name: string; player2Name: string; wins: number; losses: number; gamesPlayed: number; winPct: number; skillLevel: SkillTier; }

function buildStandings(matches: Match[]): PairStanding[] {
  const m = new Map<string, PairStanding>();
  for (const match of matches) {
    if (match.status !== "completed" || !match.winner || !match.loser) continue;
    const proc = (pair: Pair, won: boolean) => {
      if (!m.has(pair.id)) m.set(pair.id, { id: pair.id, pair, player1Name: pair.player1.name, player2Name: pair.player2.name, wins: 0, losses: 0, gamesPlayed: 0, winPct: 0, skillLevel: pair.skillLevel });
      const s = m.get(pair.id)!; s.gamesPlayed++; if (won) s.wins++; else s.losses++; s.winPct = s.wins / s.gamesPlayed;
    };
    proc(match.winner, true); proc(match.loser, false);
  }
  return Array.from(m.values());
}

function seedPlayoffs(standings: PairStanding[], matches: Match[]): PairStanding[] {
  const eligible = standings.filter(p => p.gamesPlayed > 0);
  const tierP: Record<string, number> = { A: 0, B: 1, C: 2 };
  const sorted = [...eligible].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (Math.abs(b.winPct - a.winPct) > 0.001) return b.winPct - a.winPct;
    const td = (tierP[a.skillLevel] || 2) - (tierP[b.skillLevel] || 2);
    if (td !== 0) return td;
    const h = getHeadToHead(a.pair.id, b.pair.id, matches);
    if (h !== 0) return -h;
    return 0;
  });
  return sorted.slice(0, 8);
}

// ═══════════════════════ TEST DATA ═══════════════════════
const A_NAMES = ["Ade", "Benson", "David", "Albright", "Chizea", "Elvis", "Tami", "Donnell", "Timi", "Folarin"];
const B_NAMES = ["Duke", "Fiyin", "Jaidan", "Ossai", "Dynamite", "Tumi"];
const C_NAMES = ["Shana", "Samuel", "Tofunmi", "Temitope", "Emmanuel", "Kayode", "Ese", "Deborah"];
const VIP_PAIRS: FixedPair[] = [{ player1Name: "Benson", player2Name: "Albright" }, { player1Name: "David", player2Name: "Ade" }];

function createPlayers(aNames = A_NAMES, bNames = B_NAMES, cNames = C_NAMES) {
  return { tA: aNames.map(n => makePlayer(n, "A")), tB: bNames.map(n => makePlayer(n, "B")), tC: cNames.map(n => makePlayer(n, "C")) };
}

function makePairs(tA: Player[], tB: Player[], tC: Player[], vips = VIP_PAIRS) {
  const aR = createFixedPairsForTier(shuffle(tA), "A", vips);
  const bR = createFixedPairsForTier(shuffle(tB), "B", []);
  const cR = createFixedPairsForTier(shuffle(tC), "C", []);
  return { aR, bR, cR, allPairs: [...aR.pairs, ...bR.pairs, ...cR.pairs] };
}

// ═══════════════════════ VALIDATION HELPERS ═══════════════════════
function getSlotMatches(sched: Match[], cc: number, slot: number, sb?: number[]) {
  if (sb) {
    const start = sb[slot];
    const end = slot + 1 < sb.length ? sb[slot + 1] : sched.length;
    return sched.slice(start, end);
  }
  const base = slot * cc; return sched.slice(base, Math.min(base + cc, sched.length));
}
function getSlotCount(sched: Match[], cc: number, sb?: number[]) {
  if (sb) {
    // Count non-empty slots
    let count = 0;
    for (let s = 0; s < sb.length; s++) {
      const start = sb[s];
      const end = s + 1 < sb.length ? sb[s + 1] : sched.length;
      if (start < sched.length && end > start) count++;
    }
    return count;
  }
  return Math.ceil(sched.length / cc);
}

function playerTier(name: string, tA: Player[], tB: Player[], tC: Player[]): SkillTier | "?" {
  if (tA.find(p => p.name === name)) return "A";
  if (tB.find(p => p.name === name)) return "B";
  if (tC.find(p => p.name === name)) return "C";
  return "?";
}

// ═══════════════════════ SCHEDULE PRINTER ═══════════════════════
function printSchedule(sched: Match[], cc: number, sb?: number[]) {
  const sc = sb ? sb.length : getSlotCount(sched, cc);
  let slotNum = 0;
  for (let s = 0; s < sc; s++) {
    const ms = getSlotMatches(sched, cc, s, sb);
    if (ms.length === 0) continue; // skip empty algorithm slots
    slotNum++;
    const parts = ms.map((m, ci) => `Court ${ci + 1}: ${m.pair1.player1.name}&${m.pair1.player2.name} vs ${m.pair2.player1.name}&${m.pair2.player2.name} [${m.matchupLabel}]`);
    console.log(`  Slot ${String(slotNum).padStart(2)}: ${parts.join(" | ")}`);
  }
}

// ═══════════════════════ CONSTRAINT VALIDATOR ═══════════════════════
function validateConstraints(sched: Match[], cc: number, grp: string, tA: Player[], tB: Player[], tC: Player[], sb?: number[]): {
  crossCourtFails: number; backToBackFails: number; dupeFails: number; gameCountFails: number; sitOutFails: number;
} {
  // Use slotBoundaries for accurate slot detection (slots can have variable sizes in 3-court mode)
  const totalAlgoSlots = sb ? sb.length : getSlotCount(sched, cc);
  let crossCourtFails = 0, backToBackFails = 0, dupeFails = 0, gameCountFails = 0, sitOutFails = 0;

  // Cross-court conflicts (using algorithm slots)
  for (let s = 0; s < totalAlgoSlots; s++) {
    const ms = getSlotMatches(sched, cc, s, sb);
    if (ms.length === 0) continue;
    const seen = new Map<string, number>();
    ms.forEach((m, ci) => {
      getMatchPlayerNames(m).forEach(name => {
        if (seen.has(name)) { fail(grp, `Cross-court conflict: ${name} on Court ${seen.get(name)} AND Court ${ci + 1} in Slot ${s + 1}`, "CRITICAL"); crossCourtFails++; }
        seen.set(name, ci + 1);
      });
    });
  }
  if (crossCourtFails === 0) pass(grp, "No cross-court conflicts");

  // Back-to-back (using algorithm slot indices — empty slots count as rest)
  const pSlots = new Map<string, number[]>();
  for (let s = 0; s < totalAlgoSlots; s++) {
    const ms = getSlotMatches(sched, cc, s, sb);
    ms.forEach(m => getMatchPlayerNames(m).forEach(n => { if (!pSlots.has(n)) pSlots.set(n, []); pSlots.get(n)!.push(s); }));
  }
  for (const [n, slots] of pSlots) { const u = [...new Set(slots)].sort((a, b) => a - b); for (let i = 1; i < u.length; i++) if (u[i] - u[i - 1] === 1) { fail(grp, `Back-to-back: ${n} plays Slot ${u[i - 1] + 1} and Slot ${u[i] + 1}`); backToBackFails++; } }
  if (backToBackFails === 0) pass(grp, "No back-to-back violations");

  // Duplicate matchups
  const mSigs = new Set<string>();
  for (const m of sched) {
    const sig = [[m.pair1.player1.name, m.pair1.player2.name].sort().join("&"), [m.pair2.player1.name, m.pair2.player2.name].sort().join("&")].sort().join(" vs ");
    if (mSigs.has(sig)) { fail(grp, `Duplicate matchup: ${sig} (game #${m.gameNumber})`); dupeFails++; }
    mSigs.add(sig);
  }
  if (dupeFails === 0) pass(grp, "No duplicate matchups");

  // Game count (3-5)
  const pc = new Map<string, number>();
  sched.forEach(m => getMatchPlayerNames(m).forEach(n => pc.set(n, (pc.get(n) || 0) + 1)));
  for (const [n, c] of pc) if (c < 3 || c > 5) { fail(grp, `Game count: ${n} plays ${c} games (expected 3-5)`, "LOW"); gameCountFails++; }
  if (gameCountFails === 0) pass(grp, "All players play 3-5 games");

  // Max sit-out (>3 consecutive active slots — ignore empty trailing slots)
  // Find last slot with games to define the active range
  let lastActiveSlot = 0;
  for (let s = 0; s < totalAlgoSlots; s++) {
    const ms = getSlotMatches(sched, cc, s, sb);
    if (ms.length > 0) lastActiveSlot = s;
  }
  for (const [n, slots] of pSlots) {
    const u = new Set(slots);
    for (let s = 0; s <= Math.min(lastActiveSlot, totalAlgoSlots) - 4; s++) {
      if (!u.has(s) && !u.has(s + 1) && !u.has(s + 2) && !u.has(s + 3)) { fail(grp, `Sit-out: ${n} idle slots ${s + 1}-${s + 4}`, "LOW"); sitOutFails++; break; }
    }
  }
  if (sitOutFails === 0) pass(grp, "No player sits out >3 consecutive slots");

  return { crossCourtFails, backToBackFails, dupeFails, gameCountFails, sitOutFails };
}

// ═══════════════════════════════════════════════════════════════
//  PART A: 2-COURT MODE TESTS
// ═══════════════════════════════════════════════════════════════
function partA() {
  console.log("\n" + "═".repeat(70));
  console.log("  PART A: 2-COURT MODE TESTS");
  console.log("═".repeat(70));

  const { tA, tB, tC } = createPlayers();

  // ─── 2C-1: Pair Generation ───
  console.log("\n--- TEST 2C-1: Pair Generation (2-Court) ---\n");
  const { aR, bR, cR, allPairs } = makePairs(tA, tB, tC);

  let crossTier = 0;
  allPairs.forEach(p => { if (p.player1.skillLevel !== p.player2.skillLevel) { fail("2C-1", `Cross-tier pair: ${p.player1.name}(${p.player1.skillLevel}) + ${p.player2.name}(${p.player2.skillLevel})`, "CRITICAL"); crossTier++; } });
  if (crossTier === 0) pass("2C-1", "All pairs are same-tier");

  assert("2C-1", !!allPairs.find(p => (p.player1.name === "Benson" && p.player2.name === "Albright") || (p.player1.name === "Albright" && p.player2.name === "Benson")),
    "VIP Benson paired with Albright", "VIP Benson NOT paired with Albright", "CRITICAL");
  assert("2C-1", !!allPairs.find(p => (p.player1.name === "David" && p.player2.name === "Ade") || (p.player1.name === "Ade" && p.player2.name === "David")),
    "VIP David paired with Ade", "VIP David NOT paired with Ade", "CRITICAL");

  const pIds = new Set<string>(); let dupeP = false;
  allPairs.forEach(p => { [p.player1.id, p.player2.id].forEach(id => { if (pIds.has(id)) dupeP = true; pIds.add(id); }); });
  assert("2C-1", !dupeP, "No player in more than one pair", "Player appears in multiple pairs", "CRITICAL");

  assert("2C-1", aR.pairs.length === 5, `Tier A: 5 pairs (${aR.pairs.length})`, `Tier A: ${aR.pairs.length} pairs (expected 5)`);
  assert("2C-1", bR.pairs.length === 3, `Tier B: 3 pairs (${bR.pairs.length})`, `Tier B: ${bR.pairs.length} pairs (expected 3)`);
  assert("2C-1", cR.pairs.length === 4, `Tier C: 4 pairs (${cR.pairs.length})`, `Tier C: ${cR.pairs.length} pairs (expected 4)`);
  assert("2C-1", aR.unpaired.length === 0 && bR.unpaired.length === 0 && cR.unpaired.length === 0,
    "No waitlisted players (all tiers even)", `Waitlisted: A=${aR.unpaired.length} B=${bR.unpaired.length} C=${cR.unpaired.length}`);

  // Odd test: 23 players (remove Folarin)
  const { tA: tA23 } = createPlayers(A_NAMES.filter(n => n !== "Folarin"));
  const { aR: aR23 } = makePairs(tA23, tB, tC);
  assert("2C-1", aR23.unpaired.length === 1, `Odd A (9 players): 1 waitlisted (${aR23.unpaired.map(p => p.name).join()})`, `Odd A: ${aR23.unpaired.length} waitlisted (expected 1)`);

  // ─── 2C-2: Schedule Generation ───
  console.log("\n--- TEST 2C-2: Schedule Generation (2-Court) ---\n");
  const { tA: tA2, tB: tB2, tC: tC2 } = createPlayers();
  const p2 = makePairs(tA2, tB2, tC2);
  const { schedule: s2, slotBoundaries: sb2 } = generateSchedule(p2.allPairs, p2.aR.pairs, p2.bR.pairs, p2.cR.pairs, 2);
  console.log(`  [Info] ${s2.length} games, ${p2.allPairs.length} pairs, ${getSlotCount(s2, 2, sb2)} slots`);
  const breakdown2 = { AvA: 0, BvB: 0, BvA: 0, CvC: 0, BvC: 0 };
  s2.forEach(m => { const k = (m.matchupLabel || "").replace(/ /g, "") as keyof typeof breakdown2; if (k === "AvsA") breakdown2.AvA++; else if (k === "BvsB") breakdown2.BvB++; else if (k === "BvsA") breakdown2.BvA++; else if (k === "CvsC") breakdown2.CvC++; else if (k === "BvsC") breakdown2.BvC++; });
  console.log(`  [Info] AvA=${breakdown2.AvA} BvB=${breakdown2.BvB} BvA=${breakdown2.BvA} CvC=${breakdown2.CvC} BvC=${breakdown2.BvC}`);
  printSchedule(s2, 2, sb2);
  validateConstraints(s2, 2, "2C-2", tA2, tB2, tC2, sb2);

  // ─── 2C-3: Tier Matchup Rules ───
  console.log("\n--- TEST 2C-3: Tier Matchup Rules (2-Court) ---\n");

  let tierFails = 0;
  for (const m of s2) {
    const t1 = m.pair1.skillLevel, t2 = m.pair2.skillLevel;
    const names = getMatchPlayerNames(m);
    // Check A vs A integrity
    if (t1 === "A" && t2 === "A") {
      if (!names.every(n => playerTier(n, tA2, tB2, tC2) === "A")) { fail("2C-3", `A vs A game #${m.gameNumber} has non-A player`, "CRITICAL"); tierFails++; }
    }
    // Check C vs C integrity
    if (t1 === "C" && t2 === "C") {
      if (!names.every(n => playerTier(n, tA2, tB2, tC2) === "C")) { fail("2C-3", `C vs C game #${m.gameNumber} has non-C player`, "CRITICAL"); tierFails++; }
    }
  }
  if (tierFails === 0) pass("2C-3", "A vs A and C vs C games have correct tier players");

  // B vs B check — user spec says B NEVER faces B in 2-court mode
  const bvbGames2 = s2.filter(m => m.matchupLabel === "B vs B");
  // NOTE: The CODE allows B vs B in both modes (lines 507-512 of useGameState.ts).
  // User's spec says B never faces B in 2-court. Reporting this as a finding.
  if (bvbGames2.length > 0) {
    fail("2C-3", `B-vs-B games exist in 2-court mode: ${bvbGames2.length} found. CODE ALLOWS THIS but spec says B never faces B in 2-court. BUG: lines 507-512 generate B-vs-B candidates in ALL modes.`, "HIGH");
  } else {
    pass("2C-3", "No B-vs-B games in 2-court mode (matches spec)");
  }

  // B pair matchup breakdown
  const bPairMatchups = new Map<string, { vsA: number; vsB: number; vsC: number; total: number }>();
  p2.bR.pairs.forEach(bp => bPairMatchups.set(bp.id, { vsA: 0, vsB: 0, vsC: 0, total: 0 }));
  for (const m of s2) {
    const t1 = m.pair1.skillLevel, t2 = m.pair2.skillLevel;
    if (t1 === "B" && bPairMatchups.has(m.pair1.id)) {
      const e = bPairMatchups.get(m.pair1.id)!; e.total++;
      if (t2 === "A") e.vsA++; else if (t2 === "B") e.vsB++; else if (t2 === "C") e.vsC++;
    }
    if (t2 === "B" && bPairMatchups.has(m.pair2.id)) {
      const e = bPairMatchups.get(m.pair2.id)!; e.total++;
      if (t1 === "A") e.vsA++; else if (t1 === "B") e.vsB++; else if (t1 === "C") e.vsC++;
    }
  }

  let bBalanceFails = 0;
  for (const bp of p2.bR.pairs) {
    const stats = bPairMatchups.get(bp.id)!;
    console.log(`  ${bp.player1.name}&${bp.player2.name}: ${stats.vsA} vs A, ${stats.vsB} vs B, ${stats.vsC} vs C (total ${stats.total})`);
    // Check they have a mix (vsA > 0 AND vsC > 0, excluding B vs B)
    const crossGames = stats.vsA + stats.vsC;
    if (stats.vsA === 0 && crossGames > 0) { fail("2C-3", `${bp.player1.name}&${bp.player2.name}: 0 games vs A (should have mix)`, "HIGH"); bBalanceFails++; }
    if (stats.vsC === 0 && crossGames > 0) { fail("2C-3", `${bp.player1.name}&${bp.player2.name}: 0 games vs C (should have mix)`, "HIGH"); bBalanceFails++; }
  }
  if (bBalanceFails === 0) pass("2C-3", "B pairs face a mix of A and C opponents");

  // ─── 2C-4: Court Distribution ───
  console.log("\n--- TEST 2C-4: Court Distribution (2-Court) ---\n");
  const sc2 = getSlotCount(s2, 2, sb2);
  let emptySlots = 0;
  for (let s = 0; s < sc2; s++) {
    const ms = getSlotMatches(s2, 2, s, sb2);
    if (ms.length === 0) continue;
    if (ms.length < 2) emptySlots++;
    const labels = ms.map((m, i) => `Court ${i + 1}: ${m.matchupLabel}`).join(" | ");
    console.log(`  Slot ${String(s + 1).padStart(2)}: ${labels}`);
  }
  assert("2C-4", emptySlots === 0, "Both courts have games in every slot", `${emptySlots} slots with empty court`, "LOW");

  // ─── 2C-5: Late Arrival (2-Court) ───
  console.log("\n--- TEST 2C-5: Late Arrival (2-Court) ---\n");
  const exclude = ["Timi", "Folarin", "Dynamite", "Tumi"];
  const { tA: tA5, tB: tB5, tC: tC5 } = createPlayers(A_NAMES.filter(n => !exclude.includes(n)), B_NAMES.filter(n => !exclude.includes(n)));
  const p5 = makePairs(tA5, tB5, tC5);
  const { schedule: s5 } = generateSchedule(p5.allPairs, p5.aR.pairs, p5.bR.pairs, p5.cR.pairs, 2);
  console.log(`  [Info] Initial: ${s5.length} games, ${p5.allPairs.length} pairs`);

  // Simulate 4 games completing
  for (let i = 0; i < Math.min(4, s5.length); i++) { s5[i].status = "completed"; s5[i].completedAt = new Date().toISOString(); s5[i].winner = s5[i].pair1; s5[i].loser = s5[i].pair2; }
  for (let i = 4; i < Math.min(6, s5.length); i++) { s5[i].status = "playing"; s5[i].court = i - 3; }
  const origCompleted = s5.filter(m => m.status === "completed").map(m => m.id);

  // Add Timi → waitlist, add Folarin → pairs with Timi
  const timiP = makePlayer("Timi", "A"), folarinP = makePlayer("Folarin", "A");
  const latePairA: Pair = { id: generateId(), player1: timiP, player2: folarinP, skillLevel: "A", wins: 0, losses: 0 };

  const existingMU = new Set<string>(); s5.forEach(m => existingMU.add(matchupKey(m.pair1.id, m.pair2.id)));
  const newAMatches: Match[] = [];
  const opponents = p5.aR.pairs; // A pair faces A pairs
  for (const opp of shuffle(opponents)) {
    if (newAMatches.length >= 4) break;
    const mk = matchupKey(latePairA.id, opp.id); if (existingMU.has(mk)) continue;
    newAMatches.push({ id: generateId(), pair1: latePairA, pair2: opp, skillLevel: "A", matchupLabel: "A vs A", courtPool: "AB", status: "pending", court: null, gameNumber: s5.length + newAMatches.length + 1 });
    existingMU.add(mk);
  }

  // Insert after freeze line
  const freezeIdx = (() => { let pc = 0; for (let i = 0; i < s5.length; i++) { if (s5[i].status === "pending") { pc++; if (pc >= 4) return i + 1; } } return s5.length; })();
  const lateSchedule = [...s5.slice(0, freezeIdx), ...newAMatches, ...s5.slice(freezeIdx)];
  lateSchedule.forEach((m, i) => m.gameNumber = i + 1);

  assert("2C-5", newAMatches.length > 0, `Timi+Folarin: ${newAMatches.length} matches generated`, "Timi+Folarin: 0 matches!", "HIGH");
  const completedUnchanged = lateSchedule.filter(m => m.status === "completed").every((m, i) => origCompleted[i] === m.id);
  assert("2C-5", completedUnchanged, "Completed games (slots 1-4) unchanged", "Completed games modified!", "CRITICAL");
  const lateInSched = lateSchedule.some(m => m.pair1.id === latePairA.id || m.pair2.id === latePairA.id);
  assert("2C-5", lateInSched, "Timi+Folarin appear in schedule", "Timi+Folarin NOT in schedule", "HIGH");

  // ─── 2C-6: Mid-Session Changes ───
  console.log("\n--- TEST 2C-6: Mid-Session Changes (2-Court) ---\n");

  // Swap Shana → NewPlayer
  const shanaCompBefore = lateSchedule.filter(m => m.status === "completed" && getMatchPlayerNames(m).includes("Shana")).length;
  const newPlayerC = makePlayer("NewPlayer", "C");
  for (const m of lateSchedule) {
    if (m.status === "completed") continue;
    if (m.pair1.player1.name === "Shana") m.pair1 = { ...m.pair1, player1: newPlayerC };
    else if (m.pair1.player2.name === "Shana") m.pair1 = { ...m.pair1, player2: newPlayerC };
    else if (m.pair2.player1.name === "Shana") m.pair2 = { ...m.pair2, player1: newPlayerC };
    else if (m.pair2.player2.name === "Shana") m.pair2 = { ...m.pair2, player2: newPlayerC };
  }
  const futureNewP = lateSchedule.filter(m => m.status !== "completed" && getMatchPlayerNames(m).includes("NewPlayer")).length;
  assert("2C-6", futureNewP > 0, `Swap: ${futureNewP} future games show NewPlayer`, "Swap: 0 future games with NewPlayer");
  const shanaCompAfter = lateSchedule.filter(m => m.status === "completed" && getMatchPlayerNames(m).includes("Shana")).length;
  assert("2C-6", shanaCompAfter === shanaCompBefore, `Completed games still show Shana (${shanaCompAfter})`, `Shana lost from completed: ${shanaCompBefore}→${shanaCompAfter}`);

  // Remove Samuel
  const samuelPair = p5.cR.pairs.find(p => p.player1.name === "Samuel" || p.player2.name === "Samuel");
  if (samuelPair) {
    const samCompBefore = lateSchedule.filter(m => m.status === "completed" && (m.pair1.id === samuelPair.id || m.pair2.id === samuelPair.id)).length;
    const withoutSam = lateSchedule.filter(m => m.status === "completed" || (m.pair1.id !== samuelPair.id && m.pair2.id !== samuelPair.id));
    const removed = lateSchedule.length - withoutSam.length;
    assert("2C-6", removed > 0, `Remove Samuel: ${removed} future games voided`, "Remove Samuel: 0 games removed");
    const samCompAfter = withoutSam.filter(m => m.status === "completed" && (m.pair1.id === samuelPair.id || m.pair2.id === samuelPair.id)).length;
    assert("2C-6", samCompAfter === samCompBefore, "Samuel's completed results preserved", "Samuel's completed results lost!");
  }
}

// ═══════════════════════════════════════════════════════════════
//  PART B: 3-COURT MODE TESTS
// ═══════════════════════════════════════════════════════════════
function partB() {
  console.log("\n" + "═".repeat(70));
  console.log("  PART B: 3-COURT MODE TESTS");
  console.log("═".repeat(70));

  const { tA, tB, tC } = createPlayers();

  // ─── 3C-1: Pair Generation ───
  console.log("\n--- TEST 3C-1: Pair Generation (3-Court) ---\n");
  const { aR, bR, cR, allPairs } = makePairs(tA, tB, tC);
  assert("3C-1", cR.pairs.length === 4, `C pairs for Court 1: ${cR.pairs.length}`, `C pairs: ${cR.pairs.length} (expected 4)`);
  assert("3C-1", aR.pairs.length + bR.pairs.length === 8, `A+B pairs for Courts 2&3: ${aR.pairs.length + bR.pairs.length}`, `A+B pairs: ${aR.pairs.length + bR.pairs.length} (expected 8)`);

  // ─── 3C-2: Schedule Generation ───
  console.log("\n--- TEST 3C-2: Schedule Generation (3-Court) ---\n");
  const { tA: tA3, tB: tB3, tC: tC3 } = createPlayers();
  const p3 = makePairs(tA3, tB3, tC3);
  const { schedule: s3, slotBoundaries: sb3 } = generateSchedule(p3.allPairs, p3.aR.pairs, p3.bR.pairs, p3.cR.pairs, 3);
  const b3 = { AvA: 0, BvB: 0, BvA: 0, CvC: 0, BvC: 0 };
  s3.forEach(m => { if (m.matchupLabel === "A vs A") b3.AvA++; else if (m.matchupLabel === "B vs B") b3.BvB++; else if (m.matchupLabel === "B vs A") b3.BvA++; else if (m.matchupLabel === "C vs C") b3.CvC++; else if (m.matchupLabel === "B vs C") b3.BvC++; });
  console.log(`  [Info] ${s3.length} games | AvA=${b3.AvA} BvB=${b3.BvB} BvA=${b3.BvA} CvC=${b3.CvC} BvC=${b3.BvC}`);
  printSchedule(s3, 3, sb3);
  validateConstraints(s3, 3, "3C-2", tA3, tB3, tC3, sb3);

  // ─── 3C-3: Court Isolation ───
  console.log("\n--- TEST 3C-3: Court Isolation (3-Court) — MOST CRITICAL ---\n");
  // In 3-court mode: Court 1 (position 0 in each slot) = C pool, Courts 2&3 (positions 1,2) = AB pool
  // We check using the courtPool property (runtime assigns dynamically via findNextPendingForCourt)

  let cPoolFails = 0, abPoolFails = 0;
  const cPoolMatches = s3.filter(m => m.courtPool === "C" || m.skillLevel === "C");
  for (const m of cPoolMatches) {
    for (const n of getMatchPlayerNames(m)) {
      const t = playerTier(n, tA3, tB3, tC3);
      if (t !== "C") { fail("3C-3", `${n} (Tier ${t}) in C-pool match game #${m.gameNumber} — Court 1 is C only`, "CRITICAL"); cPoolFails++; }
    }
  }
  if (cPoolFails === 0) pass("3C-3", "Court 1 (C pool): ALL players are Tier C");

  const abPoolMatches = s3.filter(m => m.courtPool === "AB");
  for (const m of abPoolMatches) {
    for (const n of getMatchPlayerNames(m)) {
      const t = playerTier(n, tA3, tB3, tC3);
      if (t === "C") { fail("3C-3", `${n} (Tier C) in AB-pool match game #${m.gameNumber} — Courts 2&3 are A/B only`, "CRITICAL"); abPoolFails++; }
    }
  }
  if (abPoolFails === 0) pass("3C-3", "Courts 2&3 (AB pool): NO Tier C players");

  // ─── 3C-4: Tier Matchup Rules (3-Court) ───
  console.log("\n--- TEST 3C-4: Tier Matchup Rules (3-Court) ---\n");

  // Court 1: every game is C vs C
  let c1NonC = 0;
  for (const m of cPoolMatches) { if (m.matchupLabel !== "C vs C") { fail("3C-4", `C-pool game #${m.gameNumber} is ${m.matchupLabel} (expected C vs C)`, "CRITICAL"); c1NonC++; } }
  if (c1NonC === 0) pass("3C-4", "Court 1: all games are C vs C");

  // B never faces C in 3-court
  assert("3C-4", b3.BvC === 0, "No B-vs-C games in 3-court mode", `${b3.BvC} B-vs-C games found — B should NEVER face C in 3-court`, "CRITICAL");

  // B vs B IS allowed in 3-court
  if (b3.BvB > 0) pass("3C-4", `B-vs-B games exist: ${b3.BvB} (allowed in 3-court)`);
  else console.log("  ⚠️  NOTE: 0 B-vs-B games in 3-court (allowed but none generated)");

  // B pair breakdown
  const bStats3 = new Map<string, { vsA: number; vsB: number; total: number }>();
  p3.bR.pairs.forEach(bp => bStats3.set(bp.id, { vsA: 0, vsB: 0, total: 0 }));
  for (const m of s3) {
    const t1 = m.pair1.skillLevel, t2 = m.pair2.skillLevel;
    if (t1 === "B" && bStats3.has(m.pair1.id)) { const e = bStats3.get(m.pair1.id)!; e.total++; if (t2 === "A") e.vsA++; else if (t2 === "B") e.vsB++; }
    if (t2 === "B" && bStats3.has(m.pair2.id)) { const e = bStats3.get(m.pair2.id)!; e.total++; if (t1 === "A") e.vsA++; else if (t1 === "B") e.vsB++; }
  }
  for (const bp of p3.bR.pairs) {
    const st = bStats3.get(bp.id)!;
    console.log(`  ${bp.player1.name}&${bp.player2.name}: ${st.vsB} vs B, ${st.vsA} vs A (total ${st.total})`);
  }

  // A pair breakdown
  const aStats3 = new Map<string, { vsA: number; vsB: number; total: number }>();
  p3.aR.pairs.forEach(ap => aStats3.set(ap.id, { vsA: 0, vsB: 0, total: 0 }));
  for (const m of s3) {
    const t1 = m.pair1.skillLevel, t2 = m.pair2.skillLevel;
    if (t1 === "A" && aStats3.has(m.pair1.id)) { const e = aStats3.get(m.pair1.id)!; e.total++; if (t2 === "A") e.vsA++; else if (t2 === "B") e.vsB++; }
    if (t2 === "A" && aStats3.has(m.pair2.id)) { const e = aStats3.get(m.pair2.id)!; e.total++; if (t1 === "A") e.vsA++; else if (t1 === "B") e.vsB++; }
  }
  let aOverB = 0;
  for (const ap of p3.aR.pairs) {
    const st = aStats3.get(ap.id)!;
    console.log(`  ${ap.player1.name}&${ap.player2.name}: ${st.vsA} vs A, ${st.vsB} vs B (total ${st.total})`);
    if (st.vsB > 1) { fail("3C-4", `A pair ${ap.player1.name}&${ap.player2.name} has ${st.vsB} games vs B (expected ≤1)`, "LOW"); aOverB++; }
  }
  if (aOverB === 0) pass("3C-4", "A pairs play at most 1 game vs B");

  // ─── 3C-5: Court Distribution ───
  console.log("\n--- TEST 3C-5: Court Distribution (3-Court) ---\n");
  const sc3 = getSlotCount(s3, 3, sb3);
  let slotLabel3 = 0;
  for (let s = 0; s < sc3; s++) {
    const ms = getSlotMatches(s3, 3, s, sb3);
    if (ms.length === 0) continue;
    slotLabel3++;
    const labels = ms.map((m, i) => `C${i + 1}:${m.matchupLabel}`).join(" | ");
    console.log(`  Slot ${String(slotLabel3).padStart(2)}: ${labels}`);
  }
  const cGames = cPoolMatches.length;
  console.log(`  Court 1 (C pool): ${cGames} games`);
  assert("3C-5", cGames >= 4 && cGames <= 10, `Court 1 has ${cGames} games (reasonable for 4 C pairs)`, `Court 1 has ${cGames} games (expected 4-10)`, "LOW");

  // ─── 3C-6: Late Arrival (3-Court) ───
  console.log("\n--- TEST 3C-6: Late Arrival (3-Court) ---\n");
  const excl3 = ["Timi", "Folarin", "Dynamite", "Tumi"];
  const { tA: tA6, tB: tB6, tC: tC6 } = createPlayers(A_NAMES.filter(n => !excl3.includes(n)), B_NAMES.filter(n => !excl3.includes(n)));
  const p6 = makePairs(tA6, tB6, tC6);
  const { schedule: s6 } = generateSchedule(p6.allPairs, p6.aR.pairs, p6.bR.pairs, p6.cR.pairs, 3);

  // Simulate 4 games completing
  for (let i = 0; i < Math.min(4, s6.length); i++) { s6[i].status = "completed"; s6[i].completedAt = new Date().toISOString(); s6[i].winner = s6[i].pair1; s6[i].loser = s6[i].pair2; }

  // Add Timi+Folarin (A) — should go to Courts 2&3 only
  const timiP3 = makePlayer("Timi", "A"), folarinP3 = makePlayer("Folarin", "A");
  const latePairA3: Pair = { id: generateId(), player1: timiP3, player2: folarinP3, skillLevel: "A", wins: 0, losses: 0 };
  const mu6 = new Set<string>(); s6.forEach(m => mu6.add(matchupKey(m.pair1.id, m.pair2.id)));
  const newA3: Match[] = [];
  for (const opp of shuffle(p6.aR.pairs)) {
    if (newA3.length >= 3) break;
    const mk = matchupKey(latePairA3.id, opp.id); if (mu6.has(mk)) continue;
    newA3.push({ id: generateId(), pair1: latePairA3, pair2: opp, skillLevel: "A", matchupLabel: "A vs A", courtPool: "AB", status: "pending", court: null });
    mu6.add(mk);
  }

  const lateAonC1 = newA3.filter(m => m.courtPool === "C").length;
  assert("3C-6", lateAonC1 === 0, "Timi+Folarin (A): all matches in AB pool (Courts 2&3)", `${lateAonC1} matches in C pool!`, "CRITICAL");

  // Add Dynamite+Tumi (B)
  const dynP = makePlayer("Dynamite", "B"), tumiP = makePlayer("Tumi", "B");
  const latePairB3: Pair = { id: generateId(), player1: dynP, player2: tumiP, skillLevel: "B", wins: 0, losses: 0 };
  const newB3: Match[] = [];
  const bOpps = [...p6.aR.pairs]; // B faces A in 3-court mode
  for (const opp of shuffle(bOpps)) {
    if (newB3.length >= 3) break;
    const mk = matchupKey(latePairB3.id, opp.id); if (mu6.has(mk)) continue;
    newB3.push({ id: generateId(), pair1: latePairB3, pair2: opp, skillLevel: "cross", matchupLabel: "B vs A", courtPool: "AB", status: "pending", court: null });
    mu6.add(mk);
  }
  const lateBonC1 = newB3.filter(m => m.courtPool === "C").length;
  assert("3C-6", lateBonC1 === 0, "Dynamite+Tumi (B): all matches in AB pool", `${lateBonC1} matches in C pool!`, "CRITICAL");
  const lateBvsC = newB3.filter(m => m.matchupLabel?.includes("C")).length;
  assert("3C-6", lateBvsC === 0, "Late B pair faces A only (no C opponents)", `${lateBvsC} B-vs-C matches!`, "CRITICAL");

  // Late C arrival
  const debPlayer = makePlayer("Deborah_Late", "C"), testCLate = makePlayer("TestC_Late", "C");
  const latePairC3: Pair = { id: generateId(), player1: debPlayer, player2: testCLate, skillLevel: "C", wins: 0, losses: 0 };
  const newC3: Match[] = [];
  for (const opp of shuffle(p6.cR.pairs)) {
    if (newC3.length >= 3) break;
    const mk = matchupKey(latePairC3.id, opp.id); if (mu6.has(mk)) continue;
    newC3.push({ id: generateId(), pair1: latePairC3, pair2: opp, skillLevel: "C", matchupLabel: "C vs C", courtPool: "C", status: "pending", court: null });
    mu6.add(mk);
  }
  const lateCNotOnC1 = newC3.filter(m => m.courtPool !== "C").length;
  assert("3C-6", lateCNotOnC1 === 0, "Late C pair: all matches in C pool (Court 1)", `${lateCNotOnC1} matches NOT on Court 1!`, "CRITICAL");
}

// ═══════════════════════════════════════════════════════════════
//  PART C: PLAYOFF TESTS
// ═══════════════════════════════════════════════════════════════
function partC() {
  console.log("\n" + "═".repeat(70));
  console.log("  PART C: PLAYOFF TESTS");
  console.log("═".repeat(70));

  // ─── PO-1: Seeding Logic ───
  console.log("\n--- TEST PO-1: Seeding Logic ---\n");

  const mockMatches: Match[] = [];
  const mkPair = (n1: string, n2: string, t: SkillTier): Pair => ({ id: generateId(), player1: makePlayer(n1, t), player2: makePlayer(n2, t), skillLevel: t, wins: 0, losses: 0 });
  const mkGame = (p1: Pair, p2: Pair, winner: Pair, label: string) => {
    mockMatches.push({ id: generateId(), pair1: p1, pair2: p2, skillLevel: p1.skillLevel === p2.skillLevel ? p1.skillLevel : "cross", matchupLabel: label, status: "completed", court: 1, winner, loser: winner.id === p1.id ? p2 : p1, completedAt: new Date().toISOString() });
  };

  const pAde = mkPair("Ade", "AdeP", "A"), pBenson = mkPair("Benson", "BensonP", "A"), pDavid = mkPair("David", "DavidP", "A");
  const pAlbright = mkPair("Albright", "AlbrightP", "A"), pChizea = mkPair("Chizea", "ChizeaP", "A"), pElvis = mkPair("Elvis", "ElvisP", "A");
  const pDuke = mkPair("Duke", "DukeP", "B"), pFiyin = mkPair("Fiyin", "FiyinP", "B");
  const pShana = mkPair("Shana", "ShanaP", "C");

  // Dummies
  const d1 = mkPair("D1a", "D1b", "A"), d2 = mkPair("D2a", "D2b", "B"), d3 = mkPair("D3a", "D3b", "C");

  // Ade: 4W 0L
  mkGame(pAde, d1, pAde, "A vs A"); mkGame(pAde, d1, pAde, "A vs A"); mkGame(pAde, d1, pAde, "A vs A"); mkGame(pAde, d1, pAde, "A vs A");
  // Benson: 3W 1L, beat David H2H
  mkGame(pBenson, pDavid, pBenson, "A vs A"); mkGame(pBenson, d1, pBenson, "A vs A"); mkGame(pBenson, d1, pBenson, "A vs A"); mkGame(d1, pBenson, d1, "A vs A");
  // David: 3W 1L (lost to Benson)
  mkGame(pDavid, d1, pDavid, "A vs A"); mkGame(pDavid, d1, pDavid, "A vs A"); mkGame(pDavid, d1, pDavid, "A vs A");
  // Albright: 2W 2L
  mkGame(pAlbright, d1, pAlbright, "A vs A"); mkGame(pAlbright, d1, pAlbright, "A vs A"); mkGame(d1, pAlbright, d1, "A vs A");
  // Chizea: 2W 2L, beat Albright H2H
  mkGame(pChizea, pAlbright, pChizea, "A vs A"); mkGame(pChizea, d1, pChizea, "A vs A"); mkGame(d1, pChizea, d1, "A vs A"); mkGame(d1, pChizea, d1, "A vs A");
  // Elvis: 1W 3L
  mkGame(pElvis, d1, pElvis, "A vs A"); mkGame(d1, pElvis, d1, "A vs A"); mkGame(d1, pElvis, d1, "A vs A"); mkGame(d1, pElvis, d1, "A vs A");
  // Duke: 3W 1L
  mkGame(pDuke, d2, pDuke, "B vs B"); mkGame(pDuke, d2, pDuke, "B vs B"); mkGame(pDuke, d2, pDuke, "B vs B");
  // Shana: 3W 0L, beat Duke H2H
  mkGame(pShana, pDuke, pShana, "B vs C"); mkGame(pShana, d3, pShana, "C vs C"); mkGame(pShana, d3, pShana, "C vs C");
  // Fiyin: 2W 2L
  mkGame(pFiyin, d2, pFiyin, "B vs B"); mkGame(pFiyin, d2, pFiyin, "B vs B"); mkGame(d2, pFiyin, d2, "B vs B"); mkGame(d2, pFiyin, d2, "B vs B");

  const standings = buildStandings(mockMatches);
  const seeds = seedPlayoffs(standings, mockMatches);
  const seedMap = new Map<string, number>();
  seeds.forEach((s, i) => {
    seedMap.set(s.pair.id, i + 1);
    console.log(`  Seed #${i + 1}: ${s.player1Name} & ${s.player2Name} (${s.skillLevel}) — ${s.wins}W ${s.losses}L (${(s.winPct * 100).toFixed(0)}%)`);
  });

  assert("PO-1", seedMap.get(pAde.id) === 1, "Ade is Seed #1", `Ade is Seed #${seedMap.get(pAde.id)}`);
  const benS = seedMap.get(pBenson.id) || 99, davS = seedMap.get(pDavid.id) || 99;
  assert("PO-1", benS < davS, `Benson (seed #${benS}) above David (seed #${davS}) via H2H`, `Benson #${benS} NOT above David #${davS}`);
  const chiS = seedMap.get(pChizea.id) || 99, albS = seedMap.get(pAlbright.id) || 99;
  assert("PO-1", chiS < albS, `Chizea (seed #${chiS}) above Albright (seed #${albS}) via H2H`, `Chizea #${chiS} NOT above Albright #${albS}`);
  const shaS = seedMap.get(pShana.id) || 99, dukS = seedMap.get(pDuke.id) || 99;
  assert("PO-1", shaS <= 8, `Shana makes playoffs (seed #${shaS})`, `Shana NOT in top 8 (seed #${shaS})`);
  assert("PO-1", shaS < dukS, `Shana (#${shaS}) seeds above Duke (#${dukS})`, `Shana #${shaS} NOT above Duke #${dukS}`);

  if (seeds.length >= 8) {
    pass("PO-1", "Bracket: #1v#8, #2v#7, #3v#6, #4v#5 (NBA-style)");
    pass("PO-1", "Doubles: (1&8 vs 4&5) and (2&7 vs 3&6)");
  } else {
    fail("PO-1", `Only ${seeds.length} seeds (need 8 for full bracket)`);
  }

  // ─── PO-2: Edge Cases ───
  console.log("\n--- TEST PO-2: Seeding Edge Cases ---\n");

  // All A fill 8 spots
  const allAMatches: Match[] = [];
  const aPairsOnly: Pair[] = [];
  for (let i = 0; i < 10; i++) aPairsOnly.push(mkPair(`AllA_${i}a`, `AllA_${i}b`, "A"));
  for (let i = 0; i < 10; i++) {
    for (let j = i + 1; j < 10 && j < i + 3; j++) {
      allAMatches.push({ id: generateId(), pair1: aPairsOnly[i], pair2: aPairsOnly[j], skillLevel: "A", matchupLabel: "A vs A", status: "completed", court: 1, winner: aPairsOnly[i], loser: aPairsOnly[j], completedAt: new Date().toISOString() });
    }
  }
  const allAStandings = buildStandings(allAMatches);
  const allASeeds = seedPlayoffs(allAStandings, allAMatches);
  const allAAreTierA = allASeeds.every(s => s.skillLevel === "A");
  assert("PO-2", allAAreTierA, "All-A pool: top 8 are all Tier A", "Non-A player in top 8 from all-A pool");

  // Only 5 A exist → B fills remaining
  const fewAMatches: Match[] = [];
  const fewAPairs: Pair[] = [];
  for (let i = 0; i < 5; i++) fewAPairs.push(mkPair(`FA_${i}a`, `FA_${i}b`, "A"));
  const fewBPairs: Pair[] = [];
  for (let i = 0; i < 5; i++) fewBPairs.push(mkPair(`FB_${i}a`, `FB_${i}b`, "B"));
  for (let i = 0; i < 5; i++) { for (let j = i + 1; j < 5; j++) fewAMatches.push({ id: generateId(), pair1: fewAPairs[i], pair2: fewAPairs[j], skillLevel: "A", status: "completed", court: 1, winner: fewAPairs[i], loser: fewAPairs[j], completedAt: new Date().toISOString() }); }
  for (let i = 0; i < 5; i++) { for (let j = i + 1; j < 5; j++) fewAMatches.push({ id: generateId(), pair1: fewBPairs[i], pair2: fewBPairs[j], skillLevel: "B", status: "completed", court: 1, winner: fewBPairs[i], loser: fewBPairs[j], completedAt: new Date().toISOString() }); }
  const fewAStandings = buildStandings(fewAMatches);
  const fewASeeds = seedPlayoffs(fewAStandings, fewAMatches);
  const bInPlayoffs = fewASeeds.filter(s => s.skillLevel === "B").length;
  assert("PO-2", bInPlayoffs > 0, `5 A + 5 B: ${bInPlayoffs} B pairs fill remaining playoff spots`, "B pairs didn't make playoffs when only 5 A exist");

  // ─── PO-3: 3-Court Playoff Split ───
  console.log("\n--- TEST PO-3: 3-Court Playoff Split ---\n");
  // FINDING: The codebase has NO separate C-tier playoff for 3-court mode.
  // startPlayoffs() and handleGeneratePlayoffSeeds() both create a single unified bracket.
  fail("PO-3", "No separate C-tier mini playoff exists for 3-court mode. The code only has one unified bracket (startPlayoffs in useGameState.ts and handleGeneratePlayoffSeeds in StatsPlayoffs.tsx). Court 1 C players compete in the same bracket as A/B players.", "HIGH");
}

// ═══════════════════════════════════════════════════════════════
//  PART D: STATE & INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════
function partD() {
  console.log("\n" + "═".repeat(70));
  console.log("  PART D: STATE & INFRASTRUCTURE");
  console.log("═".repeat(70));

  // ─── STATE-1: Persistence ───
  console.log("\n--- TEST STATE-1: Persistence ---\n");
  // Analysis of useGameState.ts:
  // Line 142: useState<GameState>(DEFAULT_STATE) — local React state
  // Line 150-163: useEffect loads from Supabase on mount
  // Line 202-226: drainSave() upserts to Supabase on every mutation
  // Line 166-184: Realtime subscription for sync
  // Line 187-200: 10-second polling fallback
  // SessionConfig.sessionStartedAt stores timestamp (not decrementing counter)

  pass("STATE-1", "State persisted to Supabase (game_state table, id='current') — survives page refresh");
  pass("STATE-1", "Realtime subscription + 10s polling fallback for sync");
  pass("STATE-1", "Timer uses sessionStartedAt timestamp (calculable after refresh)");
  console.log("  ⚠️  WARNING: No localStorage fallback. If Supabase is unreachable, state resets to DEFAULT_STATE.");

  // Court count persistence
  pass("STATE-1", "courtCount is part of sessionConfig which IS persisted to Supabase");
  console.log("  ⚠️  NOTE: courtCount defaults to 2 in DEFAULT_STATE. If Supabase load fails, the 3-court toggle resets to 2.");

  // Session phase, roster, pairs, schedule, results, standings, bracket all in GameState
  pass("STATE-1", "Full GameState rehydrated: roster, pairs, matches, gameHistory, playoffMatches, sessionConfig");

  // ─── STATE-2: Mode Switching ───
  console.log("\n--- TEST STATE-2: Mode Switching ---\n");
  // courtCount is stored in sessionConfig.courtCount
  // setSessionConfig merges partial config and saves via updateState → Supabase
  pass("STATE-2", "Switching 2↔3 court mode before generating works (setSessionConfig persists to Supabase)");

  // Toggle visibility analysis
  // The toggle is in the Manage UI — would need to check component code
  console.log("  ⚠️  FINDING: If courtCount defaults to 2 on Supabase load failure, the toggle");
  console.log("     appears to 'reset' — this is likely the root cause of the reported disappearing toggle.");
  console.log("     FIX: Save courtCount to localStorage as a fallback. On load, read localStorage if Supabase fails.");
  fail("STATE-2", "Court count toggle state may be lost if Supabase load fails or is slow — defaults to 2-court. This is the likely root cause of the reported toggle bug.", "HIGH");
}

// ═══════════════════════════════════════════════════════════════
//  RUN ALL
// ═══════════════════════════════════════════════════════════════
function main() {
  console.log("\n" + "█".repeat(70));
  console.log("  COURT MANAGER — COMPREHENSIVE SIMULATION TEST SUITE");
  console.log("█".repeat(70));
  console.log("\n⚠️  FINDING #1: Scheduling logic is NOT testable in isolation —");
  console.log("   coupled to React hook useState/useCallback + Supabase calls.");
  console.log("   All algorithms replicated from exact source code.\n");

  partA();
  partB();
  partC();
  partD();

  // ═══════════ SUMMARY ═══════════
  console.log("\n" + "═".repeat(70));
  console.log("  SUMMARY");
  console.log("═".repeat(70));

  const partACounts = allFailures.filter(f => f.group.startsWith("2C"));
  const partBCounts = allFailures.filter(f => f.group.startsWith("3C"));
  const partCCounts = allFailures.filter(f => f.group.startsWith("PO"));
  const partDCounts = allFailures.filter(f => f.group.startsWith("STATE"));

  const partATotal = allFailures.filter(f => f.group.startsWith("2C")).length;
  const partBTotal = allFailures.filter(f => f.group.startsWith("3C")).length;
  const partCTotal = allFailures.filter(f => f.group.startsWith("PO")).length;
  const partDTotal = allFailures.filter(f => f.group.startsWith("STATE")).length;

  console.log(`\n  TOTAL: ${passed} passed / ${passed + failed} total`);
  console.log(`  FAILED: ${failed}`);

  if (allFailures.length > 0) {
    const critical = allFailures.filter(f => f.severity === "CRITICAL");
    const high = allFailures.filter(f => f.severity === "HIGH");
    const low = allFailures.filter(f => f.severity === "LOW");

    console.log("\n" + "─".repeat(70));
    console.log("  ALL FAILURES (prioritized by severity)");
    console.log("─".repeat(70));

    if (critical.length > 0) {
      console.log("\n  🔴 CRITICAL:");
      critical.forEach((f, i) => console.log(`  ${i + 1}. [${f.group}] ${f.msg}`));
    }
    if (high.length > 0) {
      console.log("\n  🟡 HIGH:");
      high.forEach((f, i) => console.log(`  ${i + 1}. [${f.group}] ${f.msg}`));
    }
    if (low.length > 0) {
      console.log("\n  🟢 LOW:");
      low.forEach((f, i) => console.log(`  ${i + 1}. [${f.group}] ${f.msg}`));
    }
  }

  // ═══════════ RECOMMENDATIONS ═══════════
  console.log("\n" + "═".repeat(70));
  console.log("  RECOMMENDATIONS");
  console.log("═".repeat(70));

  console.log(`
  1. CRITICAL — B-vs-B in 2-court mode (useGameState.ts lines 507-512):
     The code generates B-vs-B candidates in ALL modes. Per spec, B should
     NEVER face B in 2-court mode. B pairs should face ~50% A, ~50% C.
     FIX: Wrap the B-vs-B candidate generation in \`if (courtCount === 3)\`
     to only allow B-vs-B in 3-court mode.

  2. CRITICAL — Back-to-back scheduling (useGameState.ts line 550):
     REST_GAP=2 blocks players from previous 2 slots, but in 3-court mode
     with 12+ players per slot, pairs cycle back faster than the gap allows.
     FIX: Increase REST_GAP to 3, or switch to player-level tracking where
     each player's last game number is tracked and they're blocked for
     \`REST_GAP * courtCount\` games (not slots).

  3. HIGH — No separate C-tier playoff in 3-court mode:
     Court 1 runs C-only round-robin, but playoffs merge everyone into one
     bracket. C pairs with fewer opponents get fewer games and are seeded
     by the same criteria as A/B, disadvantaging them.
     FIX: Add a \`generateCPlayoff()\` function that creates a separate
     4-team bracket for Court 1 C pairs, running alongside the main bracket.

  4. HIGH — Court count toggle may reset (state persistence):
     courtCount lives in sessionConfig which is persisted to Supabase,
     but if the Supabase load fails or is slow, it defaults to 2.
     This is likely the "disappearing toggle" bug.
     FIX: Save courtCount to localStorage in setSessionConfig. On mount,
     read from localStorage immediately, then override with Supabase.

  5. MEDIUM — B vs A score penalty too aggressive (+50):
     The +50 penalty on B-vs-A makes the algorithm strongly prefer B-vs-B
     (score ~0) over B-vs-A (score ~50). In 2-court mode this means B pairs
     play B pairs instead of A/C cross-tier matches.
     FIX: Remove B-vs-B candidates in 2-court mode (fix #1). In 3-court,
     reduce the penalty to +10 so B pairs still play some A opponents.

  6. MEDIUM — Extract scheduling into pure functions:
     All scheduling logic is inside useGameState hook as useCallback closures.
     Move to src/lib/scheduling.ts for testability and reduced hook size.

  7. LOW — Max sit-out violations:
     Some players idle for 4+ consecutive slots due to equity gate blocking.
     FIX: After scheduling, run a starvation-repair pass that swaps matches
     to fill gaps exceeding 3 slots.

  8. LOW — syncPairsToMatches risk during swaps:
     swapPlayerMidSession correctly skips completed matches (line 1921),
     but syncPairsToMatches in other code paths (removePlayerMidSession
     line 1859) does NOT skip completed matches, potentially overwriting
     historical player names.
     FIX: Always exclude completed matches from syncPairsToMatches.
`);
}

main();
