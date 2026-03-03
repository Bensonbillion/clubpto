# Club PTO — Premium Padel Community Website

## Project Overview
Community-first padel league in Toronto. Rebuilding PUBLIC site only (/, /about, /book, /faq, /membership, /events, /community, /contact). Premium aesthetic inspired by Soho House + Padel Haus NYC. Dark theme, warm tones, editorial feel.

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

## Design System — FOLLOW EXACTLY
- **Background:** `#1A1A1A` (primary), `#2D2D2D` (elevated surfaces), never pure black
- **Text:** `#F5F0EB` (cream/primary), `#A8A29E` (muted/secondary)
- **Accent:** `#C9A84C` (warm gold — CTAs, highlights, hover states only)
- **Headlines:** serif font (GT Sectra or Playfair Display via Google Fonts), 8-12vw on hero, tracking-wide
- **Body:** sans-serif (Inter or DM Sans), text-base/lg, font-light
- **Spacing:** generous — sections min-h-screen, py-24 to py-32 between sections
- **Animations:** slow (500-800ms), ease-out curves, scroll-triggered fade-up
- **Images:** warm color grading, rounded-none (sharp corners), aspect-video or aspect-[4/3]
- **Buttons:** minimal — border border-gold text-gold hover:bg-gold hover:text-dark, no rounded

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
- Do NOT use bright/saturated colors — everything should feel warm and muted
- Do NOT use rounded-lg or rounded-xl on images or cards — use sharp corners (rounded-none)
- Do NOT center-align body text — left-align everything except hero headlines
- Do NOT add too many CTAs — maximum 2 per section, usually 1
- Do NOT make animations fast — minimum 500ms, prefer 700ms for entrances
- Do NOT use stock photography descriptions — use placeholder divs with aspect ratios
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
