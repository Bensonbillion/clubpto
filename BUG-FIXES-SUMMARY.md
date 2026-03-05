# Club PTO - Court Manager Bug Fixes

**Date:** March 5, 2026
**Status:** Fixed & Tested

---

## What Was Happening

We had 3 bugs showing up during live sessions:

1. **Courts would randomly stop assigning new games mid-session** — a court finishes, and just... nothing. No new game gets put on.
2. **Late arrivals would get slammed with 4 games back-to-back** — no rest between games when they join mid-session.
3. **Removed players kept showing up in upcoming matches** — you remove someone from the session but their name is still on the schedule.

---

## Bug 1: Courts Freezing (No New Games)

**What was wrong:**
The system tries to keep things fair — it won't let any pair get too far ahead in games played. But it was comparing against ALL pairs, including pairs currently playing on another court. So if a pair with 0 games was mid-match on Court 2, the system thought "nobody should have more than 1 game" and blocked every other pair from playing on Court 1. Complete deadlock.

There was also a 3-minute rest window after a game finishes. If everyone available happened to fall inside that window, the system would just give up instead of relaxing the rule.

**What we fixed:**
- The fairness check now only looks at pairs who are actually available, not ones busy on other courts.
- If the rest window blocks everyone, the system now relaxes it and assigns a game anyway rather than leaving the court empty.

---

## Bug 2: Late Arrivals Getting Back-to-Back Games

**What was wrong:**
When a late pair joins, their 4 games get inserted into the schedule. The system checked that they weren't on two courts at the same time (good), but it never checked if they had a rest gap between consecutive games. So all 4 games could land in slots 5, 6, 7, 8 — back to back to back to back.

**What we fixed:**
The insertion logic now checks the slot before AND after each game it places. If a pair just played in the previous slot or is already in the next slot, it moves the game further down the schedule. They'll still get all their games, just properly spaced out.

---

## Bug 3: Ghost Players After Removal

**What was wrong:**
There were two different "remove player" buttons using two different functions:
- The one in **Manage Roster** (Court Display tab) did the full cleanup — removed the pair, cleaned up their matches, gave replacement games to opponents.
- The one in **Admin Setup** only removed the player from the roster list. Their matches stayed on the schedule with their name still on them.

On top of that, when matches did get cleaned up, the code was directly changing objects in memory instead of creating clean copies, which could cause React to miss the update entirely.

**What we fixed:**
- Both remove buttons now do the full cleanup — remove pair, remove their pending matches, and filter out any stale references.
- All state updates now create proper new objects so React always picks up the changes.
- Added a safety net: even if a stale match somehow survives, the system will skip it when assigning courts (it checks that both pairs still exist before putting a match on).

---

## New: Debug Panel

Added a **Debug tab** in the Court Manager (behind the admin passcode) that shows:

- **Live court status** — what's playing, how long it's been going
- **Pair breakdown** — games played, wins/losses, who's waiting, who's on court
- **Automatic alerts** — warns you if courts are stalled, if ghost players are detected, or if there are back-to-back scheduling issues
- **Export button** — downloads a full snapshot of the session state as a JSON file for troubleshooting

---

## Testing

Added 16 new automated tests covering all 3 bugs. All 58 tests (42 existing + 16 new) pass.

---

## Files Changed

- `src/hooks/useGameState.ts` — core game logic fixes
- `src/components/manage/DebugPanel.tsx` — new debug panel
- `src/pages/Manage.tsx` — added Debug tab
- `src/hooks/useGameState.bugfixes.test.ts` — new tests
