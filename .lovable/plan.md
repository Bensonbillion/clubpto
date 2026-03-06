

## End-to-End Browser Test: 3-Court Full Session on `/manage`

Instead of a separate test page, I'll use browser automation to walk through the **real `/manage` UI** — the same flow a Court Manager would use at a live session. Here's the 11-step plan:

### Test Flow

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Enter passcode 9999, navigate to Admin Setup, add 36 players (12A, 10B, 14C), mark Benson+Albright as VIP pair | All 36 visible in roster |
| 2 | Set 3-court mode, check in all 36, generate schedule | Schedule populates with matches |
| 3 | Inspect generated matches | Zero cross-tier: A vs A only, B vs B only, C vs C only |
| 4 | Check court assignments | Court 1 = C pool, Court 2 = B pool, Court 3 = A pool |
| 5 | Check pair game counts | No pair has 0 games, max-min gap ≤ 2 |
| 6 | Check slot conflicts | No player appears on 2 courts in same slot |
| 7 | Start session, complete all round-robin games by scoring each match | All matches completed |
| 8 | Add walk-in C pair (2 new players) mid-session | New pair gets C-pool matches only |
| 9 | Remove a player mid-session | No ghost matches referencing removed player |
| 10 | Start playoffs, inspect seeding | A-tier seeds first, B fills remaining, no C |
| 11 | Score through QF → SF → Final | Champion determined |

### Approach

This is a **browser automation task** — I'll use the subagent tool to interact with the live `/manage` preview, clicking through the actual UI, filling forms, and taking screenshots to verify each step. No code changes needed; this is pure testing.

### Limitation Note

Adding 36 players one-by-one through the UI will be slow via browser automation. If the Admin Setup has a bulk import or if we can pre-populate via the Player Manager database, that would speed things up significantly. Otherwise I'll work through the UI systematically.

