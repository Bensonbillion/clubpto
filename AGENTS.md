# Club PTO — Premium Padel Community Website

## Bug Fix Workflow
When a bug is reported, do NOT start by trying to fix it. Instead:
1. Write a test that reproduces the bug (test should fail)
2. Use subagents to implement the fix
3. Prove the fix by showing the test now passes

## Project Overview
Community-first padel league in Toronto. Public site redesigned October 2026: light cream and forest green, Barlow Condensed + Barlow, built for inbound (Thursday passes, the league, company nights, brand partners). See the design system below.

## CRITICAL: Do NOT Touch
- `src/pages/Manage.tsx` and ALL files in `src/components/manage/`
- `src/hooks/useGameState.ts` — 2,159-line game scheduling engine
- `src/types/courtManager.ts` — game state types
- The `/manage` route and its passcode gate (9999)
- Any Supabase tables: `game_state`, `sessions`, `bookings`
- The existing Supabase client config in `src/integrations/`

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
- **Display:** Barlow Condensed 800 in capitals (`.disp`), italic 800 for the
  emphasised words. Picked by Benson on Oct 15 2026; Playfair read too formal
  and too big. Headlines run about 14% smaller than the Playfair sizes.
- **Body:** Barlow 400/500/700; intro text 18px, body 16px
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
│   ├── community/       # PhotoGrid, InstagramEmbed
│   └── manage/          # ❌ DO NOT TOUCH
├── pages/
│   ├── Index.tsx         # Homepage rebuild
│   ├── About.tsx         # About page rebuild
│   ├── Book.tsx          # Booking page (links to /manage or external)
│   ├── Membership.tsx    # NEW — tiers, pricing, founding member
│   ├── Events.tsx        # NEW — upcoming + past events
│   ├── Community.tsx     # NEW — photo gallery, journal
│   ├── Contact.tsx       # NEW — form + map
│   ├── FAQ.tsx           # FAQ rebuild with animated accordion
│   └── Manage.tsx        # ❌ DO NOT TOUCH
├── hooks/
│   ├── useGameState.ts   # ❌ DO NOT TOUCH
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
- Do NOT import from manage/ components — they are a separate system
- Do NOT break existing routes — /manage MUST continue working with passcode 9999

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — check for errors

## Key Dependencies to Install
```bash
npm install framer-motion gsap @studio-freight/lenis
```
