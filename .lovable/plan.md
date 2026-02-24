

## Problem Diagnosis

There are two critical bugs causing players to appear in different pairs across matches:

### Bug 1: `swapPlayer` breaks fixed pairs
The `swapPlayer` function (line 659) replaces a player inside a **single match's pair only**. It does not update `state.pairs` (the master pair list) or propagate the change to all other matches containing that pair. This means after a swap, the pair composition differs between matches — violating the fixed-pair rule.

### Bug 2: `completeMatch` never updates pair-level stats
When a match finishes, `completeMatch` updates individual player W/L but never updates `pair.wins` and `pair.losses` on the `state.pairs` objects. The `StatsPlayoffs` component reads pair stats for seeding, so standings may show 0-0 for all pairs.

### Bug 3: Match objects contain independent pair copies
Each `Match` stores its own copy of the `Pair` objects. There is no referential link back to `state.pairs`. If any function modifies a pair inside one match, it diverges from the master list and from other matches.

---

## Plan

### 1. Make matches reference pairs by ID, not by copy

Instead of embedding full `Pair` objects inside each `Match`, all match logic will use the master `state.pairs` array as the single source of truth. When rendering or processing a match, pairs will be looked up from `state.pairs` by ID.

**Changes to `src/types/courtManager.ts`:**
- Keep the current `Match` structure (embedding pairs) for simplicity of rendering, but enforce that all mutations go through a centralized update that keeps match-level pair references in sync with `state.pairs`.

### 2. Fix `swapPlayer` to update globally

Rewrite `swapPlayer` so that when a player is swapped:
- The master `state.pairs` entry is updated
- **Every** match referencing that pair ID gets the updated pair object
- This ensures the pair composition is consistent everywhere

### 3. Fix `completeMatch` to update pair W/L

When a match completes:
- Update `pair.wins` / `pair.losses` on the winning and losing pairs in `state.pairs`
- Propagate updated pair objects into all match references

### 4. Add a helper function: `syncPairsToMatches`

Create a utility that takes the current `state.pairs` and replaces all pair references inside `state.matches` with the latest version from the master list. Call this after any pair mutation (swap, result correction, etc.).

### 5. Fix `correctGameResult` to update pair stats

Currently it only updates player-level stats. Add pair-level stat reversal and re-application, then sync pairs to matches.

### 6. Fix `removePlayerMidSession`

When a player is removed, also remove their pair from `state.pairs` and cancel all that pair's pending matches — this part already works but should also sync remaining pairs.

---

### Technical detail: the sync helper

```text
syncPairsToMatches(pairs, matches):
  for each match in matches:
    match.pair1 = pairs.find(p => p.id === match.pair1.id) || match.pair1
    match.pair2 = pairs.find(p => p.id === match.pair2.id) || match.pair2
  return matches
```

This single function, called at the end of every state mutation, guarantees pair consistency across the entire session.

### Files to modify
- `src/hooks/useGameState.ts` — all fixes above
- No other files need changes; the UI already reads from `state.pairs` and `state.matches`

