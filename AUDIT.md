# CLUB PTO — Full Codebase Audit Report

**Generated:** 2026-03-03
**Scope:** Every file in `/src`, all config files, full feature map, all known bugs

---

## SECTION 1 — PROJECT ARCHITECTURE

### Framework & Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React 18.3.1 + Vite 5.4.19 | SWC transpiler |
| Language | TypeScript 5.8.3 | strict: false for app, true for build tools |
| CSS | Tailwind CSS 3.4.17 | + tailwindcss-animate, @tailwindcss/typography |
| UI Library | shadcn/ui (51 components) | Radix UI primitives |
| Animation | Framer Motion 12.34.5 + GSAP 3.14.2 + Lenis 1.0.42 | |
| Routing | React Router DOM 6.30.1 | BrowserRouter, 12 routes |
| State | useState/useCallback hooks + Supabase realtime | Single `game_state` row |
| Database | Supabase (PostgreSQL) | Project: flahcijysipymafazhxq (club-owned) |
| Data Fetching | TanStack React Query 5.83.0 | For sessions queries |
| Forms | React Hook Form 7.61.1 + Zod 3.25.76 | |
| Hosting | Vercel (project `clubpto-site`) | auto-deploys from `main` |
| PWA | vite-plugin-pwa 1.2.0 | Workbox, 5MB cache |

### State Management Approach
- **Primary:** `useState` in `useGameState.ts` hook — single `GameState` object holds everything
- **Persistence:** Supabase `game_state` table (single row, id="current")
- **Sync:** Realtime subscription + 10-second polling fallback
- **No localStorage fallback** — if Supabase is unreachable, state resets to defaults
- **No Redux/Zustand/Context** — all game state flows through the `useGameState` hook

### All Dependencies (package.json)

**Production (70 packages):**

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` 18.3.1 | UI framework |
| `react-router-dom` 6.30.1 | Client-side routing |
| `@supabase/supabase-js` 2.90.1 | Backend client (auth, DB, realtime) |
| `@tanstack/react-query` 5.83.0 | Data fetching & caching |
| `framer-motion` 12.34.5 | Component-level animations |
| `gsap` 3.14.2 | Advanced scroll-driven animations |
| `@studio-freight/lenis` 1.0.42 | Smooth scrolling |
| `react-hook-form` 7.61.1 | Form state management |
| `@hookform/resolvers` 3.10.0 | Zod ↔ RHF bridge |
| `zod` 3.25.76 | Schema validation |
| `lucide-react` 0.462.0 | SVG icon library |
| `recharts` 2.15.4 | Data visualization charts |
| `sonner` 1.7.4 | Toast notifications |
| `next-themes` 0.3.0 | Dark/light mode |
| `date-fns` 3.6.0 | Date utilities |
| `clsx` 2.1.1 | Conditional classNames |
| `tailwind-merge` 2.6.0 | Tailwind class conflict resolution |
| `cmdk` 1.1.1 | Command palette |
| `vaul` 0.9.9 | Drawer/modal animations |
| `input-otp` 1.4.2 | OTP input component |
| `embla-carousel-react` 8.6.0 | Carousel/slider |
| `react-day-picker` 8.10.1 | Calendar component |
| `react-resizable-panels` 2.1.9 | Draggable panel layouts |
| `@radix-ui/*` (24 packages) | Headless UI primitives |

**Dev (17 packages):**

| Package | Purpose |
|---------|---------|
| `vite` 5.4.19 | Build tool |
| `@vitejs/plugin-react-swc` | SWC transpiler plugin |
| `typescript` 5.8.3 | Type checking |
| `vitest` 4.0.18 | Test runner |
| `eslint` 9.32.0 | Linting |
| `tailwindcss` / `postcss` / `autoprefixer` | CSS pipeline |

### Folder Structure (2 levels)
```
src/
├── __tests__/
│   └── court-manager-simulation.test.ts    (933 lines)
├── assets/                                  (images, logos)
├── components/
│   ├── about/        (4 files: StorySection, FounderStory, WhatIsPadel, Values)
│   ├── home/         (8 files: Hero, Manifesto, ExperienceArc, MembershipTeaser, WhatsOn, CommunityProof, EmailCapture, FinalCTA)
│   ├── layout/       (4 files: PublicLayout, Header, Footer, PageWrapper)
│   ├── manage/       (12 files: AdminSetup, CheckIn, CourtDisplay, StatsPlayoffs, GameHistoryLog, PlayoffBracket, SessionExport, ManageRosterDrawer, PairEditor, VipPairingDialog, OddPlayerAlert, CourtConflictAlert)
│   ├── ui/           (51 shadcn components)
│   ├── Hero.tsx, FAQ.tsx, BookingSection.tsx, HowItWorks.tsx, PhotoGallery.tsx  (legacy)
│   ├── Layout.tsx, MobileNav.tsx, NavLink.tsx, ScrollToTop.tsx, StickyBookCTA.tsx
├── hooks/
│   ├── useGameState.ts       (2,745 lines — scheduling engine)
│   ├── useGameState.test.ts  (519 lines — unit tests)
│   ├── useSessions.ts        (32 lines — session queries)
│   ├── useSmoothScroll.ts    (33 lines — Lenis init)
│   ├── use-toast.ts          (shadcn)
│   └── use-mobile.tsx        (shadcn)
├── integrations/
│   └── supabase/
│       ├── client.ts          (17 lines — Supabase client)
│       └── types.ts           (381 lines — auto-generated DB types)
├── lib/
│   ├── animations.ts          (53 lines — Framer Motion variants)
│   ├── constants.ts           (35 lines — colors, nav, club info)
│   ├── utils.ts               (7 lines — cn() helper)
│   ├── leaderboard.ts         (202 lines — points & rankings)
│   └── leaderboard.test.ts    (114 lines)
├── pages/
│   ├── Index.tsx, About.tsx, Book.tsx, FAQPage.tsx, Membership.tsx
│   ├── Events.tsx, Community.tsx, Install.tsx, NotFound.tsx
│   ├── Leaderboard.tsx, Profile.tsx
│   └── Manage.tsx             (156 lines — passcode gate + tabs)
├── test/
│   └── setup.ts               (Vitest config)
├── types/
│   └── courtManager.ts        (127 lines — GameState types)
├── App.tsx                     (54 lines — route config)
├── main.tsx                    (10 lines — entry point)
└── index.css                   (Tailwind + CSS vars)
```

---

## SECTION 2 — FILE MAP

### Pages

| File | Lines | Purpose | Category | Flags |
|------|-------|---------|----------|-------|
| `pages/Index.tsx` | 27 | Homepage — composes Hero through FinalCTA | UI | |
| `pages/About.tsx` | 19 | About page — story, padel, values | UI | |
| `pages/Book.tsx` | 286 | Booking — session picker, customer form, Supabase insert | UI + logic | |
| `pages/FAQPage.tsx` | 93 | FAQ accordion | UI | |
| `pages/Membership.tsx` | 391 | Membership tiers, billing toggle, benefits, FAQ | UI | **NEEDS SPLITTING** |
| `pages/Events.tsx` | 228 | Events with category filtering | UI | |
| `pages/Community.tsx` | 166 | Photo gallery, stats, Instagram CTA | UI | |
| `pages/Install.tsx` | 154 | PWA installation guide per platform | UI | |
| `pages/Leaderboard.tsx` | 162 | Weekly leaderboard with auto-refresh (30s polling) | UI + logic | |
| `pages/Profile.tsx` | ~80 | Player profile with stats and points ledger | UI + logic | |
| `pages/Manage.tsx` | 156 | Passcode gate (9999), 4-tab admin interface | UI + logic | |
| `pages/NotFound.tsx` | 25 | 404 page | UI | |

### Layout Components

| File | Lines | Purpose | Category |
|------|-------|---------|----------|
| `components/layout/PublicLayout.tsx` | 21 | Wrapper: Header + Outlet + Footer + Lenis | UI |
| `components/layout/Header.tsx` | 159 | Responsive nav, hide-on-scroll, mobile menu | UI |
| `components/layout/Footer.tsx` | 121 | 4-column footer, newsletter, social links | UI |
| `components/layout/PageWrapper.tsx` | 33 | Page transition (opacity 0.4s) + scroll-to-top | UI |

### Home Components

| File | Lines | Purpose | Category |
|------|-------|---------|----------|
| `components/home/Hero.tsx` | 100 | "CLUB PTO" hero, dual CTAs, scroll indicator | UI |
| `components/home/Manifesto.tsx` | 73 | GSAP word-by-word scroll reveal | UI |
| `components/home/ExperienceArc.tsx` | 79 | 4-block feature section, alternating layout | UI |
| `components/home/MembershipTeaser.tsx` | 117 | 3-tier preview cards | UI |
| `components/home/WhatsOn.tsx` | 103 | 3 upcoming events | UI |
| `components/home/CommunityProof.tsx` | 78 | 8-item photo gallery | UI |
| `components/home/EmailCapture.tsx` | 50 | Email subscribe form (no backend) | UI |
| `components/home/FinalCTA.tsx` | 38 | Final join/reserve CTA | UI |

### About Components

| File | Lines | Purpose | Category |
|------|-------|---------|----------|
| `components/about/StorySection.tsx` | 29 | "More than a club" hero | UI |
| `components/about/FounderStory.tsx` | 65 | Founder narrative + image placeholder | UI |
| `components/about/WhatIsPadel.tsx` | 68 | Sport education, 3 stat cards | UI |
| `components/about/Values.tsx` | 60 | 3 core values | UI |

### Manage Components (DO NOT TOUCH)

| File | Lines | Purpose | Category | Flags |
|------|-------|---------|----------|-------|
| `manage/AdminSetup.tsx` | 446 | Roster, config, AI pairing, reset | UI + logic | **NEEDS SPLITTING** |
| `manage/CheckIn.tsx` | 492 | Check-in grid, VIP dialog, odd players, dynamic mode | UI + logic | **NEEDS SPLITTING** |
| `manage/CourtDisplay.tsx` | 648 | Court cards, timers, queue, standings, history | UI + logic | **NEEDS SPLITTING** |
| `manage/StatsPlayoffs.tsx` | 403 | Leaderboards, seeding, playoff bracket | UI + logic | **NEEDS SPLITTING** |
| `manage/ManageRosterDrawer.tsx` | 298 | Mid-session swap/add/remove | UI + logic | |
| `manage/PairEditor.tsx` | 310 | Swap players between pairs | UI + logic | **NEEDS SPLITTING** |
| `manage/OddPlayerAlert.tsx` | 173 | Handle odd-numbered tiers | UI + logic | |
| `manage/PlayoffBracket.tsx` | 169 | 8-team single-elim bracket | UI | |
| `manage/SessionExport.tsx` | 157 | Copy/share results to WhatsApp/iMessage | UI | |
| `manage/GameHistoryLog.tsx` | 110 | Completed games log with flip/correct | UI + logic | |
| `manage/VipPairingDialog.tsx` | 94 | VIP partner selection modal | UI | |
| `manage/CourtConflictAlert.tsx` | ~50 | Cross-court conflict warning | UI | |

### Hooks

| File | Lines | Purpose | Category | Flags |
|------|-------|---------|----------|-------|
| `hooks/useGameState.ts` | 2,745 | Complete scheduling engine | Business logic | **NEEDS SPLITTING** (but risky) |
| `hooks/useGameState.test.ts` | 519 | Unit tests for exported functions | Test | |
| `hooks/useSessions.ts` | 32 | Fetch upcoming sessions via React Query | Utility | |
| `hooks/useSmoothScroll.ts` | 33 | Lenis + GSAP ScrollTrigger init | Utility | |

### Libraries

| File | Lines | Purpose | Category |
|------|-------|---------|----------|
| `lib/animations.ts` | 53 | Framer Motion variants (fadeUp, slideIn, etc.) | Utility |
| `lib/constants.ts` | 35 | Colors, nav items, social links, club info | Config |
| `lib/utils.ts` | 7 | cn() — clsx + tailwind-merge | Utility |
| `lib/leaderboard.ts` | 202 | Points system, weekly rankings, player profiles | Business logic |

### Potentially Dead Code

| File | Reason |
|------|--------|
| `components/Hero.tsx` | Superseded by `home/Hero.tsx` |
| `components/FAQ.tsx` | Superseded by `pages/FAQPage.tsx` |
| `components/BookingSection.tsx` | Superseded by `pages/Book.tsx` |
| `components/PhotoGallery.tsx` | Superseded by `Community.tsx` + `CommunityProof.tsx` |
| `components/HowItWorks.tsx` | Not imported by any file |
| `components/NavLink.tsx` | Not imported by any file |
| `components/ScrollToTop.tsx` | Not imported by any file |

### Files Over 300 Lines (Splitting Candidates)

| File | Lines | Recommendation |
|------|-------|----------------|
| `hooks/useGameState.ts` | 2,745 | Extract scheduling to `lib/scheduling.ts` |
| `__tests__/court-manager-simulation.test.ts` | 933 | OK for test file |
| `manage/CourtDisplay.tsx` | 648 | Extract SessionClock, GameTimer, CourtCard, MiniStandings |
| `hooks/useGameState.test.ts` | 519 | OK for test file |
| `manage/CheckIn.tsx` | 492 | Extract VipFlow, OddTierHandler, DynamicFooter |
| `manage/AdminSetup.tsx` | 446 | Extract AiAssistant, BulkAdd, ResetControls |
| `manage/StatsPlayoffs.tsx` | 403 | Extract PairLeaderboard, SeedingDisplay |
| `pages/Membership.tsx` | 391 | Extract TierCard, BenefitsGrid, MembershipFAQ |
| `manage/PairEditor.tsx` | 310 | Borderline |
| `manage/ManageRosterDrawer.tsx` | 298 | Borderline |

---

## SECTION 3 — COURT MANAGER FEATURE MAP

### Player Management

| Feature | Status | Notes |
|---------|--------|-------|
| Player roster with name, tier (A/B/C), VIP flag | ✅ IMPLEMENTED | AdminSetup.tsx; VIP_NAMES hardcoded: david, benson, albright |
| Player check-in (tablet-friendly UI) | ✅ IMPLEMENTED | CheckIn.tsx; large tappable buttons, 5-col grid on lg |
| VIP partner selection | ✅ IMPLEMENTED | VipPairingDialog.tsx; same-tier filter, randomize option |
| Waitlist for odd-numbered tiers | ✅ IMPLEMENTED | OddPlayerAlert.tsx; sit_out / cross_pair / waiting options |
| Late player check-in after games started | ✅ IMPLEMENTED | handleLateCheckIn(); auto-pairs with same-tier waitlisted or creates waitlist entry |
| Mid-session player swap | ✅ IMPLEMENTED | ManageRosterDrawer.tsx swap tab; swapPlayerMidSession() |
| Mid-session player removal | ✅ IMPLEMENTED | ManageRosterDrawer.tsx remove tab; removePlayerMidSession() |
| Manual pair editing | ✅ IMPLEMENTED | PairEditor.tsx; inter-pair swaps, waitlist swaps, lock pairs |

### Session Configuration

| Feature | Status | Notes |
|---------|--------|-------|
| 2-court mode toggle | ✅ IMPLEMENTED | AdminSetup.tsx; courtCount in sessionConfig |
| 3-court mode toggle | ✅ IMPLEMENTED | Same toggle, courtCount: 2 or 3 |
| Mode persists on page refresh | ⚠️ PARTIAL | Persisted to Supabase, but defaults to 2 if Supabase load fails (no localStorage fallback) |
| Session timer (85 min, timestamp-based) | ✅ IMPLEMENTED | CourtDisplay.tsx SessionClock; based on sessionStartedAt |
| Session phases: Setup → Check-in → Round Robin → Playoffs | ✅ IMPLEMENTED | State-driven via sessionStarted, playoffsStarted flags |
| Passcode protection (9999) | ✅ IMPLEMENTED | Manage.tsx PasscodeGate; guards Admin Setup & Stats tabs |

### Pair Generation

| Feature | Status | Notes |
|---------|--------|-------|
| Auto-pair players within same tier | ✅ IMPLEMENTED | generateFullSchedule() Step 1; tier-independent pairing |
| VIP pair locks | ✅ IMPLEMENTED | fixedPairs honored first in pairing loop |
| Odd-tier waitlisting | ✅ IMPLEMENTED | Last unpaired player auto-waitlisted per tier |
| Random pairing for non-VIP | ✅ IMPLEMENTED | Fisher-Yates shuffle, avoids recent pairings (2-week history) |

### Schedule Generation (2-Court Mode)

| Feature | Status | Notes |
|---------|--------|-------|
| Generates full round-robin schedule | ✅ IMPLEMENTED | generateFullSchedule() with 12 slots × 2 courts |
| No cross-court conflicts | ✅ IMPLEMENTED | Slot player ID check in pickBestCandidate() |
| No back-to-back games | ✅ IMPLEMENTED | REST_GAP=2, blocks players from 2 previous slots |
| No duplicate matchups | ✅ IMPLEMENTED | usedMatchups Set tracks all pair-vs-pair keys |
| A-vs-A matchups (majority of A games) | ✅ IMPLEMENTED | tierTargets A: {vsA:3, vsB:1, vsC:0} |
| B-vs-B matchups | 🐛 BUGGY | B-vs-B candidates generated in ALL modes; spec says B never faces B in 2-court |
| B-vs-A matchups (1 per B pair) | ✅ IMPLEMENTED | tierTargets B: {vsA:1} + cross-tier hard-block at target |
| B-vs-C matchups (1 per B pair) | ✅ IMPLEMENTED | tierTargets B: {vsC:1}; B-vs-C candidates only in 2-court |
| C-vs-C matchups (majority of C games) | ✅ IMPLEMENTED | tierTargets C: {vsC:3, vsB:1} |
| A NEVER faces C (hard block) | ✅ IMPLEMENTED | A-vs-C candidates never generated; isForbiddenMatchup() check |
| Target: 4 games per pair | ✅ IMPLEMENTED | TARGET_GAMES_PER_PAIR=4, MAX_GAMES=5 |
| Same-tier games scheduled earlier | ✅ IMPLEMENTED | Deficit scoring naturally prefers same-tier first |

### Schedule Generation (3-Court Mode)

| Feature | Status | Notes |
|---------|--------|-------|
| Court 1 = Tier C only | ✅ IMPLEMENTED | courtPool: "C" filter in pickBestCandidate() |
| Courts 2&3 = Tier A and B only | ✅ IMPLEMENTED | courtPool: "AB" filter |
| No C player ever on Courts 2 or 3 | ✅ IMPLEMENTED | Pool isolation enforced at candidate generation |
| No A or B player ever on Court 1 | ✅ IMPLEMENTED | Same pool isolation |
| B-vs-B matchups on Courts 2&3 | ✅ IMPLEMENTED | B-vs-B candidates have courtPool: "AB" |
| B-vs-A matchups on Courts 2&3 (1 per B pair) | ✅ IMPLEMENTED | tierTargets B: {vsA:1} with cross-tier hard-block |
| B NEVER faces C in 3-court | ✅ IMPLEMENTED | B-vs-C candidates only generated if courtCount===2 |
| A NEVER faces C in 3-court | ✅ IMPLEMENTED | A-vs-C candidates never generated |
| Target: 3 games per pair | ✅ IMPLEMENTED | TARGET_GAMES_PER_PAIR=3, MAX_GAMES=4 |
| No cross-court conflicts across all 3 | ✅ IMPLEMENTED | Slot-level player ID tracking across all courts |
| No back-to-back across all 3 | ✅ IMPLEMENTED | REST_GAP=1 for 3-court (2-group alternation) |
| Court 1 may have empty slots | ✅ IMPLEMENTED | C-pool match is first pick per slot; if -1, slot has no C game |

### Late Arrival Handling

| Feature | Status | Notes |
|---------|--------|-------|
| Late player added to correct tier waitlist | ✅ IMPLEMENTED | handleLateCheckIn() adds to waitlistedPlayers |
| Auto-pair when second late player arrives | ✅ IMPLEMENTED | Finds same-tier waitlisted partner |
| New pair inserted into FUTURE schedule only | ✅ IMPLEMENTED | insertMatchesAfterFreezeLine() respects freeze line |
| Completed games untouched | ✅ IMPLEMENTED | Freeze line starts after all non-pending matches |
| "On Deck" game untouched | ✅ IMPLEMENTED | Freeze line = courtCount × 2 pending matches |
| New pair gets first game within 2-3 slots | ✅ IMPLEMENTED | Early insertion attempted before fallback append |
| All constraints maintained after regen | ✅ IMPLEMENTED | Same pickBest/commit pattern |
| Works in 2-court mode | ✅ IMPLEMENTED | |
| Works in 3-court mode (pool isolation) | ✅ IMPLEMENTED | Pool routing respected for late pairs |

### Score Tracking & Standings

| Feature | Status | Notes |
|---------|--------|-------|
| Record game results (winner/loser) | ✅ IMPLEMENTED | completeMatch() with WinnerModal in CourtDisplay |
| Win/loss record per pair | ✅ IMPLEMENTED | Pair.wins/losses updated on completion |
| Win percentage calculation | ✅ IMPLEMENTED | winPct = wins / gamesPlayed |
| Standings update after each game | ✅ IMPLEMENTED | State updates propagate immediately |
| Standings display sorted by Win% | ✅ IMPLEMENTED | StatsPlayoffs.tsx PairLeaderboard; sorted by winPct |

### Playoff Seeding

| Feature | Status | Notes |
|---------|--------|-------|
| Top 8 from A and B tiers enter playoffs | ✅ IMPLEMENTED | startPlayoffs() builds standings, takes top 8 |
| Seeding by wins → win% → tier → H2H | ✅ IMPLEMENTED | Multi-criteria sort in startPlayoffs() |
| H2H tiebreaker | ✅ IMPLEMENTED | getHeadToHead() checks completed matches |
| C-beat-B override (C promoted if beat B H2H) | ✅ IMPLEMENTED | "beat-up" promotion logic in startPlayoffs() |
| Tiebreaker reason displayed | ✅ IMPLEMENTED | annotateTiebreakers() in StatsPlayoffs.tsx |
| Bracket: #1v#8, #2v#7, #3v#6, #4v#5 | ✅ IMPLEMENTED | NBA-style seeding |
| Doubles: (1&8 vs 4&5), (2&7 vs 3&6) | ✅ IMPLEMENTED | Second round pairing logic |
| C players do NOT have separate playoff | ✅ IMPLEMENTED | Single unified bracket (by design) |
| Point differential tiebreaker | ❌ MISSING | No score tracking (only win/loss) |
| Games played tiebreaker | ⚠️ PARTIAL | Sort considers tier before games played |

### Playoff Execution

| Feature | Status | Notes |
|---------|--------|-------|
| Semifinal games on Courts 2&3 | ✅ IMPLEMENTED | Auto-assigned in startPlayoffs() |
| Winners auto-advance to final | ✅ IMPLEMENTED | completePlayoffMatch() generates next round |
| Final game | ✅ IMPLEMENTED | Last round in bracket |
| Champion crowned | ✅ IMPLEMENTED | PlayoffBracket.tsx shows trophy + champion banner |
| Court 1 idle during playoffs | ✅ IMPLEMENTED | Playoffs only use Courts 2&3 |

### State Persistence

| Feature | Status | Notes |
|---------|--------|-------|
| Session state survives page refresh | ✅ IMPLEMENTED | Supabase game_state table, id="current" |
| Court count survives refresh | 🐛 BUGGY | Persisted to Supabase but defaults to 2 if load fails |
| Player roster survives refresh | ✅ IMPLEMENTED | Part of GameState |
| Game schedule survives refresh | ✅ IMPLEMENTED | matches array in GameState |
| Completed results survive refresh | ✅ IMPLEMENTED | Completed match status persisted |
| Current game index survives refresh | ✅ IMPLEMENTED | Match status (playing/pending/completed) persisted |
| Timer uses start timestamp | ✅ IMPLEMENTED | sessionStartedAt stored, countdown calculated |
| Supabase as primary persistence | ✅ IMPLEMENTED | Upsert on every state change |
| localStorage as fallback | ❌ MISSING | No fallback; state resets on Supabase failure |
| Toggle always visible regardless of load state | ⚠️ PARTIAL | Toggle in AdminSetup; may show wrong default during load |

### UI/UX

| Feature | Status | Notes |
|---------|--------|-------|
| Tablet-optimized layout | ✅ IMPLEMENTED | Large touch targets, responsive grids |
| Court view showing active game per court | ✅ IMPLEMENTED | CourtDisplay.tsx CourtCard components |
| "On Deck" display | ✅ IMPLEMENTED | Next matches after Up Next |
| Schedule view (full round-robin visible) | ⚠️ PARTIAL | "Projected" section shows future games (admin only) |
| Standings view | ✅ IMPLEMENTED | MiniStandings in CourtDisplay + PairLeaderboard in Stats |
| Playoff bracket view | ✅ IMPLEMENTED | PlayoffBracket.tsx with round labels, status badges |
| Admin controls | ✅ IMPLEMENTED | Skip, swap, correct, regenerate, lock, export |

---

## SECTION 4 — STATE MANAGEMENT DEEP DIVE

### Where is session state defined?
- **File:** `src/hooks/useGameState.ts` line 261
- **Hook:** `const [state, setState] = useState<GameState>(DEFAULT_STATE)`
- **Type:** `GameState` from `src/types/courtManager.ts` lines 86-103

### Every piece of state

| State | Location | Type | Default |
|-------|----------|------|---------|
| `state.sessionConfig` | useGameState useState | SessionConfig | startTime:"20:00", duration:85, courtCount:2, dynamicMode:false |
| `state.roster` | useGameState useState | Player[] | [] |
| `state.pairs` | useGameState useState | Pair[] | [] |
| `state.matches` | useGameState useState | Match[] | [] |
| `state.gameHistory` | useGameState useState | GameHistory[] | [] |
| `state.sessionStarted` | useGameState useState | boolean | false |
| `state.playoffsStarted` | useGameState useState | boolean | false |
| `state.playoffMatches` | useGameState useState | PlayoffMatch[] | [] |
| `state.fixedPairs` | useGameState useState | FixedPair[] | [] |
| `state.waitlistedPlayers` | useGameState useState | Player[] | [] |
| `state.oddPlayerDecisions` | useGameState useState | OddPlayerDecision[] | [] |
| `state.pairsLocked` | useGameState useState | boolean | false |
| `state.newlyAddedPairIds` | useGameState useState | string[] | [] |
| `state.pairGamesWatched` | useGameState useState | Record<string,number> | {} |
| `state.totalScheduledGames` | useGameState useState | number | 0 |
| `loading` | useGameState useState | boolean | true |
| `savingRef` | useGameState useRef | boolean | false |
| `pendingRef` | useGameState useRef | GameState\|null | null |
| `localMutationRef` | useGameState useRef | boolean | false |
| `activeTab` | Manage.tsx useState | string | "admin" |
| `adminUnlocked` | Manage.tsx useState | boolean | false |
| `statsUnlocked` | Manage.tsx useState | boolean | false |

### Single source of truth?
**Yes** — all game state lives in `useGameState.ts` as a single `GameState` object. Components read from it and call action callbacks. No state duplication across components. The Supabase `game_state` table mirrors this object exactly.

### Page refresh flow
1. React mounts, `useGameState` hook initializes with `DEFAULT_STATE` (courtCount=2)
2. `useEffect` fires (line 268): queries `game_state` table where `id = "current"`
3. If row exists: `setState(row.state)` — full state restored
4. If row missing or Supabase unreachable: stays on `DEFAULT_STATE` (courtCount=2)
5. Sets `loading = false`
6. Subscribes to realtime channel (line 284) for external updates
7. Starts 10-second polling interval (line 305) as fallback
8. Components render with restored (or default) state

### What happens if Supabase is unreachable?
- State stays at `DEFAULT_STATE` — all session data lost until Supabase reconnects
- Court count resets to 2 (the "disappearing toggle" bug)
- No localStorage fallback exists
- Polling continues attempting reconnection every 10 seconds

### Court count toggle rendering
- Rendered in `AdminSetup.tsx` as part of session configuration
- Always visible when Admin Setup tab is active
- Reads from `state.sessionConfig.courtCount` — if Supabase failed to load, shows default (2)
- Not conditionally hidden, but may show wrong value during load

---

## SECTION 5 — SCHEDULING ALGORITHM DEEP DIVE

### Which file/function?
- **File:** `src/hooks/useGameState.ts`
- **Primary:** `generateFullSchedule()` callback (lines 479-1031)
- **Regen:** `regenerateRemainingSchedule()` callback (lines 1338-1604)
- Both are `useCallback` closures inside the React hook — NOT pure functions

### How does the algorithm select matchups?
**Weighted constraint-satisfaction scoring:**
1. Generate ALL valid candidate matchups (no A-vs-C, B-vs-C only in 2-court)
2. Shuffle candidates (Fisher-Yates)
3. For each time slot, score every candidate against current state
4. Pick lowest score (best fit)
5. Commit winner, update tracking maps

### Every constraint check in `pickBestCandidate()`:

| # | Constraint | Line | Check |
|---|-----------|------|-------|
| 1 | Court pool filter | 707 | `courtPoolFilter && c.courtPool !== courtPoolFilter` |
| 2 | Duplicate matchup | 709 | `usedMatchups.has(mKey)` |
| 3 | Game cap | 712 | Cross-tier: `g >= TARGET_GAMES_PER_PAIR`; Same-tier: `g >= MAX_GAMES` |
| 4 | Equity gate | 716 | `g > minCount + 1` — no pair >1 ahead of least-scheduled |
| 5 | Slot conflict | 719 | Player already in this slot |
| 6 | Rest gap | 720 | Player in REST_GAP previous slots |
| 7 | Cross-tier hard-block | 734 | `deficit1 <= 0 \|\| deficit2 <= 0` for cross matchups |

### Scoring system:

| Component | Formula | Weight | Purpose |
|-----------|---------|--------|---------|
| Deficit scoring | `-(d1 + d2) * 10` | ×10 | Prefer matchups that fill tier quotas |
| Overflow amplifier | `deficit * 5` when negative | ×50 effective | Strongly penalize exceeding tier targets |
| Game count tiebreak | `+(g1 + g2)` | ×1 | Prefer pairs with fewer games |
| Over-target penalty | `+100` per pair over TARGET | +100/+200 | Deprioritize pairs at/above target |

### Missing constraints:
- No B-vs-B guard in 2-court mode (candidates generated for all modes)
- No starvation prevention (players can sit 4+ consecutive slots)
- No court-level balancing (matches assigned to courts after scheduling, not during)

### 2-court vs 3-court: same function or separate?
**Same function** (`generateFullSchedule` and `regenerateRemainingSchedule`) — branching on `courtCount`:
- Different `TARGET_GAMES_PER_PAIR`, `MAX_GAMES`, `REST_GAP`, `tierTargets`
- Different court-pool routing in slot loop (1 C + 2 AB vs 2 any)
- Different candidate generation (B-vs-C only if courtCount===2)

### B-tier bridge role handling:
- 2-court: B plays A (vsA:1), B (vsB:2), and C (vsC:1) — bridges all tiers
- 3-court: B plays A (vsA:1) and B (vsB:2) only — no C contact (pool isolation)
- Cross-tier hard-block prevents over-scheduling: once B pair meets vsA target, no more BvA

### REST_GAP values:
- **2-court:** `REST_GAP = 2` (line 691) — blocks players from 2 previous slots (3-group cycle)
- **3-court:** `REST_GAP = 1` (line 691) — blocks players from 1 previous slot (2-group alternation)

### Late arrival regeneration:
1. `getFreezeLine()` determines cutoff: all non-pending + first `courtCount × 2` pending matches
2. Everything after freeze line is discarded
3. `regenerateRemainingSchedule()` rebuilds using same algorithm
4. Initializes `pairOpponentStats` from frozen matches so distribution targets carry over
5. Completed and On Deck games are never touched

---

## SECTION 6 — KNOWN BUGS

### Bug 1: B-vs-B in 2-court mode

**File:** `src/hooks/useGameState.ts` lines 645-648
**Current code:**
```typescript
// B vs B — generated in ALL modes
for (let i = 0; i < bPairs.length; i++) {
  for (let j = i + 1; j < bPairs.length; j++) {
    allCandidates.push({ pair1: bPairs[i], pair2: bPairs[j], skillLevel: "B", matchupLabel: "B vs B", courtPool: "AB" });
  }
}
```
**Problem:** B-vs-B candidates are generated regardless of court count. In 2-court mode, B should play a mix of A and C opponents, never B-vs-B.
**Fix:** Wrap in `if (courtCount === 3) { ... }` to only generate B-vs-B in 3-court mode.
**Ripple risk:** Low. Removing BvB candidates in 2-court means B pairs must fill their 4 games with BvA + BvC. The tierTargets already support this (B 2-court: vsA:1, vsB:2, vsC:1 → would need adjustment to vsA:2, vsB:0, vsC:2).

### Bug 2: Sit-out / starvation in 2-court mode

**File:** `src/hooks/useGameState.ts` lines 714-716 (equity gate)
**Current code:**
```typescript
const minCount = Math.min(...Array.from(pairGameCount.values()));
if (g1 > minCount + 1 || g2 > minCount + 1) continue;
```
**Problem:** The equity gate prevents pairs from playing >1 game ahead of the least-scheduled pair. Combined with REST_GAP=2, this creates 4+ slot idle stretches for some players. The algorithm prioritizes equity over temporal distribution.
**Fix:** Add a starvation-repair pass after scheduling that detects >3 consecutive idle slots and swaps matches to fill gaps.
**Ripple risk:** Medium. Repair pass must maintain all other constraints (no duplicates, no conflicts, no forbidden matchups).

### Bug 3: Court count toggle "disappears" on refresh

**File:** `src/hooks/useGameState.ts` lines 268-281 (load on mount)
**Current code:**
```typescript
useEffect(() => {
  const loadState = async () => {
    const { data } = await supabase.from("game_state").select("state").eq("id", ROW_ID).maybeSingle();
    if (data?.state) setState(data.state as GameState);
    setLoading(false);
  };
  loadState();
}, []);
```
**Problem:** If Supabase is slow or fails, `setState` never fires. `DEFAULT_STATE` has `courtCount: 2`. The toggle shows "2" even if the session was in 3-court mode. No localStorage backup.
**Fix:** Save `courtCount` to `localStorage` in `setSessionConfig()`. On mount, read from localStorage immediately before Supabase query completes.
**Ripple risk:** Low. Only adds a localStorage read/write. No other state affected.

### Bug 4: Seeding uses total wins over win%

**File:** `src/hooks/useGameState.ts` lines 2046-2063 (startPlayoffs)
**Current behavior:** Sorting order is `wins → winPct → tier → H2H`. A pair with 7W-13L (35% win rate) seeds above 4W-0L (100%) because 7 > 4 in total wins.
**Problem:** Total wins favors pairs who played more games, not who played better. Win% should be primary.
**Fix:** Change sort order to `winPct → wins → tier → H2H`.
**Ripple risk:** Low. Only affects sort order in one function. StatsPlayoffs.tsx already sorts leaderboard by winPct.

### Bug 5: B-vs-A penalty was too aggressive (FIXED)

**Status:** This was the `+50` flat penalty on B-vs-A matches. **Already replaced** with distribution-aware deficit scoring in the recent commits. The new system uses tier targets + deficit calculation instead of a flat penalty.

### Bug 6: syncPairsToMatches doesn't skip completed during removal

**File:** `src/hooks/useGameState.ts` lines 88-98 (syncPairsToMatches)
**Current code:**
```typescript
function syncPairsToMatches(pairs: Pair[], matches: Match[]): Match[] {
  const pairMap = new Map(pairs.map(p => [p.id, p]));
  return matches.map(m => ({
    ...m,
    pair1: pairMap.get(m.pair1.id) || m.pair1,
    pair2: pairMap.get(m.pair2.id) || m.pair2,
  }));
}
```
**Problem:** This updates ALL matches, including completed ones. When a player is removed mid-session, their pair reference in the master `pairs` array may change (partner reassigned). Completed historical matches should preserve the original player names.
**Where called dangerously:** `removePlayerMidSession()` (line ~2170) calls this after modifying the pairs array.
**Note:** `swapPlayerMidSession()` (line ~1921) correctly skips completed matches.
**Fix:** Filter: `if (m.status === "completed") return m;` before mapping.
**Ripple risk:** Low. Only affects the sync function. Need to verify all call sites.

---

## SECTION 7 — MISSING FEATURES

### 🔴 CRITICAL (blocks running a real session)

| Feature | Impact |
|---------|--------|
| localStorage fallback for state | If Supabase blips during a live session, all state lost. Players must re-check-in. |
| Fix B-vs-B in 2-court mode | B pairs currently waste games playing each other instead of bridging A↔C |

### 🟡 HIGH (degrades session quality)

| Feature | Impact |
|---------|--------|
| Fix seeding: win% primary over total wins | Incorrect playoff seeds frustrate competitive players |
| Contact page (Contact.tsx) | CLAUDE.md lists it but file doesn't exist |
| Point differential tiebreaker | Only win/loss tracked; no game scores for finer tiebreaking |
| Starvation repair pass | Some players sit 4+ consecutive slots |

### 🟢 NICE-TO-HAVE

| Feature | Impact |
|---------|--------|
| Separate C-tier playoff in 3-court | C pairs compete in unified bracket; separate bracket would be fairer |
| Extract scheduling into pure functions | Testability improvement; reduces 2,745-line hook |
| Email capture backend | Newsletter form does nothing currently |
| Booking payment integration | Bookings stay in "pending" status |
| Real images instead of placeholders | All public pages use placeholder divs |
| Complete schedule view for non-admin | Only admin sees "Projected" future matches |

---

## SECTION 8 — CODE QUALITY ASSESSMENT

### Functions over 100 lines

| Function | File | Lines | Size |
|----------|------|-------|------|
| `generateFullSchedule` | useGameState.ts | 479-1031 | ~552 lines |
| `regenerateRemainingSchedule` | useGameState.ts | 1338-1604 | ~266 lines |
| `removePlayerMidSession` | useGameState.ts | 2135-2289 | ~154 lines |
| `completeMatch` | useGameState.ts | 1901-2002 | ~101 lines |
| `handleLateCheckIn` | useGameState.ts | 1215-1332 | ~117 lines |
| `startPlayoffs` | useGameState.ts | 2043-2131 | ~88 lines |

### Files over 500 lines

| File | Lines |
|------|-------|
| `hooks/useGameState.ts` | 2,745 |
| `__tests__/court-manager-simulation.test.ts` | 933 |
| `manage/CourtDisplay.tsx` | 648 |
| `hooks/useGameState.test.ts` | 519 |

### Duplicated logic
- `pickBestCandidate` in `generateFullSchedule` (line 693) is **duplicated** in `regenerateRemainingSchedule` as `pickBest` (line 1460). Same scoring, same constraints, copied code.
- `commitCandidate` similarly duplicated between both functions.
- Fallback pass (find unplayed opponents for under-target pairs) duplicated in 3 places: generateFullSchedule (806), regenerateRemainingSchedule (1566), removePlayerMidSession (2230).
- Test file `court-manager-simulation.test.ts` replicates the entire scheduling algorithm manually.

### TODO/FIXME/HACK comments
**None found.** No TODO, FIXME, or HACK comments in the codebase.

### Console.log statements (should be removed for production)

| File | Line | Statement |
|------|------|-----------|
| useGameState.ts | 1001 | `console.log("[PTO Schedule] A=X B=X...")` — schedule summary |
| useGameState.ts | 1002 | `console.log("[PTO Schedule] Per pair:...")` — per-pair breakdown |
| useGameState.ts | 809 | `console.warn("[PTO Schedule] Fallback...")` — below-target warning |
| useGameState.ts | 837 | `console.error("[PTO Schedule] WARNING...")` — unfillable games |
| useGameState.ts | 937 | `console.error("[PTO Schedule] FATAL...")` — A-vs-C detected |
| useGameState.ts | 943 | `console.error("Schedule conflicts detected...")` |
| useGameState.ts | 1005 | `console.warn("[PTO Schedule] WARNING: Equity gap...")` |
| useGameState.ts | 1010 | `console.error("[PTO Schedule] ERROR: X pairs have 0 games")` |
| useGameState.ts | 332/338 | `console.error("Failed to save/retry...")` |

**Verdict:** The `console.log` calls at lines 1001-1002 are debug-level and should be removed or gated behind a debug flag. The `console.warn` and `console.error` calls are operational and acceptable.

### Hardcoded values that should be constants

| Value | Location | Should be |
|-------|----------|-----------|
| `"9999"` | Manage.tsx | `ADMIN_PASSCODE` constant |
| `["david", "benson", "albright"]` | useGameState.ts line 6 | Already `VIP_NAMES` (good) |
| `7` (minutes per game) | useGameState.ts line 604 | `MINUTES_PER_GAME` constant |
| `85` (default duration) | DEFAULT_STATE | Already in config (good) |
| `180000` (3-min rest ms) | useGameState.ts lines 1958, 1707 | `REST_COOLDOWN_MS` constant |
| `14` (pair history days) | useGameState.ts line 482 | `PAIR_HISTORY_DAYS` constant |
| `10000` (polling interval) | useGameState.ts line 316 | `POLLING_INTERVAL_MS` constant |

### Dead code
- Legacy components: `Hero.tsx`, `FAQ.tsx`, `BookingSection.tsx`, `PhotoGallery.tsx`, `HowItWorks.tsx`, `NavLink.tsx`, `ScrollToTop.tsx` — all superseded and not imported
- No unreachable functions detected in active code paths

### TypeScript `any` usage
- `tsconfig.app.json` has `noImplicitAny: false` and `strict: false` — permissive
- Some Supabase query results typed with inferred types rather than explicit
- `useGameState` return type is inferred (no explicit interface)
- No `any` keyword explicitly used in custom code (Radix/shadcn may have some)

---

## SECTION 9 — CLAUDE.MD ASSESSMENT

### Does CLAUDE.md exist?
**Yes** — at `/Users/bensonbillions/clubpto/CLAUDE.md`

### Is it accurate?
**Mostly accurate** with some gaps:

| Section | Accuracy | Notes |
|---------|----------|-------|
| Project Overview | ✅ Accurate | Correctly describes public site + manage engine |
| Critical: Do Not Touch | ✅ Accurate | Correctly lists protected files |
| Tech Stack | ✅ Accurate | All technologies listed correctly |
| Design System | ✅ Accurate | Colors, fonts, spacing, animations match code |
| Brand Voice | ✅ Accurate | Tone guidelines match content |
| File Structure | ⚠️ Outdated | Missing: Leaderboard.tsx, Profile.tsx, Install.tsx, leaderboard.ts, Layout.tsx. Lists Contact.tsx which doesn't exist |
| Common Mistakes | ✅ Accurate | All constraints match code behavior |
| Commands | ✅ Accurate | npm run dev/build/lint all work |
| Key Dependencies | ⚠️ Incomplete | Only lists 3 deps to install; doesn't mention shadcn, React Query, etc. |

### What's missing from CLAUDE.md:
1. **Scheduling business rules** — no mention of tier targets, equity gate, REST_GAP, distribution scoring
2. **Leaderboard system** — pages/Leaderboard.tsx, pages/Profile.tsx, lib/leaderboard.ts not mentioned
3. **Dynamic mode** — not documented
4. **Supabase tables beyond game_state** — pair_history, players, points_ledger, weekly_leaderboard
5. **Known bugs** — should list the court count toggle bug, B-vs-B in 2-court, seeding order
6. **Test files** — not mentioned at all
7. **Legacy/dead files** — should list files safe to delete

---

## SECTION 10 — RECOMMENDED FIX ORDER

### Phase 1: Critical fixes (must fix before next session)

| # | Task | Why | Complexity |
|---|------|-----|-----------|
| 1 | Add localStorage fallback for courtCount | Court count toggle resets to 2 if Supabase blips — breaks 3-court sessions mid-game | Small |
| 2 | Guard B-vs-B candidates to 3-court only | B pairs waste games in 2-court mode playing each other instead of bridging A↔C | Small |
| 3 | Fix syncPairsToMatches to skip completed | Player removal corrupts historical match records | Small |
| 4 | Fix playoff seeding: win% before total wins | 7W-13L (35%) seeding above 4W-0L (100%) is obviously wrong | Small |

### Phase 2: High-priority improvements (this week)

| # | Task | Why | Complexity |
|---|------|-----|-----------|
| 5 | Add starvation-repair pass post-scheduling | Some players idle 4+ slots; bad play experience | Medium |
| 6 | Update CLAUDE.md with scheduling rules, known bugs, new files | Current doc is outdated; new contributors will miss critical context | Small |
| 7 | Create Contact.tsx page | Listed in spec but not implemented | Small |
| 8 | Update 2-court tierTargets after removing B-vs-B | With no B-vs-B in 2-court, B targets need rebalancing (vsA:2, vsB:0, vsC:2) | Small |
| 9 | Delete dead legacy files | Hero.tsx, FAQ.tsx, BookingSection.tsx, PhotoGallery.tsx, HowItWorks.tsx, NavLink.tsx, ScrollToTop.tsx | Small |

### Phase 3: Quality improvements (can wait)

| # | Task | Why | Complexity |
|---|------|-----|-----------|
| 10 | Extract scheduling into pure `lib/scheduling.ts` | 2,745-line hook is untestable without replicating in tests | Large |
| 11 | Add point differential tracking | Enable finer tiebreaking in playoffs | Medium |
| 12 | Split large manage components (CourtDisplay, CheckIn, AdminSetup) | Each >400 lines; maintainability | Medium |
| 13 | Add email capture backend | Newsletter form does nothing | Small |
| 14 | Replace placeholder images with real photos | All public pages use gray placeholder divs | Medium |
| 15 | Add separate C-tier playoff bracket for 3-court | C pairs disadvantaged in unified bracket | Medium |
| 16 | Remove debug console.logs from scheduling | Lines 1001-1002 log every schedule generation | Small |
| 17 | Extract hardcoded magic numbers to named constants | MINUTES_PER_GAME, REST_COOLDOWN_MS, etc. | Small |
| 18 | Add full localStorage state fallback (beyond courtCount) | Complete offline resilience | Medium |
