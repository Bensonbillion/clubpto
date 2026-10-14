# Club PTO — Premium Padel Community Website

## Bug Fix Workflow
When a bug is reported, do NOT start by trying to fix it. Instead:
1. Write a test that reproduces the bug (test should fail)
2. Use subagents to implement the fix
3. Prove the fix by showing the test now passes

## Project Overview
Community-first padel league in Toronto. Public site redesigned October 2026: light cream and forest green, Playfair + DM Sans, built for inbound (Thursday passes, the league, company nights, brand partners). See the design system below.

## Court Manager

There is ONE manager, and it lives in `src/manage/`. It serves `/manage` and
`/manage2`, the door is the passcode 9999, and there is no sign-in and no inbox.

`/manage2` is the SAME app mounted a second time (`<ManageApp instance={2} />`)
with its own localStorage key (`cm_manage_session_2`), so two phones can run
one court each on two URLs at once. It is not a copy of the source; a change
to `src/manage/` ships to both URLs. Instance 1 keeps the bare key, so nothing
about `/manage` changed when `/manage2` arrived.

Every night is a hub (frame 34, drawn for Sunday and opened to every night
on 2026-09-10): after the day is chosen the wizard offers Round robin,
Playoff or Set teammate. Playoff is a straight knockout over hand-made
pairs (docs/manage/knockout-spec.md): one draw feeds every court, byes and a
rotating trio absorb any headcount, walkovers and an optional plate for
first-round losers. Set teammate keeps the same hand-made pairs together for
a round robin over pairs, then crowns the table or seeds it into the
knockout. `Session.format` is absent on old saved nights, which is what keeps
them resuming as round robins.

The round robin's laws live in `src/manage/engine/tiers.ts`: a mixed game is
A B against A B (never A B against B B), a C game is four C's or three C's
with the one designated B, and an A is never in a game with a C. A third law
arrived on 2026-09-10: an A plays ONE game with the B's a night and never a
second, counted per session across courts, with unassessed counting as B.
Wherever the seats can still be finished with nobody meeting the B's twice it
is a hard cap, the one thing allowed to hold a least-played player back a
game, and where the seats allow it every A gives their one game rather than
none. Where the numbers cannot keep it (six A's at four each with two B's owe
the B's eight seats across the net), `engine/mixing.ts` prices the night so
the second games are spread over different A's, and the split screen names
the bend before anyone plays. The picker
in `engine/rotation.ts` then prefers four people who have not shared a court
yet, spreads the mixed games around, and keeps the designated B for the
beginners while they still owe games. The rotation test replays the
Wednesday roster that broke on 2026-09-09 (twelve A's, eight B's, one court)
and asserts no repeated four and only the three lawful shapes.

Four earlier managers were deleted on 2026-08-19: v1 (`/manage-classic`), v2
(`/manage2`), v3 (`/manage`) and v4 (`/manage4`), together with their engines,
components and tests. `/manage-classic` and `/manage4` redirect to `/manage`,
because an operator with one of them on a home screen should land on the
manager rather than a blank page; `/manage2` is no longer a redirect, it is
the second instance described above. If you are reading advice anywhere in
this repo about `useGameState`, `court-manager/react`, `lib/americano` or
`components/manage*`, it is about code that no longer exists.

What survives from the old world, and why:
- `src/court-manager/persistence.ts` is the only file left in that directory.
  `src/manage/useSession.ts` uses it, and it has zero imports of its own.
- `src/hooks/useGameState.ts` and `src/types/courtManager.ts` are still here
  ONLY because `/admin/reset` value-imports `getHeadToHead` from the first and
  `DEFAULT_STATE` from the second. They are not the manager's engine any more.
  Deleting them means retiring `/admin/*` in the same change.

### The shared row, worth knowing before you touch persistence
The manager is local-first (`src/court-manager/persistence.ts`) and mirrored
to one row per instance in `public.manage_sessions` behind the
`manage-session` Edge Function, which checks the door's passcode and writes
with the service role (`src/manage/sync/remote.ts`). The row is a straight
line of versions: every push is a compare-and-set against the version the
phone last agreed with, a refused push comes back WITH the row (a 200 with
`stale: true`, because supabase-js hides non-2xx bodies), and the phone
merges rather than adopting or overwriting. `src/manage/sync/merge.ts` is
the three-way merge, clock-free, the row winning true conflicts and the
losing phone shown a one-line note. A phone still on an older bundle
(no `baseVersion` on its pushes) can write until a merge-aware phone has
written the row (`cas: true` in the envelope); after that it can only
follow, and its taps show the red line, which is the reload cue. The
function is deployed by hand from the Supabase dashboard (no CLI login on
this machine); deploy it before a client change that needs it, and never
edit `manage_sessions` by hand.

## CRITICAL: Do NOT Touch
- Supabase table `game_state` policies. `20260814_lock_game_state.sql` closed
  anon WRITE on the row a live night runs on, and `engine_admins` is the
  boundary. Do not reopen anon writes to it for any reason.
- `src/integrations/` Supabase client config.

## Tech Stack
- React 18 + TypeScript + Vite (keep existing — do NOT migrate to Next.js)
- Tailwind CSS + shadcn/ui for components
- Framer Motion for page transitions, entrance animations, hover states
- GSAP + ScrollTrigger for hero parallax and scroll-driven reveals
- Lenis for global smooth scrolling
- Supabase for auth, database, storage
- React Router DOM for routing (already configured)

## Design System (public site, October 2026 redesign) — FOLLOW EXACTLY
The redesigned public pages (/, /play, /league, /events, /book-pto,
/partners) live in `src/site/` (layout, forms, photos, facts, `pto.css`) and
`src/pages/{Home,Play,League,Events,BookPTO,Partners}.tsx`. Everything is
scoped under `.pto`.
- **Paper:** `#F5EFE3` (page), `#EBE3D2` (alt sections), `#FFFDF8` (cards)
- **Ink:** `#0E2418` forest green (text, dark sections), `#2C3A30` body copy
- **Accent:** `#D9E270` lime, one accent only (CTAs on dark, seals, highlights)
- **Display:** Playfair Display 800, italic 700 for the emphasised words
- **Body:** DM Sans 400/500/700
- **Shapes:** sharp corners, 2px ink borders, taped photo collages in heroes
- **Logo:** the real wordmark, `src/assets/logo-wordmark-cream.png` (script
  "Club", lime pixel ball, digital "PTO"). It is cream and lime for dark
  grounds, so the header and footer are forest green and the announcement
  bar is lime. Never recolor it or swap in a typed stand-in.
- **Photos:** real PTO photos only, full color, action shots lead
  (`src/site/photos.ts`); Benson picks every face
- **Facts:** only from `src/site/content.ts` / `src/content/league.ts`.
  Unconfirmed values are `TODO_BENSON` and their element hides;
  `src/site/__tests__/site-pages-integrity.test.tsx` fails the build if a
  sentinel or a `[bracketed placeholder]` renders.
- **Live league:** `src/site/leagueLive.ts` reads standings and matchdays
  from the league Sheet's Apps Script (GET only, the same URL as
  `/league/admin`), cached 5 minutes per visit. Names show as the Sheet has
  them (first name, last initial). The home page and /league fall back to
  static facts if the Sheet is unreachable.
- The older pages (/about, /faq, /community, /skills-lab, /install, /book,
  /league/join) still use the dark RALLY layout (`PublicLayout`,
  `rally.css`) until they are restyled.

## Brand Voice (rewritten October 2026, from how @club_pto actually posts)
- **Who's reading:** 23 to 30, Toronto, young professionals, majority women
  and BIPOC. A lot of them come solo, looking for a game and their people.
- **Sound like the captions, not a venue:** short, warm, a little cheeky.
  Sports-hype for the league ("Time to see where you actually rank"), warm
  for the social side ("new faces becoming familiar ones"), one joke per
  section at most.
- **Padel stays the hero.** People say PTO reads as more vibes than padel, so
  the game, the rankings and the stakes lead; the people are why you stay.
- **Specific beats adjectives.** "Strangers at 8, group chat by 10" over "a
  welcoming community". Second person. Short declaratives and fragments.
- **House lines (reuse them):** "Not your average padel club" (the poster),
  "Same club, different day", "Thursday plans? Sorted.", "Time to see where
  you actually rank", "The race to the top is on", "Don't find out from someone's story", "Skip the escape room".
- **CTAs are invitational and casual:** "Grab a Thursday pass", "Bring your
  team", "Get on the list", "Check a date". Not "Book now" or "Sign up".
- **Never:** "exclusive," "elite," "luxury," "VIP," "premier"; corporate venue
  words ("offerings," "experience," "amenities"); slang that dates fast;
  emoji on the web; em dashes; "members" (there is no membership); guest
  counts; anything not in the facts files.

## File Structure for New Pages
```
src/
├── components/
│   ├── layout/          # Header, Footer, PageWrapper, ScrollToTop
│   ├── ui/              # shadcn components (existing)
│   ├── home/            # Hero, Manifesto, ExperienceArc, MembershipTeaser, WhatsOn, CommunityProof, EmailCapture
│   ├── membership/      # TierCard, ComparisonTable, FoundingBanner
│   ├── about/           # StorySection, WhatIsPadel, Values
│   ├── events/          # EventCard, EventGrid, PastEvents
│   └── community/       # PhotoGrid, InstagramEmbed
├── pages/
│   ├── Index.tsx         # Homepage rebuild
│   ├── About.tsx         # About page rebuild
│   ├── Book.tsx          # Booking page (links to /manage or external)
│   ├── Membership.tsx    # NEW — tiers, pricing, founding member
│   ├── Events.tsx        # NEW — upcoming + past events
│   ├── Community.tsx     # NEW — photo gallery, journal
│   ├── Contact.tsx       # NEW — form + map
│   └── FAQ.tsx           # FAQ rebuild with animated accordion
├── manage/               # The Court Manager. Engine, screens, roster.
├── hooks/
│   ├── useSmoothScroll.ts # NEW — Lenis initialization
│   └── useScrollAnimation.ts # NEW — GSAP ScrollTrigger helpers
└── lib/
    ├── animations.ts     # Framer Motion variants (fadeUp, staggerChildren, etc.)
    └── constants.ts      # Colors, fonts, nav items, social links
```

## Common Mistakes to Avoid
- Do NOT add colors beyond the palette above — lime is the only bright one
- Do NOT use rounded-lg or rounded-xl on images or cards — use sharp corners (rounded-none)
- Do NOT center-align body text — left-align everything except hero headlines
- Do NOT add too many CTAs — maximum 2 per section, usually 1
- Do NOT make animations fast — minimum 500ms, prefer 700ms for entrances
- Do NOT use stock photos or invented placeholders — real PTO photos from src/site/photos.ts only
- Do NOT import from `src/manage/` into the public site, or the reverse. The
  manager uses inline styles and its own token object, not Tailwind.
- Do NOT break `/manage` — it MUST keep working with passcode 9999

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — check for errors
- `npm run gauntlet` — the real gate: typecheck, lint, tests, build
- `npx tsc --noEmit -p tsconfig.app.json` — the root tsconfig has `"files": []`
  and compiles NOTHING, so a bare `tsc --noEmit` always passes and proves
  nothing. Use the `-p` form.

## Key Dependencies to Install
```bash
npm install framer-motion gsap @studio-freight/lenis
```
