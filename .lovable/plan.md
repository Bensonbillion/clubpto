

# Codebase Audit Report — 10-Point Validation

## 1. VIP partner selection (same-tier only)
**Status: PASS with caveat**

CheckIn.tsx lines 121-126 correctly filter `availableForVip` to only players matching the VIP's `skillLevel`. However, it does **not** filter to only *checked-in* players. The filter is:
```
p.name.toLowerCase() !== vipDialogFor.toLowerCase() && p.skillLevel === vipPlayer.skillLevel
```
It should also include `&& p.checkedIn`. A VIP could see unchecked-in players as selectable partners.

**Issue flagged: VIP dialog shows unchecked-in same-tier players as selectable partners.**

---

## 2. Admin swap/add/remove after session starts
**Status: PASS**

All three operations exist (`swapPlayerMidSession`, `addPlayerMidSession`, `removePlayerMidSession`) and are wired through ManageRosterDrawer in CourtDisplay. Each blocks actions on players currently "playing". Future matches update; completed results preserved.

---

## 3. Odd tier check-in → waitlist
**Status: PASS with caveat**

OddPlayerAlert correctly detects odd counts per tier and offers sit-out/cross-pair/wait options. The `oddTiers` memo picks the last player in the array as the "odd one out" — but this is from an unsorted `checkedInPlayers` list, not randomized per se. The admin has no choice of *which* player sits out — it's always the last one in the filtered array.

**Issue flagged: Admin cannot choose which player in an odd tier sits out. It's always the last player in the array. Should let admin pick.**

---

## 4. Manual pair editing within same tier
**Status: PASS**

PairEditor correctly enforces same-tier swaps (lines 85-86, 96-101 in PairEditor.tsx). Cross-tier attempts show a toast error. Waitlist-to-pair swaps also enforce tier matching. Lock confirmation works when `pairsLocked && hasCompletedGames`.

---

## 5. H2H tiebreaker in playoff seeding
**Status: PASS**

Both `startPlayoffs` (useGameState.ts line 1032) and `buildPairStandingsByTier`/`buildAllPairStandings` (StatsPlayoffs.tsx lines 180-183, 218-222) sort by: Win% → H2H → Games Played → Total Wins. The `getHeadToHead` function correctly checks completed matches between two specific pair IDs. Tiebreaker annotations display via tooltip.

---

## 6. 3-court mode: C isolated to Court 1, B never faces C
**Status: PASS**

Schedule generation (lines 524-532) uses `courtPool` filtering: Court 1 picks from `"C"` pool only, Courts 2-3 pick from `"AB"` pool. B vs C candidates are only generated when `courtCount === 2` (line 436-442). In 3-court mode, B only faces A.

However, the **auto-advance logic in `completeMatch`** (line 933) does NOT enforce court pool routing. It picks `updatedMatches.find(m => m.status === "pending" && ...)` — the first available pending match regardless of court pool. This means a C vs C match could be auto-assigned to Court 2 or 3 after completion, or a B vs A match could land on Court 1.

**Issue flagged: Auto-advance after match completion does not enforce 3-court routing rules. A C-tier match could be assigned to Court 2/3 or an A/B match to Court 1.**

---

## 7. Tier labels hidden from player-facing views
**Status: PASS with caveat**

CheckIn.tsx shows no tier labels. CourtDisplay shows no tier labels on court cards, Up Next, On Deck, or All Pairs sections. The All Pairs grid (lines 468-477) uses neutral styling with no tier indicators.

However, the **StatsPlayoffs** component (line 328) displays `Tier {pair.skillLevel}` on each pair card and the leaderboard headers say "Standings — Tier A (Advanced)" etc. This is acceptable since StatsPlayoffs is behind the PIN-protected admin view.

**No issue.**

---

## 8. Double-booking (player on two courts same slot)
**Status: PASS at generation, PARTIAL at runtime**

The schedule generator validates no double-booking (lines 546-559). At match completion, `completeMatch` checks `busyPlayerIdsSet` before assigning next match (lines 926-937). The `skipMatch` function does the same (lines 692-709).

However, neither `completeMatch` nor `skipMatch` verifies rest gap constraints when auto-advancing. They only check that no player is *currently playing* on another court, not that the player had a rest slot since their last game.

**Issue flagged: Auto-advance does not enforce the 2-slot rest gap. A player could finish a game and immediately be assigned the next one on the freed court (back-to-back).**

---

## 9. Back-to-back without rest slot
**Status: ISSUE — same as #8**

The initial schedule generation enforces a `REST_GAP = 2` (line 461, used at line 517). But the runtime auto-advance logic in `completeMatch` and `skipMatch` only checks for current court conflicts — it does **not** check whether a player just finished playing on another court.

**Issue flagged: Runtime auto-advance can schedule a player back-to-back. The rest gap is only enforced during initial schedule generation, not during auto-assignment after match completion.**

---

## 10. Schedule regeneration after roster change
**Status: PARTIAL**

- **Swap** (`swapPlayerMidSession`): Updates pair composition and syncs to non-completed matches. Does NOT regenerate or revalidate the schedule — it just swaps names in existing matches. No constraint revalidation.
- **Add** (`addPlayerMidSession`): Appends new matches to the end of the schedule. Does NOT check for rest gaps or court conflicts with existing pending matches.
- **Remove** (`removePlayerMidSession`): Filters out pending matches involving removed pair. Does NOT regenerate replacement matches for the now-idle opponents. Opponents lose scheduled games.

**Issue flagged: None of the three roster change operations perform full schedule revalidation (rest gaps, double-booking, duplicate matchups). They do inline updates but skip the constraint checks the initial generator enforces. The "Schedule regenerated" message is misleading — the schedule is modified, not regenerated.**

---

## Summary of Issues Found

| # | Severity | Issue |
|---|----------|-------|
| 1 | Minor | VIP dialog shows unchecked-in players as selectable partners |
| 3 | Minor | Admin cannot choose which odd-tier player sits out |
| 6 | **Major** | Auto-advance ignores 3-court routing (C→Court 1, AB→Courts 2-3) |
| 8/9 | **Major** | Auto-advance does not enforce rest gap — players can play back-to-back |
| 10 | **Medium** | Roster changes don't revalidate schedule constraints; removed players' opponents lose games |

Issues 6, 8, and 9 are the most critical as they can produce constraint violations during live sessions.

