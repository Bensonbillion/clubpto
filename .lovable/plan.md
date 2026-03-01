

# Dynamic Scheduling — Late Arrival Flow

## Summary

Transform the scheduling system from "generate once for all players" to a living schedule that starts with whoever is checked in and seamlessly absorbs late arrivals without disrupting active or completed games.

## Technical Changes

### 1. `useGameState.ts` — Core Logic Changes

**Modify `generateFullSchedule`**: Lower the minimum player threshold. Currently requires 4 checked-in players — keep this but allow generation even when roster has more unchecked players. Add a `sessionConfig.checkInClosed` flag check. No structural change needed here since it already only uses checked-in players.

**Rewrite `addLatePlayersToSchedule`** (currently a basic stub at lines 639-703):
- Accept a specific late player ID instead of scanning all unscheduled players
- Check for a same-tier waitlisted player; if found, auto-pair them and add the new pair
- If no waitlisted partner, add the player to `waitlistedPlayers` and return early
- When a pair IS formed, generate matches using the existing `pickBestCandidate` pattern but only insert into slots that are 2+ positions beyond each court's current "On Deck" game
- Prioritize the new pair (give them lower game count so `pickBestCandidate` scoring favors them)
- Return the count of affected games and estimated minutes to first game for the toast

**Add `regenerateRemainingSchedule`**: A manual trigger that:
- Preserves all completed and playing matches, plus the first pending match per court (On Deck)
- Clears all other pending matches
- Re-runs the scheduling algorithm with current pairs against remaining candidate matchups
- Renumbers games

**Add `closeCheckIn`**: Sets `sessionConfig.checkInClosed = true`, blocking further late arrivals.

### 2. `CheckIn.tsx` — Late Arrival UI

**Modify check-in behavior when `state.matches.length > 0`** (session already running):
- When a player checks in during an active session, call a new `handleLateCheckIn(playerId)` that:
  - If VIP: show VIP dialog as normal, then call `addLatePlayerToSchedule` with the fixed pair
  - If not VIP: call `addLatePlayerToSchedule(playerId)` which auto-pairs with waitlist or adds to waitlist
- Show toast: "PlayerName added to waitlist" or "PlayerName + PartnerName added to schedule — first game in ~X minutes"

**Add "Pending Check-ins" indicator** (admin only): Show a small badge/section with count of unchecked-in players by tier (e.g., "Waiting: 2A, 1B, 3C").

**Add "Close Check-in" toggle** (admin only): A switch that sets `checkInClosed`. When closed, non-admin check-in taps are blocked and a message shows "Check-in is closed."

### 3. `CourtDisplay.tsx` — Visual Feedback

**"Up Next" section**: Add a "Locked" badge/icon to indicate these games won't change when late players join.

**"On Deck" section**: Add a "Projected" subtle label to indicate these may shift.

**Future games section**: When a new pair is inserted, briefly highlight/pulse their names using a CSS animation class (e.g., `animate-pulse` for 3 seconds via a `newPairIds` state that clears after timeout).

**Add "Regenerate Schedule" button** in admin toolbar: Secondary button that calls `regenerateRemainingSchedule` with a confirmation dialog.

**Add "Pending Check-ins" indicator** in toolbar: Small badge showing "X players pending" broken down by tier.

### 4. `courtManager.ts` — Type Changes

Add to `SessionConfig`:
```typescript
checkInClosed?: boolean;
```

### 5. Schedule Insertion Logic (Detail)

When inserting a new pair's matches into the existing schedule:
1. Find the "freeze line" per court: the index of the last "On Deck" match (first `courtCount * 2` pending matches are frozen)
2. Identify all pending matches after the freeze line
3. Generate new candidate matchups for the new pair against eligible opponents (same tier rules)
4. Interleave new matches into the remaining pending list, prioritizing the new pair (they should get a game within the first 2-3 available slots after the freeze line)
5. Validate: no double-booking, no back-to-back, tier routing for 3-court mode
6. Renumber all games

### 6. 3-Court Mode Compatibility

Late C players only generate matches for Court 1's pool. Late A/B players only generate matches for Courts 2-3 pool. The `courtPool` property on candidate matches already handles this.

## Files to Modify

- `src/types/courtManager.ts` — add `checkInClosed` to `SessionConfig`
- `src/hooks/useGameState.ts` — rewrite `addLatePlayersToSchedule`, add `regenerateRemainingSchedule`, add `closeCheckIn`, export new functions
- `src/components/manage/CheckIn.tsx` — late check-in flow, pending check-ins indicator, close check-in toggle, VIP late arrival handling
- `src/components/manage/CourtDisplay.tsx` — locked/projected labels, new pair highlight, regenerate button, pending indicator

## What Is NOT Changed

- Playoff logic, bracket, seeding
- Pair editing (`PairEditor.tsx`)
- VIP selection dialog itself (`VipPairingDialog.tsx`)
- Court Display layout/cards
- Manage Roster drawer
- Color scheme, touch targets

