# Club PTO — Premium Padel Community Website

## Bug Fix Workflow
When a bug is reported, do NOT start by trying to fix it. Instead:
1. Write a test that reproduces the bug (test should fail)
2. Use subagents to implement the fix
3. Prove the fix by showing the test now passes

## Project Overview
Community-first padel league in Toronto. Rebuilding PUBLIC site only (/, /about, /book, /faq, /membership, /events, /community, /contact). Premium aesthetic inspired by Soho House + Padel Haus NYC. Dark theme, warm tones, editorial feel.

## Court Manager

There is ONE manager, and it lives in `src/manage/`. It serves `/manage` and
`/manage2`, the door is the passcode 9999, and there is no sign-in and no inbox.

`/manage2` is the SAME app mounted a second time (`<ManageApp instance={2} />`)
with its own localStorage key (`cm_manage_session_2`), so two phones can run
one court each on two URLs at once. It is not a copy of the source; a change
to `src/manage/` ships to both URLs. Instance 1 keeps the bare key, so nothing
about `/manage` changed when `/manage2` arrived.

Sunday is a hub (frame 34): after the day is chosen the wizard offers Round
robin or Playoff. The Playoff door is a straight knockout over hand-made
pairs (docs/manage/knockout-spec.md): one draw feeds every court, byes and a
rotating trio absorb any headcount, walkovers and an optional plate for
first-round losers. `Session.format` is absent on old saved nights, which is
what keeps them resuming as round robins.

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

### Known gap, worth knowing before you touch persistence
The manager writes to `localStorage` only (`remote: null` in
`src/manage/useSession.ts`). The v3 manager it replaced mirrored to Supabase,
so a dead phone mid-night no longer means a second device can pick the night
up. Restoring that needs a writable session row, and `game_state` is
admin-only by deliberate policy, so it waits on the passcode Edge Function.

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
- Do NOT use bright/saturated colors — everything should feel warm and muted
- Do NOT use rounded-lg or rounded-xl on images or cards — use sharp corners (rounded-none)
- Do NOT center-align body text — left-align everything except hero headlines
- Do NOT add too many CTAs — maximum 2 per section, usually 1
- Do NOT make animations fast — minimum 500ms, prefer 700ms for entrances
- Do NOT use stock photography descriptions — use placeholder divs with aspect ratios
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
