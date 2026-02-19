

# Court Manager -- Identified Issues & Fixes

After reviewing all court manager files, here are the issues and improvements needed:

---

## 1. "On Deck" Overlaps with "Up Next"

**Problem**: `onDeckMatches = pendingMatches.slice(0, 2)` and "Up Next" shows `pendingMatches.slice(0, 3)`. These display the **same matches**, making the "On Deck" section redundant.

**Fix**: "Up Next" should show the next 2 pending matches (the ones that will go on court next). "On Deck" should show the **following** 2 matches after those -- so players in the group *after* next know to get ready.

**Files**: `src/hooks/useGameState.ts` (line 614), `src/components/manage/CourtDisplay.tsx` (lines 172-199)

---

## 2. No Swap UI for Pending Matches

**Problem**: The `swapPlayer` function exists in `useGameState.ts` but there is **no UI** to trigger it. Admins cannot manually swap players before a match starts.

**Fix**: Add a swap interface on pending matches in the Court Display (admin-only). Show a small edit/swap icon next to each player name in the "Up Next" section. Tapping it opens a dropdown of available checked-in players to swap in.

**Files**: `src/components/manage/CourtDisplay.tsx`, `src/pages/Manage.tsx` (pass `isAdmin` to CourtDisplay)

---

## 3. Duplicate Generate Buttons

**Problem**: Both `AdminSetup` and `CheckIn` have "Generate Games" buttons with different prerequisites. AdminSetup requires `sessionStarted` first, while CheckIn doesn't. This creates two conflicting paths.

**Fix**: Remove the "Generate Full Schedule" button from AdminSetup. Keep "Start Session" there as a prerequisite. In CheckIn (admin view), only show "Generate Games" when `sessionStarted` is true. This creates a single clear flow: Admin Setup (Start Session) -> Check-In (Generate Games).

**Files**: `src/components/manage/AdminSetup.tsx` (remove generate button), `src/components/manage/CheckIn.tsx` (add sessionStarted check)

---

## 4. Playoff Bracket is View-Only (No Execution)

**Problem**: Playoff seeds and bracket preview are generated, but there is no way to actually **play** playoff matches -- no court assignment, no winner selection, no bracket progression.

**Fix**: After generating playoff seeds, create actual `PlayoffMatch` objects. Add a "Start Playoffs" flow that assigns the first playoff matches to courts (replacing round-robin). Reuse the same `WinnerModal` pattern for recording playoff results and advancing the bracket.

**Files**: `src/types/courtManager.ts` (add `playoffMatches` to `GameState`), `src/hooks/useGameState.ts` (add playoff match management), `src/components/manage/StatsPlayoffs.tsx` (interactive bracket)

---

## 5. Bulk "Set All To" Fires Individual Updates

**Problem**: In AdminSetup, the "Set all to Beginner/Good" buttons call `toggleSkillLevel` for each player individually, triggering N separate state updates and database writes.

**Fix**: Add a `setAllSkillLevels` batch function in `useGameState` that updates all players in a single state update and persist call.

**Files**: `src/hooks/useGameState.ts`, `src/components/manage/AdminSetup.tsx`

---

## 6. No Duplicate Player Name Prevention

**Problem**: Adding a player with the same name (via single add or bulk paste) creates duplicates in the roster with no warning.

**Fix**: Check for existing names (case-insensitive) before adding. Skip duplicates in bulk add, show a toast for single add.

**Files**: `src/hooks/useGameState.ts` (addPlayer), `src/components/manage/AdminSetup.tsx`

---

## 7. `consecutiveSitOuts` Never Updated at Runtime

**Problem**: The `consecutiveSitOuts` field on `Player` is declared and used as a local variable during schedule generation, but **never actually updated** on the persisted roster as games complete. It's always 0 in the actual state.

**Fix**: This field is only relevant during schedule generation (where it's tracked locally). Remove it from the persisted `Player` interface since it's not meaningful at runtime, or update it in `completeMatch` if it will be used for late-player scheduling decisions.

**Files**: `src/types/courtManager.ts`, `src/hooks/useGameState.ts`

---

## Summary of Priority

| # | Issue | Impact |
|---|-------|--------|
| 1 | On Deck / Up Next overlap | Players see duplicate info |
| 2 | No swap UI | Admins can't use existing swap logic |
| 3 | Duplicate generate buttons | Confusing dual flow |
| 4 | Playoff not playable | Core feature incomplete |
| 5 | Batch skill update | Performance (many DB writes) |
| 6 | Duplicate player names | Data quality |
| 7 | Unused consecutiveSitOuts | Dead code cleanup |

