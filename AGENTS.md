# Club PTO — Premium Padel Community Website

## Bug Fix Workflow
When a bug is reported, do NOT start by trying to fix it. Instead:
1. Write a test that reproduces the bug (test should fail)
2. Use subagents to implement the fix
3. Prove the fix by showing the test now passes

## Project Overview
Community-first padel league in Toronto. Public site redesigned October 2026: light cream and forest green, Playfair + DM Sans, built for inbound (Thursday passes, the league, company nights, brand partners). See the design system below.

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
- **Display:** Playfair Display 800, italic 700 for the emphasised words
- **Body:** DM Sans 400/500/700
- **Shapes:** sharp corners, 2px ink borders, taped photo collages in heroes
- **Photos:** real PTO photos only, full color, action shots lead
  (`src/site/photos.ts`); Benson picks every face
- **Facts:** only from `src/site/content.ts` / `src/content/league.ts`.
  Unconfirmed values are `TODO_BENSON` and their element hides;
  `src/site/__tests__/site-pages-integrity.test.tsx` fails the build if a
  sentinel or a `[bracketed placeholder]` renders.
- The older pages (/about, /faq, /community, /skills-lab, /install, /book,
  /league/join) still use the dark RALLY layout (`PublicLayout`,
  `rally.css`) until they are restyled.

## Brand Voice
- Confident, warm, minimal. Like a host at a great dinner party.
- Never use: "exclusive," "elite," "luxury," "VIP," "premier"
- Use: "Join us," "Your game starts here," "Where the game meets the city"
- Short declarative sentences. Fragment-heavy when impactful. Active voice.
- CTAs are invitational: "Reserve your court" not "Book now," "Join us" not "Sign up"

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
