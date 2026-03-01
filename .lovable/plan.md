

# Club PTO Court Manager — 6-Update Implementation Plan

## Confirmed Understanding

The app is a tablet-first padel league manager with: Admin Setup (PIN-protected), Check-In, Court Display, and Stats & Playoffs (PIN-protected). All state lives in a single JSON blob in the `game_state` table. The core engine is `useGameState.ts` (1145 lines). Tier labels are hidden from players. Fixed pairs persist for the entire session.

---

## Dependency Graph & Build Order

```text
Update 1 (VIP fix) ──────────────┐
Update 3 (Waitlist / odd tier) ──┤
Update 4 (Manual pair editing) ──┼──▶ Update 6 (3-court mode)
Update 5 (H2H tiebreaker) ───────┘       │
Update 2 (Mid-session roster) ────────────┘
```

**Optimal build order:**
1. Update 1 — VIP pair selection fix (standalone, small)
2. Update 5 — Head-to-head tiebreaker (standalone, small)
3. Update 3 — Waitlist / odd-tier handling (adds admin decision UI)
4. Update 4 — Manual pair editing (builds on pair creation flow)
5. Update 2 — Mid-session roster management (depends on pair editing patterns)
6. Update 6 — 3-court mode (touches scheduling, court display, matchup rules — largest change, depends on stable pair/scheduling logic)

---

## Update 1: Fix VIP Pair Selection

**Problem:** VIP dialog shows ALL players instead of same-tier only. VIP's choice is stored but may not be honored if tier mismatch.

**Files affected:**
- `src/components/manage/VipPairingDialog.tsx` — Filter `availablePlayers` by tier
- `src/components/manage/CheckIn.tsx` — Pass the VIP's tier to the dialog; filter `availableForVip` by matching `skillLevel`

**New code needed:** None (modification only)

**Risks:** If a VIP's tier has only 1 player (the VIP themselves), no same-tier partners are available. Show a message and fall back to randomize.

---

## Update 5: Head-to-Head Tiebreaker in Playoff Seeding

**Problem:** Current seeding sorts by Win% then total wins. No head-to-head check.

**Files affected:**
- `src/components/manage/StatsPlayoffs.tsx` — `buildAllPairStandings` sort comparator
- `src/hooks/useGameState.ts` — `startPlayoffs()` sort comparator

**New function needed:** `getHeadToHead(pairAId, pairBId, matches)` → returns `1 | -1 | 0` based on direct matchup results. Add to `useGameState.ts` as a utility.

**Tiebreaker order (per spec):** Tier priority → Win% → Head-to-head → Point differential (not tracked yet, skip) → Total games played.

**Risks:** Two pairs may never have played each other directly, in which case H2H is neutral (fall through to next tiebreaker).

---

## Update 3: Waitlist for Uneven Tier Check-ins

**Problem:** If a tier has an odd number, one player silently gets no pair.

**Files affected:**
- `src/components/manage/CheckIn.tsx` — Show warning when any tier has odd count; show admin decision UI
- `src/hooks/useGameState.ts` — `generateFullSchedule` needs to handle the admin's decision for odd players

**New component:** `OddPlayerAlert` (inline in CheckIn or small component) — shows per-tier counts, flags odd tiers, lets admin choose: sit out, cross-pair with adjacent tier, or wait for late arrival.

**New state:** `waitlistedPlayers: string[]` on `GameState` to track players sitting out by admin decision.

**Risks:** Cross-pairing a C with a B changes matchup rules for that pair. Need to decide: does a B+C pair follow B rules or C rules? Recommendation: treat as B pair (plays A and C opponents).

---

## Update 4: Manual Pair Editing

**Problem:** After randomization, admin can't override pairs.

**Files affected:**
- `src/components/manage/CheckIn.tsx` or new `PairEditor.tsx` — UI to view generated pairs and swap players within same tier
- `src/hooks/useGameState.ts` — New `editPair(pairId, newPlayer1Id, newPlayer2Id)` function that updates master pairs + syncs all matches

**New component:** `PairEditor` — shows all pairs grouped by tier, allows drag-or-tap to swap two players between pairs (same tier only). Shown after `generateFullSchedule` but before first match starts.

**Risks:** Swapping players between pairs after schedule generation means all pending matches involving those pairs get updated player names. The existing `syncPairsToMatches` handles this. Must enforce same-tier constraint.

---

## Update 2: Mid-Session Roster Management

**Problem:** Cannot swap, add, or remove players after session starts.

**Files affected:**
- `src/components/manage/CourtDisplay.tsx` — Add "Add Player" and "Swap Player" admin buttons
- `src/hooks/useGameState.ts` — New `swapPlayerInPair(pairId, oldPlayerId, newPlayerId)` that replaces a player in their fixed pair across all pending/future matches. Enhance `addLatePlayersToSchedule` to handle single players.

**Existing partial implementation:** `removePlayerMidSession` and `swapPlayer` already exist but `swapPlayer` only works on pending matches and requires a match ID. Need a pair-level swap that works globally.

**New function:** `replacePlayerInPair(pairId, oldPlayerId, newPlayerId)` — finds the pair, replaces the player, calls `syncPairsToMatches` on all non-completed matches.

**Risks:** Replacing a player in a pair that's currently playing should be blocked (only pending/future). Completed match history should retain original players. Need to add the replacement player to roster if not already there.

---

## Update 6: 3-Court Session Mode

**Problem:** No support for 3 courts with dedicated tier routing.

**Files affected:**
- `src/types/courtManager.ts` — Add `courtCount: 2 | 3` to `SessionConfig`
- `src/components/manage/AdminSetup.tsx` — Add 2-court / 3-court toggle
- `src/hooks/useGameState.ts` — Major changes to `generateFullSchedule`:
  - 3-court mode: Court 1 = C vs C only; Courts 2 & 3 = A vs A, B vs A (B never plays C)
  - Slot = 3 games, 12 unique players per slot
  - Rest gap still applies
- `src/components/manage/CourtDisplay.tsx` — Render 3 court cards; derive `court3Match`
- `src/hooks/useGameState.ts` — `completeMatch` / `skipMatch` / `startPlayoffs` must handle court 3

**New derived state:** `court3Match` in return object.

**Scheduling logic changes:**
- Separate candidate pools: Court 1 candidates = C vs C only; Court 2+3 candidates = A vs A, B vs A
- Per-slot: pick 1 C-vs-C for Court 1, then pick 2 non-overlapping A/B matches for Courts 2+3
- B never plays C in 3-court mode (remove B vs C candidates entirely)

**Risks:**
- If few C players, Court 1 may run out of matches quickly → need graceful handling (court sits empty)
- If B has no A opponents, B pairs have no matches → edge case warning
- VIP delay logic must account for 3 courts
- Playoff bracket unchanged (still top 8 pairs)

---

## Summary: Files Changed Per Update

| File | U1 | U2 | U3 | U4 | U5 | U6 |
|------|----|----|----|----|----|----|
| `courtManager.ts` | | | ✓ | | | ✓ |
| `useGameState.ts` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `CheckIn.tsx` | ✓ | | ✓ | ✓ | | |
| `VipPairingDialog.tsx` | ✓ | | | | | |
| `CourtDisplay.tsx` | | ✓ | | | | ✓ |
| `AdminSetup.tsx` | | | | | | ✓ |
| `StatsPlayoffs.tsx` | | | | | ✓ | |
| New: `PairEditor.tsx` | | | | ✓ | | |

