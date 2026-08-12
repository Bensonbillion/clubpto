# PTO Americano — Court Manager v4 Brief (Wednesday)
The definitive design for Wednesday sessions. Rotating partners, individual scoring, two pooled courts, best-of-3 matches, system-decided playoffs, and an early-playoff valve instead of hard timing. Supersedes all pairs-based scheduling; persistence, publish pipeline, and visibility rules from COURT_MANAGER_ONBOARDING.md still stand. Sunday gets its own adaptation later — nothing here assumes it.
---
## 1. The Format
Everyone plays doubles but scores as an individual. Partners change every match. Players split into two **pools** by hidden tier — displayed only as **Court 1** and **Court 2**, never as skill labels. Play is **rolling**: a court finishes, the result goes in, the next four walk on. Matches are **best of 3 games**, recorded as **2–0 or 2–1**. Everyone plays the **exact same number of matches** (§3). Playoffs are built by the system from the standings — nobody picks anybody — and can be triggered **early** at any moment if the night is running long (§6).
**Why not the Americano Padel app:** it forces a full round robin (16 players = 15 rounds), it can't feed the PTO leaderboard and clubhouse, and it can't run two differently-configured pools with our playoff. Those gaps are the reason Court Manager exists.
---
## 2. Weekly Setup
Pool sizes are **weekly variables set by signups** — 16/12 one week, 14/14 the next, 12/12 or 12/16 another. Nothing is hard-coded. The admin loads the roster, the system proposes the split from hidden tiers, and the admin drags anyone between pools with the matches-each numbers updating live.
**Next session's example:**
| | Court 2 pool | Court 1 pool |
|---|---|---|
| Players | 16 | 12 |
| Matches each | 3 | 4 |
| Court matches | 12 | 12 |
| Playoff | Top 8 bracket | Optional (§5) |
**The exactness rule the setup screen enforces:** everyone in a pool plays the exact same number only when **pool size × target divides evenly by 4**. Pools of 12 or 16 work with any target. A pool of 14 cannot do 3 matches each (14 × 3 = 42 slots — doesn't divide); it works perfectly at 4 each (14 court matches). So the target selector only offers values that produce exact equality for that pool's size, with the court-match count shown beside each option. **A guarantee worth knowing: 4 matches each is valid for every even pool size** — so any even signup count always has at least one clean option, and the selector defaults to it when 3 doesn't divide. Signups are kept to even numbers on the operations side; the divisibility rule handles the rest.
The smaller pool getting more matches (or the same-size pools getting equal) is structural — fewer people sharing the same court time — and explains itself in one sentence.
---
## 3. The Match Engine
Whenever a court frees, for that court's pool:
1. **Select** — from players present, not on court, and below the match target, take the four with the fewest matches. Ties broken by longest wait.
2. **Rank** those four by record — always a valid comparison, because least-played-first hands you four players with equal matches.
3. **Pair** them **1st + 4th vs 2nd + 3rd**. If that repeats a partnership from tonight, fall back to 1+3 vs 2+4, then 1+2 vs 3+4.
4. **Play. Record. Repeat.**
**Why counts stay exact.** Least-played-first has a wave property: at any moment, every present player's match count is within 1 of every other's — the engine literally cannot let anyone fall two behind. Combined with even signups, everyone lands on exactly the target. The only things that can break exactness are a mid-session departure or an early playoff cut, and the standings chain (§4) is built to absorb both.
**Opening seeding:** nobody has a record yet, so the first wave is ordered by hidden tier — balanced opening quartets — then the leaderboard takes over permanently. Tiers are a seeding input, not a cage.
**Hard constraints, validated on every generation:** no player on two courts; nobody selected twice while a pool-mate with equal matches waits; no repeated partnership while an unused one exists; no back-to-back matches (except a late arrival's permitted catch-up, §7).
**Named trade of rolling play:** which four play *together* is driven by the queue (matches, then wait time), not by form. The pool already did the skill sorting and the 1+4/2+3 crossover balances every quartet — an acceptable trade for zero timers and courts that never wait on each other.
---
## 4. Scoring and Standings
Every match is best of 3. Entry is **two taps: the winning pair, then 2–0 or 2–1.**
Each player banks a **win or a loss**, plus **game differential**: +2 for a 2–0, +1 for a 2–1, −1 for a 1–2, −2 for a 0–2.
**Standings: wins → fewest losses → game differential → head-to-head → visible coin flip.**
Wins is the headline number — no win percentage anywhere. **Fewest losses is inert on a normal night** (equal matches means equal wins implies equal losses) **and exists purely for early cuts**: when the playoff is triggered before everyone finishes, players sit at k or k+1 matches, and 2W–0L rightly outranks 2W–1L. It's the mechanism that makes an early cut fair while still ranking by wins, exactly as decided.
Differential does the everyday separating and rewards decisiveness, per the locked rule: Chizea (2–0, 2–0, 0–2) and Benson (2–1, 2–1, 1–2) both sit at 2W–1L, but Chizea's +2 beats Benson's +1 — even though Benson won more individual games (5 to 4). Decisiveness over volume, which is why the metric is differential, not games won. It also works at the bottom: a 1–2 loss outranks a 0–2, so taking a game off a strong pair counts.
**Distribution check (example: 16 players, 12 matches):** 24 wins across 16 players lands roughly two on 3W, six on 2W, six on 1W, two on 0W — the top-8 cut falls in the 2W group, where differential spans about −1 to +3 and separates cleanly. Coin flips should be rare. The shape holds across realistic pool sizes.
Corrections: the match history log — tap any result, flip or re-enter, standings recompute.
---
## 5. The Playoff
**Top 8 by standings.** Eligibility: at least (pool leader's matches − 1) — the wave property means everyone present-from-start qualifies automatically; it only excludes very late arrivals.
**Pairing — locked: 1+3, 2+4, 5+7, 6+8.** Adjacent seeds within tiers: the top two pairs come out near-identical in strength (14 vs 13 in seed units), nobody in the top four carries a bottom-four partner, and finishing top four buys something real — a contender pair.
**Bracket — cross the tiers:**
```
SF1:  1+3  vs  6+8
SF2:  2+4  vs  5+7
F:    winners
```
Crossing keeps the two strong pairs apart until the final — the best match of the night by construction — while seeds 5–8 get a live shot at the upset. Playoff matches are best of 3 like everything else: three matches, sequential on the pool's court. If the other court is free (its pool finished, or has no playoff), the two semis run in parallel there and the playoff takes two slots instead of three.
**Scaling for smaller pools** (sizes vary weekly): a pool of 12+ runs the top-8 bracket above. A pool of 8–11 runs top 4 — 1+3 vs 2+4, single final. The system picks from the pool's size automatically.
**Court 1's playoff is a simple toggle: generate one, or don't.** The admin decides any time before triggering it. If no playoff is generated, Court 1's pool just keeps playing rolling matches (cap raised so everyone gets an extra), and its **champion is the standings leader as an individual**. Points unchanged either way: PTO Champion of the Week (100 each) for Court 2's winning pair; Court 1 Champion (40) for the pair, or the individual leader.
---
## 6. The Early Playoff Valve (the timing mechanism)
There is no hard timing in this system. No round clock, no horn, no load-bearing match length. Instead, **the admin can trigger a pool's playoff at any moment**, and the system makes it fair:
1. Tap **START PLAYOFF** on a pool. A confirm screen shows the situation plainly:
```
START COURT 2 PLAYOFF NOW?
14 of 16 players have 3 matches · 2 have 2 (David, Timi)
Standings will use W–L records — fewer losses ranks
higher at equal wins.
Top 8 right now: [list]
[START]   [KEEP PLAYING]
```
2. The match currently on court finishes and counts. No new round-robin matches are generated for that pool.
3. The bracket is built from the standings as they stand, using the full chain — which is exactly why **fewest losses** sits second in it: it's what makes k-match and (k+1)-match records comparable without touching win percentage.
The pools are independent, so cutting one early doesn't touch the other. A light, purely informational pace line on the admin screen ("Court 2: match 7 of 12, on pace to finish RR ~9:38") exists to inform the call — it enforces nothing.
This valve is the whole timing philosophy: **play until it's time, then cut, and the standings math makes the cut fair.**
---
## 7. People Logistics
**No check-in phase.** Load tonight's roster from the booking list and start. Everyone is presumed present.
**A name is called and they're not there:** tap → **Not here**. The next-least-played player swaps in instantly; the absent player moves to a **NOT ARRIVED** strip and stops being selected. **When they walk in:** tap them in the strip — zero matches puts them at the front of the queue, and one back-to-back is permitted so they can catch up. The exact-count guarantee applies to players present from the start; late arrivals get best-effort, and the eligibility rule handles the bracket honestly.
**Leaving early:** tap → **Left**. Removed from rotation, record preserved. If a departure breaks the divisible-by-4 arithmetic, the engine quietly fills the final matches with the longest-waiting players — at most one match over target for at most a couple of people, and the fewest-losses rule keeps the standings fair. This is the only path to unequal counts, and it's handled, not hidden.
**Below four present in a pool:** the system says so — never fails silently — and the admin waits or borrows a player from the other pool for one match.
---
## 8. The Admin Screen
```
COURT 2 · 16 players            COURT 1 · 12 players
match 7/12 · pace ~9:38          match 8/12 · pace ~9:30
Ade + Elvis                      Shana + Tofunmi
      vs                               vs
Chizea + Tami                    Samuel + Deborah
[ ENTER RESULT ]                 [ ENTER RESULT ]
NEXT UP: David, Donnell,         NEXT UP: Grace, Tunde,
Timi, Folarin                    Adaeze, Femi
[START PLAYOFF]                  [START PLAYOFF] [NO PLAYOFF]
────────────────────────────────────────────────
NOT ARRIVED (1): Duke · tap when they arrive
```
NEXT UP is load-bearing — it answers "when am I on?", the question that otherwise interrupts the admin forty times a night. Per-match admin workload: two taps and calling four names, about ten seconds.
**Day-of levers, all mid-session-safe:** trigger either playoff early (§6); toggle Court 1's playoff off (§5); raise a pool's match target when there's time to spare (the queue absorbs it instantly — never lower it); move a player between pools (record stays where earned, they enter the new pool at zero matches); play on casually after champions are crowned (extra matches don't touch the results).
---
## 9. What This Deletes and Keeps
**Deleted:** fixed pair generation; VIP entirely; timed rounds, horns, synchronization, and hard-stop enforcement; tier-based court isolation rules and distribution budgets; round decomposition; sub rotation and all odd-player handling (solved upstream by even signups); winner-stays-on; the mid-session late-check-in flow with schedule regeneration; pair-based standings and seeding; win percentage as a metric.
**Kept, more central than ever:** least-played-first; the match generator as a **pure function** with post-generation validation — the simulation suite lives here; localStorage-first persistence with resume; light pace measurement; the publish pipeline; the practice-session flag (a practice night runs identically and publishes nothing).
---
## 10. Clubhouse Knock-on
Champion of the Week is Court 2's winning pair; Court 1's champion is a pair or the individual leader depending on the toggle. PTO Points unchanged: 100 premier, 40 court title, finalists half (individual-leader champions have no finalist). Session standings publish as **wins, losses, and differential**. New personal stats come free — decisiveness, and *who you partnered with*, giving the rivalry feature a second dimension and the best belonging line the research surfaced: "you've partnered 14 different people this season." Milestones, privacy rules, publish pipeline: untouched.
---
## 11. Build Sequence
1. **Schema** — players as the unit of record; per-match pairings; per-pool standings (wins, losses, differential); match timestamps.
2. **The match generator as a pure function** — `(pool, history) → next match`: selection, ranking, pairing fallbacks, target convergence, departure fill rule, hard-constraint validation.
3. **Pool setup screen** — roster load, drag-between-pools, live matches-each arithmetic.
4. **Rolling court loop** — two-tap entry, instant regeneration, NEXT UP, informational pace line.
5. **People logistics** — Not-here swap, NOT ARRIVED strip, rejoin with catch-up, Left with fill rule.
6. **Standings** — wins → fewest losses → differential → H2H → visible coin flip; history-log corrections.
7. **Playoff module** — eligibility, 1+3/2+4/5+7/6+8, crossed bracket, parallel-semis when a court is free, **early trigger with the confirm screen**, Court 1 playoff toggle with individual-leader champion path.
8. **Delete the dead code** (§9).
9. **Publish pipeline update** — individual results, both champion shapes, practice flag respected.
**Simulation before it runs live:** run four scenarios. *Normal (16/12):* full night, assert everyone lands exactly on target, zero repeated partnerships while alternatives existed, no back-to-backs, top-8s ordered by the full chain. *Variable split (14/14, target 4):* assert the setup screen rejects target 3 for a 14-pool, offers 4, and the night converges everyone to exactly 4. *Early cut:* trigger Court 2's playoff mid-wave (14 players at 3, 2 at 2), assert the W–L chain seeds correctly and the confirm data matches reality. *Messy night:* one not-here swap on the opening match, one arrival after match 6, one departure after match 9 — assert the fill rule caps overage at one, the late arrival gets their catch-up back-to-back and correct eligibility, and standings stay coherent throughout.
