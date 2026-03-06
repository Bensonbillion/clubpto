

## Fix EngineTest Walk-in Flow and Stall Issues

The `/manage/test` page exists but has bugs preventing a clean pass. Here's what needs fixing:

### Bug 1: Walk-in Phase (Phase 6) — Duplicate Name Rejection
The test calls `gs.addPlayer("Zara")` and `gs.addPlayer("Lola")` to add them to the roster, then calls `gs.addPlayerMidSession("Zara", "C")`. But `addPlayerMidSession` rejects duplicates (line 2901), so the walk-in silently fails.

**Fix:** Don't pre-add players. Call `addPlayerMidSession("Zara", "C")` first (adds Zara to roster as unpaired), then call `addPlayerMidSession("Lola", "C")` (adds Lola and auto-pairs with Zara). Remove the `addPlayer` + `toggleCheckIn` calls for walk-ins.

### Bug 2: Game Completion Loop (Phase 5 & 8) — Potential Stall
After completing a match, if the auto-advance doesn't assign a new `"playing"` match immediately, and pending matches remain, the loop spins forever. 

**Fix:** Add a stall detector — if no playing matches exist but pending matches do, attempt to manually start the first pending match on an available court. Add a timeout counter to break out after ~30 seconds of no progress.

### Bug 3: Walk-in Validation Timing
The walk-in pair lookup happens 200ms after adding, but state updates are async via `updateState`. Need slightly longer delays or check across multiple ticks.

**Fix:** Increase delays to 500ms and add retry logic for the pair-existence check.

### Changes

**File: `src/pages/EngineTest.tsx`**
1. **Phase 6** — Remove `addPlayer`/`toggleCheckIn` calls. Use two sequential `addPlayerMidSession` calls instead. First adds Zara (solo), second adds Lola (pairs with Zara).
2. **Phase 5 & 8** — Add stall detection: if `playing.length === 0 && pending.length > 0` for more than 10 ticks, manually start the first pending match. Add a max iteration guard (~200 ticks) to prevent infinite loops.
3. **Timing** — Increase setTimeout delays in Phase 6 from 200ms to 500ms for more reliable state propagation.
4. **Reset** — Ensure `resetSession` properly clears all state before re-running.

