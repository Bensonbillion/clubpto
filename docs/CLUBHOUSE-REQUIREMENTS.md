# Club PTO Digital Clubhouse — Requirements Document (v1.0)

> Canonical copy, received from the owner 2026-08-07. Where this doc and
> COURT_MANAGER_ONBOARDING.md conflict, the onboarding doc governs Court
> Manager; this doc governs the public/member site.
> Build status + repo mapping: see CLUBHOUSE-STATUS.md.

Requirement priorities: **MUST** (v1 ships with this), **SHOULD** (v1 if cheap, else v1.5), **LATER** (explicitly deferred). Requirements are numbered per module for traceability in Claude Code prompts.

---

## 1. Purpose & Product Thesis

Build a login-gated "digital clubhouse" for Club PTO that converts session data (already generated twice weekly by Court Manager) into member identity, status, and belonging — the evidence-backed drivers of retention in recreational sports. The site is the room where the trophies hang and everyone's name is known.

**The thesis, validated by research:** belonging beats competition for retention (social ties roughly halve churn; ~50% of new fitness members quit within six months, so early identity-building matters). The site's job is to reinforce the reasons people already show up — the weekly rhythm, the friends, the identity — not to rank them.

**Positioning:** the deliberate anti-Playtomic. Playtomic dominates padel digitally with a visible rating number that players describe as an obsession and a pain point. Club PTO differentiates by refusing the rating game: persistence and belonging over performance hierarchy. No visible ratings, no full rankings, no skill labels — ever.

## 2. Goals & Non-Goals

**Goals:** increase repeat attendance and membership retention; make every attendee feel like part of the club; create a twice-weekly reason to visit (the post-session recap); convert the existing 1,000+ attendee base into claimed, engaged identities; support membership growth (founding 24 → beyond) — all while remaining operable by one person tapping one button after each session.

**Non-goals (v1):** booking or payments on-site (Acuity + Stripe handle it), user-generated content of any kind, moderation systems, live/real-time features, member-vs-player permission tiers beyond a badge, native apps, replacing WhatsApp.

## 3. Users & Access Model

| Tier | Who | Sees |
|---|---|---|
| Visitor | Anyone | Public teaser layer only |
| Player (logged in) | Anyone in the shared roster who claims/receives access | The full clubhouse |
| Member badge | Stripe-verified paying members | Same as Player + member badge, member number, founding badge |
| Admin | Club operators | Publish pipeline, revoke, hide-player flags |

**ACC-1 (MUST):** One door. Any roster player who authenticates enters the full clubhouse. No gated member-only areas in v1; membership is expressed as visible status (badge + number), not access. Permission tiers are where auth systems become complicated.

**ACC-2 (MUST):** Admin functions live in Court Manager and Supabase, not as a site admin panel.

## 4. Scope Overview

| Module | v1 | v1.5 | Later |
|---|---|---|---|
| Public teaser (home, join, champions-this-week, mosaic teaser) | ✅ | | |
| Auth (magic link + OTP fallback, pre-seeded links) | ✅ | | |
| Personal dashboard | ✅ | | |
| Session recaps (auto stats + human note) | ✅ | | |
| Champions wall + records book | ✅ | | |
| Leaderboards (top-10) + private rank toggle | ✅ | | |
| Milestone clubs (Parkrun-style) | ✅ | | |
| Player profiles + rivalries | ✅ | | |
| Pixel mosaic (full, named, hoverable) | ✅ | | |
| Member numbers + founding badges | ✅ | | |
| Publish pipeline + consent/privacy controls | ✅ | | |
| Seasons + voted awards (simple form) | | ✅ | |
| Contribution recognition (shout-outs) | ✅ (lightweight) | | |
| Member portal (passes, booking window) | | | ✅ |
| Guest invite pages | | | ✅ |
| PTO ID + QR check-in | | | ✅ |
| "Tonight" live spectator view | | | ✅ |
| Shareable player cards | | | ✅ |
| PTO Radio / editorial (PTO Picks) | | manual page anytime | ✅ |

## 5. Public Teaser Layer

Curiosity-gap design: enough to prove the club is alive and make outsiders want in; everything personal behind the door.

**PUB-1 (MUST):** Home page — brand story ("your time off means something"), next session info (day, venue, price, book link to Acuity), this week's champions only (full history is inside), join/membership page link.

**PUB-2 (MUST):** Mosaic teaser — the pixel-P rendered with one anonymous square per unique attendee and a live count: "1,047 people are in the P. Find your pixel." No names public. This line is the conversion funnel.

**PUB-3 (MUST):** No player names, stats, or profiles on the public layer beyond the current week's champion names (see PRIV-2 consent). Keeping player data off the open internet lowers privacy stakes and support burden.

**PUB-4 (SHOULD):** Join page presents membership with founding-24 scarcity honestly (spots remaining if any, waitlist if full, founding rate locked forever). Exclusivity must be real and enforced to retain credibility.

## 6. Authentication & Identity

Research verdict: magic links fit a low-frequency login, but they are the highest-risk single component (deliverability, cross-device breakage, in-app browsers). De-risk accordingly.

**AUTH-1 (MUST):** Supabase Auth passwordless email: magic link **plus a 6-digit OTP code shown in the same email** as an equal alternative. The OTP defeats the request-on-laptop/open-on-phone failure and in-app-browser cookie isolation. No passwords exist anywhere, ever — zero credential support.

**AUTH-2 (MUST):** Transactional email via **Resend** (free tier: 3,000/month, 100/day) with SPF/DKIM/DMARC configured on the club domain — deliverability is the #1 magic-link failure mode. Launch-day note: the 100/day cap can throttle a mass claim wave; either stagger the launch announcement or upgrade for launch month. Postmark is the fallback if deliverability wobbles. Account creation and DNS verification are owner tasks; SMTP credentials go into Supabase Auth settings.

**AUTH-3 (MUST):** Long-lived sessions (90-day default) so re-login is rare; "keep me signed in" is the default, not an option.

**AUTH-4 (MUST):** Pre-seeded identity: import Acuity booking emails and match them to roster player IDs before launch, so most people log in and are already themselves. One table: `auth_user → player_id`.

**AUTH-5 (MUST):** Fallback claim flow: unmatched emails get a one-time "find your name" picker from the roster. Auto-approve on claim; admin has a revoke switch. No approval queue — in a community where everyone knows each other and data is read-only, a revoke button beats a weekly moderation chore.

**AUTH-6 (MUST):** A player can be linked to exactly one auth user; conflicts (second email claims a claimed player) surface to admin rather than overwriting.

**AUTH-7 (SHOULD):** Launch communication frames it as "you already have a profile — come claim it" (the roster pre-exists; claiming is the activation moment).

## 7. Personal Dashboard (logged-in landing)

**DASH-1 (MUST):** Header identity: name, member number if member, founding badge if #001–#024. No division or tier indicator of any kind (PRIV-6).

**DASH-2 (MUST):** Season line: sessions attended, games played, W-L, championships.

**DASH-3 (MUST):** Streaks — weekly cadence, framed positively only: show current attendance streak and personal-best streak. **Never** display "streak broken," loss framing, or shame states. (Strava's weekly-cadence lesson; Peloton's "breaking a streak feels like a loss" is the anxiety vector to avoid.)

**DASH-4 (MUST):** Milestone progress: nearest milestone club and distance to it ("2 sessions from your 25th — The 25 Club").

**DASH-5 (MUST):** Your pixel: the mosaic with the viewer's square highlighted.

**DASH-6 (MUST):** Latest recap card linking to the full recap.

**DASH-7 (MUST):** Private rank, **hidden by default** behind a "show my rank" toggle (preference persisted per player). Rationale: the chess.com/Lichess "Zen mode" lesson — the private number can recreate exactly the rating obsession the whole design avoids. Public board stays top-10 regardless (LB-1).

**DASH-8 (LATER):** Personal upcoming bookings (requires Acuity integration; out of v1).

## 8. Session Recaps

The emotional payload and the twice-weekly visit driver. Currently this value dies in a WhatsApp message.

**REC-1 (MUST):** One recap page per published session: date, venue, champions per division, full results list, attendance count.

**REC-2 (MUST):** Auto-computed notable lines (2–4 per session) from data: first championship, streak extended/ended (neutral phrasing), undefeated night, milestone reached, record threatened or set, rivalry series update.

**REC-3 (MUST):** Human note: a 3–4 sentence admin-authored narrative, entered as one text field on the Publish screen. Research: the human story is the retention magic (Parkrun run reports); cost is near zero.

**REC-4 (SHOULD):** Lightweight recognition slots on the Publish screen (optional): shout-outs for contribution — guests brought, spirit of the night, helper of the week. Recognition for contribution, not just winning, is core to Parkrun's retention.

**REC-5 (MUST):** Recaps are permanent and browsable (archive by date/venue).

## 9. Champions Wall & Records Book

**CHW-1 (MUST):** Every session's champions, forever, accumulating automatically from publishes. Wednesday: Champion of the Week (unified bracket). Sunday: PTO Champion of the Week (Court 3) plus Court 1 and Court 2 Champions. Private-club honor-board tradition, digitized.

**CHW-2 (MUST):** Records Book: all-time records computed from published data — longest win streak, most championships, most games in a season, most sessions attended, longest attendance streak. Records give ordinary sessions historical stakes ("one more win ties the record").

**CHW-3 (MUST):** Champion titles use court/title names only (PRIV-6). A/B/C and any division labels must be physically absent from site data (PIPE-1).

## 10. Leaderboards & Milestones

Design law: **leaderboards for the top, milestones for everyone.** Absolute leaderboards demotivate the bottom 90%; badges/milestones satisfy competence without forced comparison.

**LB-1 (MUST):** Public boards show **top 10 only.** No full ranking table exists anywhere on the site. Boards: season Win% (with minimum-games qualifier, e.g., 8 games), attendance (sessions this season), games played.

**LB-2 (MUST):** Accumulative boards (attendance, games) are the featured boards; Win% is present but not primary. Anyone can top attendance by showing up — that's the point.

**LB-3 (MUST):** Win% privacy opt-out: a player can hide their Win% from other viewers; accumulative stats (sessions, games, championships, milestones) remain visible. Preference per player.

**LB-4 (MUST):** PTO Points — the prestige board and the carrier of the internal hierarchy (PRIV-6). Tour-style: titles earn openly-published point values, identical for every player — the weighting lives on events, never on players. **Initial config (owner-set, per player):** Champion of the Week (Wed) 100 / PTO Champion of the Week (Sun, Court 3) 100 / Court 2 Champions 60 / Court 1 Champions 40; finalists earn half the title (50/50/30/20). WSO "crown current leader" endings: champion full points, runner-up by wins takes finalist points. Practice sessions score zero. No semifinal/appearance points in v1 (reserved as a future season refresh per MILE-3). Top-10 display per LB-1; season points leader feeds SEA-1.

**MILE-1 (MUST):** Milestone clubs, Parkrun-style — the primary gamification mechanic and the strongest retention lever in the comparable set: attendance clubs at 10 / 25 / 50 / 100 sessions (named, badged, permanent), plus games-played tiers and championship counts. Earned by persistence, never performance: "whether you win or lose, you're in the 50 Club."

**MILE-2 (SHOULD):** Milestone moments auto-surface in recaps (REC-2) and on the dashboard (DASH-4).

**MILE-3 (SHOULD):** Refresh cadence: seasons, new award slates, or new milestone tiers — never new mechanics — to counter the documented gamification novelty fade at ~2–3 months.

## 11. Player Profiles & Rivalries

**PROF-1 (MUST):** Auto-generated profile for every roster player (claimed or not): display name, member/founding badges, sessions, games, W-L (subject to LB-3), championships with dates and titles, PTO Points, milestone badges, best streak. No division or tier field.

**PROF-2 (MUST):** Rivalries auto-detected: any two players/pairs who have met 3+ times get a head-to-head series line on both profiles ("Duke leads Benson 4–3 all-time"). Pure retention fuel from existing data; writes next week's storyline by itself.

**PROF-3 (MUST):** Admin "hide this player" flag and pseudonym option (see PIPE-3). Hidden players vanish from all site surfaces including the mosaic name-hover; their games remain as anonymized entries in results.

**PROF-4 (LATER):** Shareable designed player cards (pixel-P trading-card aesthetic).

## 12. Mosaic (full)

**MOS-1 (MUST):** Inside the club: the pixel-P where every attendee is one square; hover/tap reveals name → profile link. Regenerated at each publish. Rendered as static SVG (no live queries).

**MOS-2 (MUST):** Viewer's own pixel highlighted (DASH-5).

## 13. Member Identity & Status

**MEM-1 (MUST):** Member numbers: #001–#024 founding, permanent, then sequential for life. Displayed wherever the name appears. Time-tested private-club belonging mechanic; near-zero build cost (one column).

**MEM-2 (MUST):** Founding badge distinct from member badge; founding rate lock is *displayed* identity ("Founding Member — rate locked"), not just billing.

**MEM-3 (MUST):** Member status synced from Stripe manually or via simple flag in v1 (no billing integration on-site).

## 14. Seasons & Voted Awards (v1.5)

**SEA-1 (SHOULD):** Seasons: 8–12 week named arcs; the Season Champion is the PTO Points leader (LB-4); season boards reset (all-time records persist). Season boundaries are re-entry points for lapsed players and the sanctioned novelty-refresh mechanism.

**SEA-2 (SHOULD):** Voted awards per season: MVP, Most Improved, Rookie of the Season, Sixth Man (best-spirited sub). Effort/belonging awards anyone can win. Vote runs as a simple external one-off form (preserves the no-UGC model); results published as a special recap.

**SEA-3 (COULD):** The same form pattern serves real club decisions (golden point, racket colorway) — the club asking its members is itself a retention feature.

## 15. Publish Pipeline & Data Requirements

The entire ongoing operation is one action. Architecture principle: same as Court Manager's court isolation — make privacy leaks structurally impossible, not policed.

**PIPE-1 (MUST):** Public tables physically contain no tier data. The publish action copies only safe fields: player display names + IDs, pair compositions, game results (winner/loser), champions with **court/title names and PTO Points mapped at publish time** (title + point config, never tier labels), attendance, timestamps, session metadata. The site reads only these tables; it cannot leak what it cannot read. The site never touches Court Manager tables.

**PIPE-2 (MUST):** Publish lives on the Court Manager session summary beside the WhatsApp share: [PUBLISH TO SITE] → shows the recap-note field (REC-3) and optional shout-outs (REC-4) → confirm → copy + recompute derived tables (standings, records, milestones, rivalries, mosaic) → done. Target: under 2 minutes of admin time per session.

**PIPE-3 (MUST):** The pipeline respects hide/pseudonym flags at copy time (PROF-3) and honors practice-session flags (practice sessions never publish to leaderboards/records; recap optional).

**PIPE-4 (MUST):** Republish is idempotent — correcting a result in Court Manager and re-tapping Publish updates the site cleanly (upsert by session ID).

**PIPE-5 (MUST):** Stable player IDs from the shared roster are the join key everywhere (Court Manager Architectural Law #2).

**PIPE-6 (SHOULD):** Derived data (records, milestones, rivalries, mosaic SVG) is computed at publish time and stored, so page loads are reads, not computations.

## 16. Privacy & Compliance (PIPEDA)

A paid-membership club is commercial activity under PIPEDA; publishing names/results is a disclosure requiring meaningful consent (OPC guidance; Case Summary #2019-006 on club directories).

**PRIV-1 (MUST):** Explicit publication consent collected at membership signup and at profile claim: name + results + championships may appear on the members' site. Stored per player with date.

**PRIV-2 (MUST):** The only public-layer names are current-week champions; champion publication is covered in the consent language, and any player may opt out of even that (falls back to pair-partner-only or "Champions" without the name).

**PRIV-3 (MUST):** Genuine opt-out anytime: pseudonym or fully hidden profile (PROF-3), honored across all surfaces including historical recaps at next publish.

**PRIV-4 (MUST):** Minors policy before launch: confirm whether any attendees are under 18; parental consent required under 13 and cautious handling under 18. If minors exist, default them to hidden.

**PRIV-5 (MUST):** A plain-language privacy note page: what's shown, to whom (login-gated), how to opt out, contact.

**PRIV-6 (MUST) — RESOLVED:** No divisions are published, ever. Tier hierarchy is expressed structurally, never as labels or hidden math: (a) Wednesday's unified champion already embodies the internal A-first rules upstream in Court Manager; (b) Sunday champions are named by court — "Court 1/2 Champions" plus the premier "PTO Champion of the Week" for Court 3; (c) season hierarchy lives in the PTO Points system (LB-4) where *titles* openly carry different values. **Explicitly prohibited:** hidden per-win tier multipliers (e.g., A win secretly worth 3). Hidden player-level weights are decodable, unexplainable when questioned, and reproduce Playtomic's "rigged algorithm" resentment — the exact failure this design avoids. Weight events, never players.

## 17. Non-Functional Requirements

**OPS-1 (MUST):** Weekly operation = play session → tap Publish (+ 3-sentence note) → done. No moderation, no UGC, nothing dynamic between sessions. Occasional Claude Code sessions only for new pages/tweaks.

**OPS-2 (MUST):** Stack: React + Supabase, consistent with the existing repo; buildable and maintainable entirely via Claude Code by a non-engineer.

**OPS-3 (MUST):** Read-heavy, effectively-static delivery: pages read precomputed tables; no per-visitor computation; mosaic as static SVG.

**DES-1 (MUST):** Brand: pixel-P identity, volt (#C8D200) on dark (#1A1A1A) with the club's warm neutrals; mobile-first (members check phones post-session); fast, minimal, premium. *(Repo note: implemented on Brand Book v2 tokens — lime #D9E270 on forest #0A1810 — which supersede these hex values; see CLUBHOUSE-STATUS.md.)*

**DES-2 (MUST):** Tone rules enforced in copy: streaks never shame (DASH-3); milestones celebrate persistence ("you showed up 50 times"); leaderboards never show below top 10; the word "rank" appears only behind the personal toggle.

**DES-3 (MUST):** /manage and /manage2 remain unlinked, robots-blocked, and visually absent from the site.

## 18. Success Metrics & Watch Thresholds

Measure: claim rate (% of active players linked within 60 days), post-publish visits (unique logins within 48h of each session), 4-week repeat-attendance rate for players with claimed profiles vs not, membership conversions and renewals, publish-to-live time.

Research-derived thresholds that change the plan:
- **Login friction:** more than a handful of login-help requests per session → escalate OTP prominence and session length; consider device-remembering.
- **Rating anxiety:** players asking for tiers/visible ratings, or attendance drops following losing streaks → keep rank/Win% hidden-by-default permanently; reinforce divisions and milestones. This is the Playtomic trap re-emerging; do not feed it.
- **Novelty fade** (~2–3 months engagement dip): respond with a new season/awards/milestone tier, never a new mechanic.

## 19. Open Decisions (owner, before launch)

1. **~~Division names + point values~~ — RESOLVED:** no divisions published; court/title naming + PTO Points carry the hierarchy (PRIV-6, LB-4, values set). Win% board confirmed: stays beside the points board with the 8-game qualifier.
2. **~~Consent + privacy note language~~ — DRAFTED:** see Appendix A (plain-language draft; not legal advice — optional lawyer review before launch).
3. **Minors check** — yes/no, and default-hidden policy if yes.
4. **Season 1 definition** — start date, length, award slate (can trail v1 launch).
5. **Founding-24 status** — how many claimed, what the join page says today.

## 20. Build Sequence (Claude Code waves)

1. **Public tables + publish pipeline** (PIPE-1..6) with hide/pseudonym/practice handling — the foundation; testable by publishing a past session.
2. **Auth** (AUTH-1..6): Supabase magic link + OTP, email provider, pre-seeded links, find-your-name claim, revoke.
3. **Core pages:** dashboard, recap, champions wall + records, leaderboards + milestones, profiles + rivalries, mosaic.
4. **Public teaser** + join page + privacy note.
5. **Consent capture** at claim + membership signup; hide/pseudonym self-service.
6. **v1.5:** seasons + voted-awards publishing; recognition polish.

Acceptance test for v1: publish one real session end-to-end; a player receives the launch email, logs in via OTP on a phone from an Instagram in-app browser (the worst case), lands on their dashboard, sees their pixel, their streak, their milestone progress, and the recap — and an opted-out player appears nowhere.

---

## Appendix A — Consent & Privacy Language (plain-language drafts)

*Drafts for PRIV-1, PRIV-2, and PRIV-5. Written to be human and on-brand, not legalese. Not legal advice; a lawyer review before launch is optional but sensible. Pending the minors decision (§19.3), add the 18+ line if confirmed.*

### A1. Consent checkbox (shown at profile claim and membership signup)

> ☐ I'm good with Club PTO showing my name and my session results — games played, wins, championships, streaks, and milestones — inside the members-only clubhouse site. If I win a championship, my name can appear on the public page that week. I can switch to a nickname or hide my profile completely at any time, in my settings or by messaging the club.

### A2. Privacy note page (linked from footer and from the consent checkbox)

**Your info at Club PTO — the short version**

**What we have.** Your name, your email (for login and club messages), and what happens at sessions: check-ins, games, results, championships. That's it. We don't collect your birthday, address, or payment details — membership billing is handled by Stripe on their systems.

**Where it shows up.** Inside the clubhouse — the members-only, login-required part of this site — your profile shows your sessions, games, results, championships, streaks, and milestones. The public part of the site shows one thing with names on it: each week's champions. Everything else public is anonymous (like the pixel count in the P).

**What never shows up.** How we group players internally for balanced games. That stays between the organizers, full stop. Your contact info is never displayed anywhere.

**Your controls.** Don't want your win rate visible to others? Turn it off in settings. Want to appear under a nickname, or not appear at all? One tap, or message us — it applies everywhere from the next session onward, and we'll honor it, no questions.

**Questions.** Message the club or email clubptobookings@gmail.com. We're a small club; a human answers.
