# Court Manager — Complete Developer Onboarding (v3, Final)

Everything you need to know to build, maintain, or extend the Club PTO Court Manager. This version replaces all earlier documentation. Where older material conflicts (85-minute sessions, 7-minute games, score entry, point-differential tiebreakers), this doc wins.

---

## 1. What Court Manager Is

Court Manager is a tablet-first web app that runs live padel sessions for Club PTO, a community padel league in Toronto. An admin stands courtside with an iPad and uses it to check in players, generate fair doubles matchups, run games across multiple courts, record winners, and execute playoffs — ending each session with a champion of the week.

It is not a booking system (booking is Acuity, external). It takes over the moment players walk in the door.

The admin is managing 24–36 real people on real courts. Every bug is visible to a crowd. If the schedule double-books someone, if one person gets 4 games while another gets 3, if the seeding is wrong — people notice immediately. **Reliability and fairness ARE the product.** The community has been burned by bugs; the mandate is zero-incident sessions, and the design bias everywhere is simple-but-flexible.

---

## 2. Design Philosophy

**Games-first, not time-first.** The product promise is that every player gets an equal, guaranteed number of games plus a playoff. The system's job is to protect that promise against the clock — by projecting continuously from measured reality and surfacing time decisions early, at natural boundaries, never as surprises.

**One gesture runs the whole night.** Every game in every mode ends the same way: the admin taps the winning pair. No scores, no forms, no per-game data entry beyond one tap. Round robin, winner-stays-on, playoffs — identical interaction. This is the simplicity thesis of the entire app.

**Structural guarantees over algorithmic vigilance.** Where a fairness rule can be made impossible to violate by architecture (isolated courts, atomic rounds), do that instead of policing it with logic.

**The admin always has final say.** The system recommends, warns, and projects. Humans confirm anything irreversible or socially sensitive.

---

## 3. Business Context & Real Session Parameters

### Wednesday — Mississauga (2-court mode)

- **8:00–10:00 PM. 120 minutes. Hard stop 10:00** (set at setup, editable live).
- 24 players = 12 pairs, 2 courts. $15 drop-in.
- On-court scoring (currently first to 7, win by 2) is decided **on the court by the players — the software never records points.** It only affects game duration, which the pace engine measures (~9 min/game estimated; replaced by measured data within two sessions).
- Target: **4 round-robin games each + playoffs.** Minimum guarantee: 3 + playoffs.
- Ball at 8:00 sharp. Check-in 7:40–7:55, pairs by 7:58. Start discipline is worth ~15 minutes and is the cheapest lever available.
- The honest math: 4 rounds ≈ 100–108 min at ~9 min/game + ~20 min playoffs — **round 4 is a coin flip most weeks**, which is exactly why the round-boundary decision point exists (section 6). If the community adopts a faster on-court format (e.g., golden point at 6-6), round 4 fits most weeks; the software is indifferent either way.

### Sunday — North York (3-court mode)

- 7:15 check-in, courts live ~7:30, wrap ~8:40. **~85-minute play window** (configurable + hard stop).
- 36 players, typical split 10A/12B/14C. $20 drop-in.
- Target: 3 games per pair + per-court playoffs. Court 1 (beginners) starts late after coach-led training.
- Measure Sunday's game durations separately — never reuse Wednesday's average.

### Shared

Skill tiers **A / B / C** are assigned by the admin, visible only in admin views (see section 10). Membership launching; sessions sell out over a week ahead.

---

## 4. Tech Stack & Architecture

- **React 18 + TypeScript + Vite** (Lovable.dev scaffold — do not migrate frameworks)
- **Tailwind + shadcn/ui**; **Supabase** for archive/sync; **localStorage is the live source of truth during sessions** (section 13)
- No state library — custom hooks

```
src/
├── pages/Manage.tsx            # /manage entry, passcode 9999
├── pages/Manage2.tsx           # /manage2 entry, passcode 7777
├── hooks/useGameState.ts       # all /manage game logic
├── hooks/useOpenGameState.ts   # all /manage2 game logic
├── components/manage/          # /manage UI
├── components/manage2/         # /manage2 UI
├── types/courtManager.ts       # shared types
└── integrations/supabase/      # client config
```

### Architectural Law #1: the scheduler is a pure function

All scheduling — round generation, matchup selection, validation — lives in standalone pure functions **outside React**: `(pairs, config, history) → schedule`. Non-negotiable, because the weekly simulation suite (section 15) must test the scheduler headlessly in seconds. Every historical scheduling bug survived as long as it did because logic was buried in a 2,700-line hook. The hook orchestrates; pure functions decide.

### Architectural Law #2: players have stable IDs

Every player has a unique ID; names are display labels. The shared roster already contains near-collisions ("Folarin" / "Folarin A"). Multi-week leaderboards, career stats, and the future tier-review system all silently corrupt without stable identity. Cheap now, miserable later.

Admin routes are passcode-gated, never linked from the public site, blocked in robots.txt. The public Club PTO site shares the repo but is a separate concern — changes never bleed either direction.

---

## 5. Core Domain Concepts

**Player** — id, name, tier, VIP flag, Coach flag, check-in status. One roster shared by both Court Managers.

**Tier** — A/B/C. Drives pairing, matchups, courts, and playoff priority in /manage; display-only in /manage2. Admin-eyes only, everywhere (section 10).

**VIP** — secretly picks their partner at check-in (same tier only). Partner not yet checked in → VIP holds pending until they arrive, then auto-locks. Mutual VIP picks lock instantly; conflicts resolve by check-in order. VIP locks are hard pairing constraints.

**Coach** — plays their normal games on their normal court; the flag only widens their minimum rest to 3 slots (normal: 1) so they can coach beginners between games. On winner-stays-on courts the queue creates the gaps naturally; flag is informational there.

**Pair** — two same-tier players (/manage) forming a doubles team. The scheduling unit.

**Round** — every pair plays exactly once. The atomic unit of Wednesday scheduling. 12 pairs on 2 courts: one round = 6 games = 3 slots ≈ 25–27 min.

**Slot** — one game window per court. The time axis.

**Game** — two pairs, one winner, timestamps. **No score is ever recorded.** Result = one tap on the winning pair.

**Sub** — the odd player out when a tier count is uneven; rotates in every 2 games (section 12).

**Practice Session** — a session-level flag set at setup: everything works identically (check-in, pairs, scheduling, winner taps, playoffs if wanted, within-session standings for the night's flow), but the session writes **nothing** to leaderboards, career stats, or multi-week records. Changeable until the first result is recorded; archived with `practice: true`. Exists in both Court Managers.

**Hard stop** — the venue-imposed end time. Set at setup, **editable mid-session** (venue says "you have until 10:15" → change it, every projection updates instantly).

---

## 6. Wednesday Scheduling: Round-Based Generation

**2-court mode schedules in complete rounds.** After any completed round, every pair has identical game counts — cut after round 3 and everyone has exactly 3. "Some pairs on 4 while others sit on 3" is structurally impossible, not policed.

### Mechanics

1. The scheduler solves one round at a time: a perfect matching of all 12 pairs into 6 games satisfying tier targets and no-repeat constraints.
2. Within a round, games are ordered across 2 courts × 3 slots so no pair plays back-to-back across the round boundary (least-played-first survives here as the ordering logic).
3. **Rounds are atomic.** Once started, a round finishes. The playoff trigger is physically blocked mid-round. An emergency escape exists (injury, venue issue): on-court games finish, the rest of the round cancels, uneven counts are loudly flagged, seeding falls back to pure Win% (which normalizes different game counts).

### Tier decomposition (verified for typical 8A/8B/8C = 4 pairs per tier)

Targets: A plays 3vA + 1vB · B plays 2vB + 1vA + 1vC · C plays 3vC + 1vB. **A never faces C.**

- **Rounds 1–2: pure same-tier** (2 AvA, 2 BvB, 2 CvC per round) — everyone warms up at their level.
- **Rounds 3–4: mixed** (1 AvA, 2 AvB, 2 BvC, 1 CvC per round).

Every budget closes exactly; each pair completes its full same-tier round robin plus one cross-tier game; **zero repeats needed in the base 4 rounds.** Uneven weeks bridge odd pairs through B; if a rematch is ever forced, pick a meaningful one (1st vs 2nd in tier standings) so it feels like a feature.

### The decision point — the only decision that matters all night

At the end of round 3 (~9:20), projected from **tonight's measured durations**:

> Round 4 ≈ 26 min + playoffs ≈ 20 min → projected finish **10:06**. Hard stop 10:00.
> **[PLAY ROUND 4]  [JUMP TO PLAYOFFS — everyone at 3 games]**

Both buttons carry a **one-tap confirm** showing the projection again — PLAY ROUND 4 commits 27 irreversible minutes and deserves a guard against fat fingers. The trend is visible from ~8:50; nothing is sprung at the boundary.

### Small-court math, byes, late arrivals

N pairs → max N−1 unique opponents; the setup screen states limits plainly ("4 pairs: max 3 games each without repeats"). 13 pairs → one bye per round, final counts 4-and-3, disclosed at setup ("11 get 4 games, 2 get 3"). Late arrivals join at the **next round boundary** and simply play fewer rounds — clean, understood, corrupts nothing.

---

## 7. Sunday Scheduling: Isolated Courts + Least-Played-First

3-court mode is fully isolated: **Court 1 = C, Court 2 = B, Court 3 = A. Zero cross-tier games.** Each court is a self-contained world — changes on one court never touch the others. This isolation deleted an entire bug class (cross-court conflicts impossible; A-vs-C block automatic).

Round-robin courts use **least-played-first slot-by-slot generation** per court: track `games_played` and `slots_since_last_game` (999 = never played = max priority); sort by fewest games, then longest wait; Team A = first pair not violating back-to-back; Team B = next pair excluding prior opponents; relax by 1 if stuck; leave a slot empty rather than force an invalid game. Guarantees: counts within 1 on a court; late pairs play within 1–2 slots; max sit-out 3 slots (4 with 7+ pairs).

**Independent court start:** courts start individually. Court 1 typically starts ~15 min late after coach-led training; its schedule generates from *remaining* time. WAITING courts show roster, elapsed time, live games-per-pair estimates. Reminder at 25 minutes unstarted.

**Winner Stays On** (Court 3/A, 5 pairs): a live queue — winner stays, loser to the back, ON DECK steps up, one tap on the winner. Tracks W-L, current streak 🔥, longest streak. UNDO for misclicks; reorderable queue. A loss = ~3-game (~21 min) wait — precisely the coaching window. **Open product decision:** optional streak cap (after 3 straight, defender rotates back, streak preserved on stats) to limit play-time drift; deliberate setting, not an accident.

---

## 8. The Pace Engine

The connective tissue between games-first promises and the clock. Every game start/end is timestamped; the engine keeps a rolling average of **actual durations per session** (never trusts the configured estimate once ~4 real games exist), continuously projects remaining rounds/slots + playoff time against the hard stop, and surfaces decisions early at natural boundaries. It warns, never acts. Because results are winner-only, duration comes purely from timestamps — the engine has no dependency on scoring whatsoever.

**Pause:** freezes game timers for interruptions (lights, first aid); on resume, projections account for lost minutes ("12 minutes lost — round 4 no longer fits, recommend jump after round 3").

Session summaries store the measured per-venue average, sharpening next week's setup projection.

---

## 9. Result Entry: Winner-Only

There is no score entry anywhere in the app. Every game ends with **one tap on the winning pair** — identical across round robin, winner-stays-on, and playoffs. A game record is: two pairs, winner, timestamps.

- **Corrections:** game history log; tap any completed game, flip the winner; all standings and seedings recalculate instantly.
- **Abandoned games** (injury, walk-off mid-game): an explicit **END GAME — ABANDONED** action with an admin choice — **VOID** (counts for nobody, slot recorded as unplayed) or **AWARD** to the remaining/healthy team. Never fake a result to close a game.
- On-court point format (to 7, win-by-2, golden point, anything) is the players' business; the software neither knows nor cares.

---

## 10. Visibility & Secrecy Rules (the social layer — never violate)

1. **Tier labels are NEVER visible to players.** Admin/Court Manager views only. The player-facing check-in is names listed alphabetically with a check-in tap — no tags, colors, or hints. Tier data persists in the backend but never leaks to any player-facing view. This rule is social, not technical: nobody wants to be publicly labeled a C.
2. **Player count summary IS player-visible** ("24 of 28 checked in") — always stripped of tier breakdown.
3. **VIP is invisible on both ends.** The VIP selection screen looks identical to normal check-in from a spectator's perspective — no VIP label anywhere player-facing. The chosen partner sees only a subtle "you've been paired" confirmation — **never who picked them or that it was a VIP pick.**
4. **The waitlist message is the only roster-status thing a player sees** ("You're on the waitlist — we'll get you in as soon as your partner arrives") — no tier label, even though the waitlist is tier-based underneath.
5. **Admin routes don't exist publicly.** No links, no references, robots.txt-blocked; passcodes are the only door.
6. **Tier colors (A gold, B silver, C bronze) are admin styling only.**

---

## 11. Playoffs

Manual trigger only; preview screen before committing; on Wednesday the trigger exists only at round boundaries; JUMP/START carries a confirm.

**Eligibility floor:** a pair must have played **at least 2 games** to qualify for playoffs (admin-overridable). Prevents a late pair's 1-0 (100%) from seeding #1 over a 3-1 pair. Applies in every mode, both Court Managers.

**Tiebreaker chain (winner-only era):** **Win% → head-to-head → strength of schedule (combined Win% of opponents faced) → coin flip.** SOS answers "who had the harder road" from winner-only data and keeps the admin out of choosing between friends; the coin flip is visible and animated — honest, and nobody argues with a coin. The applied tiebreaker is always displayed ("wins H2H"). Never raw win totals (historical bug: 7W-13L once seeded above 4W-0L). Point differential is dead — no scores exist.

**Wednesday (/manage 2-court) — unified top-8-player bracket:** all A players first, then B by Win% (C enters only via the override). **C-beat-B override:** a C player who beat a B player head-to-head takes that B player's spot and seeds above them — an H2H fact, fully supported by winner-only data. **The override exists only in 2-court mode; it is structurally impossible on Sunday's isolated courts** (C never plays B there). Bracket: seeds 1&8 vs 4&5, 2&7 vs 3&6 as doubles teams; simultaneous semis, then the final — the natural gathering moment.

**Sunday (/manage 3-court) — per-court brackets:** one button, three parallel playoffs. RR courts: top 4 pairs by Win% (same chain), #1v#4 / #2v#3, then final; <4 pairs → straight final. WSO court: **Final Challenge** (top 2 by wins, one decider) or "crown current leader." A late-started court still in RR is skipped and offered its playoff when ready. Champions: "PTO Champion" (A), "B Champion," "C Champion."

**/manage2:** pure Win% seeding, no tier priority. 1-court: top 4. 2-court: top 8, quarters split across courts.

---

## 12. Edge Cases (where sessions actually break)

**Late arrivals** — the #1 real event. Always-available late check-in. Wednesday: join at the next round boundary. Sunday: two same-tier lates auto-pair with max priority; one late + existing sub auto-pairs; one late alone becomes the sub or waits on a visible waitlist; WSO appends to queue. Confirmation screens preview the outcome before committing.

**Odd players / sub rotation** — sub sits 2 games, then replaces the player with most games / fewest sub-outs; replaced player becomes the new sub. Admin prompt: confirm / pick different / skip. **The prompt waits indefinitely for a human — NO auto-confirm.** A machine benching someone who then walks onto court is socially unacceptable; the prompt escalates visually until answered.

**Player leaves** — completed results preserved forever; future games voided; partner becomes sub / pairs with sub / leaves too. Only the affected court or round context regenerates.

**Wrong tier mid-session** — "Move to Court X" = removal + late-arrival flow at the destination.

**Session clock** — always derived from a stored start timestamp. Never a decrementing counter.

**Tablet death — RESUME SESSION** — any device can pull the last synced state, with honest freshness: "last synced 90 seconds ago — up to 1 result may be missing; check game history." Battery death mid-session is a when, not an if.

**Single-writer policy** — one device is the writer; concurrent admin edits from multiple devices are a conflict factory and are out of scope by policy. (A read-only spectator display is a possible later add.)

---

## 13. State Persistence: localStorage-First, Supabase as Background Sync

The venue's wifi is the least reliable component in the stack, so during a live session **the tablet is the source of truth**:

- **Every state change writes to localStorage synchronously, first.**
- **Supabase syncs in the background** with a small "sync pending" indicator. Its roles: cross-session archive, the shared roster, and RESUME recovery.
- Load order: active local session resumes from localStorage; otherwise Supabase; defaults last. Never conditionally render core controls on load state — render last-known values disabled rather than hidden (the historical "vanished toggle" bug was exactly this).
- Persisted: mode & per-court formats, practice flag, hard stop, per-court start timestamps, roster + flags (by player ID), pairs, round/schedule state, results, standings, WSO queues/streaks, sub rotation state, waitlists, playoff brackets, measured durations, session archive.

---

## 14. Setup Ergonomics

**Session templates:** "Wednesday Mississauga" and "Sunday North York" as one-tap presets — court count, length, hard stop, targets, format defaults pre-filled. Kills setup errors at 7:55.

**Check-in at scale:** the shared roster grows forever. Search bar; recent-players-first sort; ideally a "tonight's expected" list pre-loaded from Acuity bookings so the door is tap-tap-tap.

**Balance warnings before start:** courts with <3 pairs ("limited variety — max N−1 games without repeats"), >8 pairs ("players may get 2 games"), odd counts ("sub rotation — sub: [name]"), heavy imbalance. Advisory, never blocking.

---

## 15. The Weekly Ritual (mandated)

**Before every session night, run the simulation suite against the pure-function scheduler with that week's actual numbers** — real tier counts, a late-arrival injection, a mid-session removal, an abandoned game. Ten minutes on Saturday catches what would otherwise be a live incident in front of the whole community. A week without a green run is a session running on hope. This is why Architectural Law #1 exists.

---

## 16. History & Bug Patterns (learn from the scars)

Evolution: GOOD/BEGINNER → A/B/C tiers → 2-court tier rules → shared-pool 3-court → isolated 3-court + WSO + least-played-first → games-first + round-based Wednesday + pace engine → **winner-only results + simplicity pass** (current, July 2026).

1. **Double-booking** → three-layer defense: generation check, post-generation validation, runtime guard.
2. **Toggle reset on refresh** → localStorage-first persistence.
3. **Seeding by total wins** → Win% first, chain displayed.
4. **`syncPairsToMatches` corrupting history** → any function touching matches skips completed ones, first line.
5. **Back-to-back violations in 3-court** → rest checks span all courts.
6. **Static matchup penalties starving B of A opponents** → superseded by round decomposition.
7. **VIP picks ignored** → VIP locks are hard constraints.
8. **Uneven counts / stranded lates** → solved structurally (rounds; least-played-first).
9. **Load-bearing time assumptions nothing verified** → games-first + pace engine measuring reality.
10. **Complexity itself** → scoring removed entirely; one-tap winners; every feature filtered through "simple but flexible."

Meta-lessons: structural guarantees over vigilance; completed data is sacred; validate every generation and print specifics; time must be measured, not trusted; when a feature adds admin workload per game, question it.

---

## 17. Design System

Dark green/gold Club PTO aesthetic, tablet-first: backgrounds `#1A1A1A` / elevated `#2D2D2D`; text `#F5F0EB` / muted `#A8A29E`; accent gold `#C9A84C`. Tier colors admin-only. Touch targets ≥44px. Primary actions (**tap-the-winner buttons**, PLAY ROUND 4 / JUMP TO PLAYOFFS with confirm, START COURT, RESUME SESSION) are large and unmissable. Pace warnings prominent but calm. WSO courts visually distinct from RR; WAITING courts styled as standby, not error. Practice sessions carry a persistent subtle "PRACTICE — results don't count" badge in admin views. /manage2 header reads "PTO OPEN"; otherwise identical patterns.

---

## 18. The Two Court Managers

| | /manage (original) | /manage2 (open mode) |
|---|---|---|
| Passcode | 9999 | 7777 |
| Court modes | 2-court, 3-court | 1-court, 2-court |
| Tier rules | Enforced | None — display-only |
| Pairing | Within tier | Cross-tier allowed |
| Playoff seeding | Tier priority + Win% (+ C-beat-B in 2-court) | Pure Win% |
| Practice mode | Yes | Yes |
| Player roster | **Shared** (stable IDs) | **Shared** |
| Session state | Own storage | Own storage |

Shared roster, isolated session state — both run simultaneously with zero interference. Everything else (round/LPF scheduling, WSO, pace engine, winner-only entry, eligibility floor, late arrivals, sub rotation, playoffs, practice mode, templates, resume, summary + WhatsApp export) exists in both.

---

## 19. Build Order (from scratch)

1. **Data model + persistence:** stable player IDs, all types, localStorage-first writes with background Supabase sync, timestamp clocks, RESUME flow.
2. **Pure-function scheduler + validator + simulation harness** (same day): round matcher (Wednesday) and least-played-first (Sunday); hard constraints — no double-booking, no back-to-back, no duplicate matchups, A never faces C — with specific-violation logging.
3. **Check-in + pair generation:** VIP double-blind flow, coach flags, sub detection, search + templates, balance warnings with small-court disclosures.
4. **Single-court play loop:** NOW PLAYING → tap the winner → advance → standings. Flip-winner correction. Abandoned game (VOID / AWARD).
5. **Rounds + decision point** (Wednesday): atomic rounds, boundary-only playoff jump, confirm guards, emergency escape.
6. **Pace engine:** duration logging, rolling average, projection vs editable hard stop, pause.
7. **Multi-court + 3-court isolation + independent start.**
8. **Winner Stays On:** queue, streaks, undo.
9. **Edge-case suite:** late arrivals (boundary-join / LPF-insertion), sub rotation (human-confirmed), removal, court move.
10. **Playoffs:** eligibility floor; Win% → H2H → SOS → visible coin flip; C-beat-B override (2-court only); per-court brackets + Final Challenge (Sunday).
11. **Practice mode flag + summary + WhatsApp export + archive** (with measured durations).
12. **/manage2 fork:** copy, strip tier enforcement, separate session state, shared roster.

Test every stage against real session shapes — Wednesday: 24 players 8A/8B/8C, ball at 8:00, a pair arriving mid-round-2, games averaging 9.4 minutes, the round-3 decision landing on "jump," one abandoned game. Sunday: 36 players 10A/12B/14C, Court 1 starting 15 late, two lates at game 5, one departure at game 8, a tablet refresh at 8:10. None of that is an edge case. That is a normal week.
