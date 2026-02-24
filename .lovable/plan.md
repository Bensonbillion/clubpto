

# Final Review: Court Manager — Issues Found

After a thorough audit of every component in the Court Manager section, here is what I found:

---

## Issues to Fix

### 1. Session Export shows individual player standings, not pair standings
**File:** `SessionExport.tsx` (lines 35-51)
**Problem:** The `buildStandings` function in the export uses individual player stats (`state.roster`) instead of pair-level standings. The rest of the system tracks wins/losses at the pair level, so the export is inconsistent. It should mirror the pair-based leaderboard used in `StatsPlayoffs.tsx`.
**Fix:** Refactor the standings section in `buildTextSummary` to iterate through completed matches and aggregate by pair (same logic as `buildPairStandingsByTier`), showing "Alex & Brian — 3W 1L (75%)" instead of individual names.

### 2. Game History Log leaks matchup labels to non-admin
**File:** `GameHistoryLog.tsx` (lines 96-99)
**Problem:** The `match.matchupLabel` (e.g., "B VS A", "C VS C") is rendered unconditionally at the bottom of each history entry. However, this component is only shown when `isAdmin && showHistory` is true in `CourtDisplay.tsx`, so this is **safe for now**. No fix needed — the component is already gated behind admin access.

### 3. CourtConflictAlert component is imported but never used
**File:** `CourtConflictAlert.tsx`
**Problem:** This component exists but is not imported or used anywhere. It's dead code. The CourtDisplay has a comment saying "Conflicts are prevented by scheduling logic — no alert needed." This is fine — no functional issue, just cleanup.

### 4. No error handling if `game_state` row doesn't exist on first load
**File:** `useGameState.ts` (lines 54-67)
**Problem:** On first load, if the `game_state` table has no row with `id = "current"`, the state simply stays as `DEFAULT_STATE` which is correct. However, when `persistState` runs, it does an `update` which will silently fail because there's no row to update. The first session would appear to work in-memory but never persist.
**Fix:** Add an `upsert` instead of `update` in `persistState`, or ensure the row is created on first use.

### 5. Polling + realtime creates potential state overwrites
**File:** `useGameState.ts` (lines 69-102)
**Problem:** The 10-second polling fallback calls `setState` unconditionally, which can overwrite local state that hasn't been persisted yet. If an admin makes a change and the poll fires before the save completes, the local change is lost. This is a race condition risk during rapid interactions (e.g., completing matches quickly).
**Fix:** Add a guard: skip polling updates when `savingRef.current` is true or when the `updated_at` timestamp from the DB matches what we last saved.

### 6. `startPlayoffMatch` incorrectly forces round-robin matches to "completed"
**File:** `useGameState.ts` (lines 930-943)
**Problem:** When starting a playoff match on a court, any round-robin match currently "playing" on that court gets force-completed (status set to "completed") without recording a winner. This creates ghost completed matches with no winner, which breaks standings calculations and history.
**Fix:** Only clear the court assignment (set court to null) without changing the round-robin match status. Or better yet, only allow playoff matches to start when courts are free.

---

## Confirmed Working (No Issues)

- **Pair consistency:** `syncPairsToMatches` correctly propagates pair updates across all matches.
- **Privacy:** Court Display hides tier labels, matchup tags, All Pairs grid, and Standings from non-admin users.
- **Check-In privacy:** Tier badges are admin-only. Player counts are visible (appropriate).
- **Standings by tier:** `buildPairStandingsByTier` correctly counts cross-tier matches for each pair's own tier.
- **Champion banner:** Shows only once (from `PlayoffBracket`).
- **Playoff seeding:** C-beats-B override and NBA-style seeding work correctly.
- **Game history correction:** `correctGameResult` properly reverses and reapplies both player and pair stats.
- **Player removal mid-session:** Correctly removes the pair and all pending matches.
- **VIP pairing dialog:** Works correctly for David, Benson, Albright.
- **Session clock and game timers:** Function correctly.
- **Fullscreen mode:** Works with proper state tracking.

---

## Recommended Fixes (Priority Order)

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | `persistState` uses `update` instead of `upsert` — first session won't save | High | Small |
| 2 | `startPlayoffMatch` force-completes round-robin matches without a winner | High | Small |
| 3 | Polling can overwrite unsaved local state | Medium | Small |
| 4 | Session Export uses individual stats instead of pair stats | Medium | Medium |

---

## Technical Details

**Fix 1 — Upsert:** Change `persistState` from `.update(...)` to `.upsert({ id: ROW_ID, state: ..., updated_at: ... })`.

**Fix 2 — Playoff court assignment:** Remove the line that sets round-robin matches to "completed" when a playoff match starts. Instead, simply don't allow starting a playoff match if a round-robin match is still active on that court, or just ignore the court collision since playoffs are a separate stage.

**Fix 3 — Polling guard:** Track `lastSavedAt` and skip `setState` in the polling interval if `savingRef.current` is true.

**Fix 4 — Export standings:** Replace the individual `buildStandings` function in `SessionExport.tsx` with pair-based aggregation matching the `StatsPlayoffs` logic.

