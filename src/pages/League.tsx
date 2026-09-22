// PTO League — Season 1 landing page.
//
// Built off the approved copy for the Founding Season. Follows the Skill
// Lab structural pattern (ribbon → hero → numbered sections → gold
// inversion band → sticky bar) so the two program pages read as siblings.
// Operational facts live in src/content/league.ts; the registration URL
// stays TODO_BENSON until the Acuity link is pinned, and every CTA falls
// through to #pricing so nothing is ever a dead end.

import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { league, leagueCtaHref, leagueSpotsRemaining } from "@/content/league";
import "./league.css";

const CTA_LABEL = "Join the league →";
const CTA_LABEL_FOUNDING = "Join the founding roster →";
const CTA_LABEL_SEASON = "Sign for Season 1 →";

/** ms in a day, hour, minute, second — used by the countdown timer. */
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;
const SEC = 1_000;

/**
 * Countdown to a fixed ISO instant. Ticks every second, stops at zero.
 * All viewers see the same figures regardless of their machine timezone
 * because the target carries an explicit -04:00 offset.
 *
 * Only CountdownBar calls this — deliberately. At 1 Hz this re-renders
 * its caller every second, and the League page is full of whileInView
 * motion sections that must not be asked to re-evaluate that often.
 */
const useCountdown = (targetISO: string) => {
  const target = new Date(targetISO).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), SEC);
    return () => window.clearInterval(id);
  }, []);
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff % DAY) / HOUR),
    minutes: Math.floor((diff % HOUR) / MIN),
    seconds: Math.floor((diff % MIN) / SEC),
    msLeft: diff,
    closed: diff === 0,
  };
};

/** Two-digit zero-padded for the countdown display. */
const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Bucket the spots-remaining count into a status class name. */
const spotsToneClass = (remaining: number): string => {
  if (remaining < 5) return "lg-spots--red";
  if (remaining < 10) return "lg-spots--gold";
  return "lg-spots--green";
};

/** "2026-10-04" → "Sunday, October 4, 2026" — the copy's long form. */
const longDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

/** "2026-10-04" → "October 4" — for tight copy. */
const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
};

const HOW_IT_WORKS = [
  {
    title: "Sign for Season 1",
    text: "Register individually. No partner needed. You enter the league on your own.",
  },
  {
    title: "Play your weekly matchups",
    text: "Two matches every Sunday. New partner each time. The schedule rotates to maximize variety across the season.",
  },
  {
    title: "Climb the table",
    text: "Win = 3 points. Draw = 1. Loss = 0. Your results follow you — not your team.",
  },
  {
    title: "Make the Top 8",
    text: "After 7 weeks, the Top 8 in each division qualify for the PTO Tournament. One champion crowned per division.",
  },
];

const WHAT_YOU_GET = [
  {
    title: "Your name on the table",
    text: "Every player gets an individual position in the official PTO League standings. Updated weekly. Posted publicly.",
  },
  {
    title: "Your weekly matchups",
    text: "New partners. New opponents. New chances to move up. Every Sunday is a different test.",
  },
  {
    title: "Your moments",
    text: "Highlights, reactions, player features, and league content throughout the season. You're not just playing — you're getting covered.",
  },
  {
    title: "Your shot at finals",
    text: "Finish Top 8 and your season continues at the PTO Tournament. Everyone else watches.",
  },
];

const PATHWAY = [
  { label: "Skill Lab", text: "Learn the fundamentals", href: "/skills-lab" },
  { label: "Weekly Meets", text: "Play and meet the community", href: "/book" },
  { label: "PTO League", text: "Compete, get ranked, make the Top 8", here: true },
  { label: "Tournaments", text: "Test yourself against the best" },
];

const FAQ = [
  {
    q: "Do I need a partner?",
    a: "No. Everyone registers individually. Partners rotate throughout the season.",
  },
  {
    q: "Will I play with every player in my division?",
    a: "The schedule is designed to maximize the number of different partners and opponents you play. Because the divisions have different roster sizes, exact rotations will vary.",
  },
  {
    q: "How many matches do I play?",
    a: "Two matches every Sunday — 14 scheduled matches across the 7-week regular season.",
  },
  {
    q: "Do I have to be advanced?",
    a: "No. You need enough experience to comfortably play a match and understand basic rules and scoring.",
  },
  {
    q: "What if I'm brand new to padel?",
    a: "Start with Club PTO Skill Lab or a regular Meet first. The league will be here when you're ready.",
  },
  {
    q: "What if I miss a Sunday?",
    a: "Notify us at least 48 hours in advance. An approved reserve player may fill your spot. You receive no points for matches you miss.",
  },
  {
    q: "Can I sign up with a friend?",
    a: "Yes — but you're not registering as a doubles team. You both compete independently.",
  },
  {
    q: "How do I qualify for the PTO Tournament?",
    a: "Finish inside the Top 8 of your division after Week 7.",
  },
  {
    q: "What do the champions receive?",
    a: "Each division winner receives the inaugural PTO League Championship trophy. Additional prizes may be announced before the tournament.",
  },
  {
    q: "When does registration close?",
    a: "September 29, or when all 32 roster spots are claimed — whichever comes first.",
  },
  {
    q: "Will there be a Season 2?",
    a: "Season 1 is our Founding Season. Future seasons will be announced afterward. Season 1 players may receive priority access.",
  },
];

/**
 * The sticky bar — appears when the hero scrolls off, so the primary CTA
 * is never more than a thumb-tap away on mobile.
 */
const StickyBar = memo(({ onDismiss }: { onDismiss: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 16 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="lg-sticky"
  >
    <p className="lg-label lg-sticky__fact">PTO League · Season 1</p>
    <a
      className="rly-pill lg-cta"
      href={leagueCtaHref()}
      target={leagueCtaHref().startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
    >
      Join
    </a>
    <button
      type="button"
      className="lg-sticky__dismiss"
      aria-label="Dismiss"
      onClick={onDismiss}
    >
      ✕
    </button>
  </motion.div>
));
StickyBar.displayName = "StickyBar";

/**
 * The pinned countdown strip. Owns the 1 Hz timer so the rest of the
 * page — every whileInView motion section below — renders once and is
 * left alone. `position: fixed` rather than `sticky`: the framer-motion
 * PageWrapper's transform creates a containing block that breaks sticky,
 * and a spacer sibling reserves the strip's height in the flow.
 */
const CountdownBar = () => {
  const countdown = useCountdown(league.registrationCloseAt);
  // The strip is out of flow, so a sibling spacer has to hold its height
  // open. Measuring beats hard-coding: the bar grows when the row wraps on
  // a narrow phone and again when an urgency badge appears in the last 72
  // hours, and a stale constant would let content slide underneath.
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      // borderBoxSize, not contentRect: the strip carries 22px of vertical
      // padding plus a hairline border, and contentRect excludes both —
      // sizing the spacer from it leaves the hero 23px under the bar.
      const box = entry.borderBoxSize?.[0];
      setBarHeight(
        box ? box.blockSize : el.getBoundingClientRect().height,
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Urgency tiers from the deck: brighter band in the final 72 hours,
  // clay in the final 24. Outside those windows it stays the base volt.
  const tone = countdown.closed
    ? "lg-countdown--closed"
    : countdown.msLeft < DAY
      ? "lg-countdown--last"
      : countdown.msLeft < 3 * DAY
        ? "lg-countdown--final"
        : "";
  const badge = countdown.closed
    ? "Registration closed"
    : countdown.msLeft < DAY
      ? "Last chance"
      : countdown.msLeft < 3 * DAY
        ? "Final days"
        : null;

  const units: { value: number; label: string }[] = [
    { value: countdown.days, label: "Days" },
    { value: countdown.hours, label: "Hours" },
    { value: countdown.minutes, label: "Minutes" },
    { value: countdown.seconds, label: "Seconds" },
  ];

  return (
    <>
      <div ref={barRef} className={`lg-countdown ${tone}`}>
        <div className="lg-countdown__row">
          <p className="lg-label lg-countdown__deadline">
            {countdown.closed
              ? "Season 1 registration is closed"
              : `Season 1 registration closes ${shortDate(
                  league.registrationCloseAt.slice(0, 10),
                )}`}
          </p>
          {!countdown.closed && (
            <p className="lg-countdown__timer">
              {/* The visible cells are decorative-duplicated for screen
                  readers by the sr-only line below, which only announces
                  at minute granularity — a per-second aria-live region
                  would flood assistive tech. */}
              <span aria-hidden="true" className="lg-countdown__cells">
                {units.map((u, i) => (
                  <span key={u.label} className="lg-countdown__unit">
                    {i > 0 && <span className="lg-countdown__colon">:</span>}
                    <span className="lg-countdown__cell">
                      <b>{pad2(u.value)}</b>
                      <em>{u.label}</em>
                    </span>
                  </span>
                ))}
              </span>
              <span className="lg-sr-only">
                {countdown.days} days, {countdown.hours} hours and{" "}
                {countdown.minutes} minutes left to register.
              </span>
            </p>
          )}
        </div>
        <p className="lg-countdown__sub">
          {badge && <span className="lg-countdown__badge">{badge}</span>}
          Season starts {shortDate(league.startDate)}. {league.spotsClaimed} of{" "}
          {league.totalRoster} spots claimed.
        </p>
      </div>
      {/* Spacer — reserves exactly the fixed strip's height so page
          content never sits under it. Falls back to the CSS var until
          the first measurement lands. */}
      <div
        className="lg-countdown-spacer"
        aria-hidden="true"
        style={barHeight != null ? { height: barHeight } : undefined}
      />
    </>
  );
};

const League = () => {
  useEffect(() => {
    const previous = document.title;
    document.title = "PTO League · Club PTO";
    return () => {
      document.title = previous;
    };
  }, []);

  const heroRef = useRef<HTMLElement | null>(null);
  const [heroGone, setHeroGone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setHeroGone(!entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ctaHref = leagueCtaHref();
  const ctaTarget = ctaHref.startsWith("http") ? "_blank" : undefined;
  const remaining = leagueSpotsRemaining();
  const spotsTone = spotsToneClass(remaining);

  return (
    <PageWrapper>
      <MotionConfig reducedMotion="user">
        <div className="lg-page">
          {/* ── countdown bar — pinned top, always in view ──────────── */}
          <CountdownBar />

          {/* ── hero — headline left, stat/card feel right ─────────── */}
          <section ref={heroRef} className="lg-hero">
            <div>
              <p className="lg-label lg-hero__eyebrow">
                PTO Padel League — Season 1
              </p>
              <h1 className="rly-display lg-hero__title">
                Your Sunday games
                <br />
                just got more
                <br />
                <i>interesting.</i>
              </h1>
              <p className="lg-hero__sub">
                Seven Sundays. Rotating partners. Your own ranking. Play your
                matches. Earn your points. Climb the table. Get featured. Make
                the Top 8. Then step onto the court for the season-ending PTO
                Tournament.
              </p>
              <p className="lg-hero__sub lg-hero__sub--tight">
                {league.totalRoster} players. One Founding Season.
              </p>
              <div className="lg-hero__action">
                <a
                  className="rly-pill lg-cta"
                  href={ctaHref}
                  target={ctaTarget}
                  rel="noopener noreferrer"
                >
                  {CTA_LABEL}
                </a>
                <a className="lg-hero__how" href="#how-it-works">
                  See how it works ↓
                </a>
              </div>
              <p className="lg-label lg-hero__meta">
                {league.mensRoster} Men · {league.womensRoster} Women · $
                {league.fullPrice} Founding Season Entry
              </p>
              <p className="lg-hero__note">
                Season 1 starts {shortDate(league.startDate)} at{" "}
                {league.venueName}.
              </p>
              <p className={`lg-hero__urgency lg-spots ${spotsTone}`}>
                Registration closes{" "}
                {shortDate(league.registrationCloseAt.slice(0, 10))}.{" "}
                <b>
                  {league.spotsClaimed} of {league.totalRoster} spots claimed.
                </b>
              </p>
              <div className="lg-stats">
                <div className="lg-stat">
                  <span className="lg-stat__num">
                    {league.regularSeasonWeeks}
                  </span>
                  <span className="lg-label lg-stat__label">Weeks</span>
                </div>
                <div className="lg-stat">
                  <span className="lg-stat__num">{league.totalMatches}</span>
                  <span className="lg-label lg-stat__label">Matches</span>
                </div>
                <div className="lg-stat">
                  <span className="lg-stat__num">{league.totalRoster}</span>
                  <span className="lg-label lg-stat__label">Players</span>
                </div>
              </div>
            </div>
            {/* Player card floats on the right on desktop; sits under the
                hero copy on mobile. Sports-graphic energy without a photo. */}
            <div className="lg-hero__card" aria-hidden="true">
              <div className="lg-pcard">
                <div className="lg-pcard__row">
                  <span className="lg-pcard__logo">PTO</span>
                  <span className="lg-pcard__season">S01</span>
                </div>
                <div className="lg-pcard__name">Michael</div>
                <div className="lg-pcard__div">Men's Division</div>
                <div className="lg-pcard__stats">
                  <div className="lg-pcard__stat">
                    <span className="lg-pcard__k">Rank</span>
                    <span className="lg-pcard__v">#7</span>
                  </div>
                  <div className="lg-pcard__stat">
                    <span className="lg-pcard__k">Points</span>
                    <span className="lg-pcard__v">12</span>
                  </div>
                  <div className="lg-pcard__stat">
                    <span className="lg-pcard__k">Record</span>
                    <span className="lg-pcard__v">4W 2D 2L</span>
                  </div>
                </div>
                <div className="lg-pcard__form">
                  <span className="lg-pcard__k">Form</span>
                  <span className="lg-pcard__pips">
                    <b className="lg-pip lg-pip--w">W</b>
                    <b className="lg-pip lg-pip--w">W</b>
                    <b className="lg-pip lg-pip--d">D</b>
                    <b className="lg-pip lg-pip--w">W</b>
                  </span>
                </div>
                <div className="lg-pcard__status">↑ 3 · Top 8</div>
              </div>
            </div>
          </section>

          {/* ── the experience ─────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-section lg-section--raised"
          >
            <div className="lg-inner">
              <motion.p variants={fadeUp} className="lg-label lg-eyebrow">
                the experience
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display lg-h2">
                You're not just playing matches.
                <br />
                You're competing for a <i>league trophy.</i>
              </motion.h2>
              <motion.div variants={fadeUp} className="lg-exp__lines">
                <p>For seven weeks, you're officially a PTO League player.</p>
                <p>You'll have your own ranking.</p>
                <p>Your results will be tracked.</p>
                <p>Your highlights might end up on the feed.</p>
                <p>Your name moves up and down the standings.</p>
                <p>There'll be players chasing you.</p>
                <p>You'll be chasing someone else.</p>
                <p>And every Sunday gives the league another storyline.</p>
              </motion.div>
              <motion.p variants={fadeUp} className="lg-exp__close">
                Think rec league with pro-sports energy.
              </motion.p>
            </div>
          </motion.section>

          {/* ── how it works ───────────────────────────────────────── */}
          <motion.section
            id="how-it-works"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-section"
          >
            <div className="lg-inner">
              <div className="lg-steps__head">
                <div>
                  <motion.p variants={fadeUp} className="lg-label lg-eyebrow">
                    how it works
                  </motion.p>
                  <motion.h2 variants={fadeUp} className="rly-display lg-h2">
                    Your padel career starts here.
                  </motion.h2>
                </div>
                <motion.p variants={fadeUp} className="lg-steps__intro">
                  Four steps. Seven Sundays. One inaugural roster of{" "}
                  {league.totalRoster}.
                </motion.p>
              </div>
              <ol className="lg-steps__grid">
                {HOW_IT_WORKS.map((step, i) => (
                  <motion.li
                    variants={fadeUp}
                    key={step.title}
                    className={`lg-step ${i === 0 ? "lg-step--first" : ""}`}
                  >
                    <div className="lg-step__num">{`0${i + 1}`}</div>
                    <h3 className="lg-step__title">{step.title}</h3>
                    <p className="lg-step__text">{step.text}</p>
                  </motion.li>
                ))}
              </ol>
            </div>
          </motion.section>

          {/* ── what you get — 2x2 cards ───────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-section lg-section--raised"
          >
            <div className="lg-inner">
              <motion.p variants={fadeUp} className="lg-label lg-eyebrow">
                what you get
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display lg-h2">
                Signing gets you more than a match slot.
              </motion.h2>
              <ul className="lg-cards__grid">
                {WHAT_YOU_GET.map((card) => (
                  <motion.li
                    variants={fadeUp}
                    key={card.title}
                    className="lg-card"
                  >
                    <h3 className="lg-card__title">{card.title}</h3>
                    <p className="lg-card__text">{card.text}</p>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.section>

          {/* ── player identity ────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-section"
          >
            <div className="lg-inner">
              <div className="lg-identity__grid">
                <div>
                  <motion.p variants={fadeUp} className="lg-label lg-eyebrow">
                    every player gets a card
                  </motion.p>
                  <motion.h2 variants={fadeUp} className="rly-display lg-h2">
                    Your card. Your stats.
                    <br />
                    Your <i>season.</i>
                  </motion.h2>
                  <motion.p variants={fadeUp} className="lg-identity__copy">
                    When you sign for Season 1, you're part of the roster. Your
                    stats are tracked. Your ranking is public. Your card updates
                    every week.
                  </motion.p>
                  <motion.p variants={fadeUp} className="lg-label lg-identity__note">
                    Share it · repost it · talk about it
                  </motion.p>
                </div>
                <motion.div
                  variants={fadeUp}
                  className="lg-pcard lg-pcard--big"
                  aria-hidden="true"
                >
                  <div className="lg-pcard__row">
                    <span className="lg-pcard__logo">PTO</span>
                    <span className="lg-pcard__season">S01</span>
                  </div>
                  <div className="lg-pcard__name">Michael</div>
                  <div className="lg-pcard__div">PTO League · Men's Division</div>
                  <div className="lg-pcard__stats">
                    <div className="lg-pcard__stat">
                      <span className="lg-pcard__k">Rank</span>
                      <span className="lg-pcard__v">#7</span>
                    </div>
                    <div className="lg-pcard__stat">
                      <span className="lg-pcard__k">Points</span>
                      <span className="lg-pcard__v">12</span>
                    </div>
                    <div className="lg-pcard__stat">
                      <span className="lg-pcard__k">Record</span>
                      <span className="lg-pcard__v">4W 2D 2L</span>
                    </div>
                  </div>
                  <div className="lg-pcard__form">
                    <span className="lg-pcard__k">Form</span>
                    <span className="lg-pcard__pips">
                      <b className="lg-pip lg-pip--w">W</b>
                      <b className="lg-pip lg-pip--w">W</b>
                      <b className="lg-pip lg-pip--d">D</b>
                      <b className="lg-pip lg-pip--w">W</b>
                    </span>
                  </div>
                  <div className="lg-pcard__status">
                    ↑ 3 positions this week · Status: TOP 8
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* ── league details table ───────────────────────────────── */}
          <motion.section
            id="details"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-section lg-section--raised"
          >
            <div className="lg-inner">
              <motion.p variants={fadeUp} className="lg-label lg-eyebrow">
                season 1 details
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display lg-h2">
                The facts.
              </motion.h2>
              <motion.dl variants={fadeUp} className="lg-facts">
                <div className="lg-fact">
                  <dt className="lg-fact__k">Start date</dt>
                  <dd className="lg-fact__v">{longDate(league.startDate)}</dd>
                </div>
                <div className="lg-fact">
                  <dt className="lg-fact__k">Regular season</dt>
                  <dd className="lg-fact__v">
                    {league.regularSeasonWeeks} weeks (
                    {shortDate(league.startDate)} –{" "}
                    {shortDate(league.endDate)})
                  </dd>
                </div>
                <div className="lg-fact">
                  <dt className="lg-fact__k">PTO Tournament</dt>
                  <dd className="lg-fact__v">
                    {shortDate(league.tournamentDate)}
                  </dd>
                </div>
                <div className="lg-fact">
                  <dt className="lg-fact__k">Day &amp; time</dt>
                  <dd className="lg-fact__v">
                    {league.sessionDay}, {league.sessionTime}
                  </dd>
                </div>
                <div className="lg-fact">
                  <dt className="lg-fact__k">Location</dt>
                  <dd className="lg-fact__v">
                    {league.venueName}, {league.venueArea}
                  </dd>
                </div>
                <div className="lg-fact">
                  <dt className="lg-fact__k">Divisions</dt>
                  <dd className="lg-fact__v">
                    Men's ({league.mensRoster}) + Women's (
                    {league.womensRoster})
                  </dd>
                </div>
                <div className="lg-fact">
                  <dt className="lg-fact__k">Matches</dt>
                  <dd className="lg-fact__v">
                    {league.matchesPerWeek} per week / {league.totalMatches}{" "}
                    total
                  </dd>
                </div>
                <div className="lg-fact">
                  <dt className="lg-fact__k">Match format</dt>
                  <dd className="lg-fact__v">
                    18–20 min, no-ad scoring, hard time cap
                  </dd>
                </div>
                <div className="lg-fact">
                  <dt className="lg-fact__k">Total spots</dt>
                  <dd className="lg-fact__v">{league.totalRoster}</dd>
                </div>
                <div className="lg-fact">
                  <dt className="lg-fact__k">Registration closes</dt>
                  <dd className="lg-fact__v">
                    {shortDate(league.registrationCloseAt.slice(0, 10))} ·{" "}
                    <span className={`lg-spots ${spotsTone}`}>
                      {league.spotsClaimed} of {league.totalRoster} claimed
                    </span>
                  </dd>
                </div>
              </motion.dl>
            </div>
          </motion.section>

          {/* ── pricing ────────────────────────────────────────────── */}
          <motion.section
            id="pricing"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-section lg-pricing"
          >
            <div className="lg-inner">
              <motion.p variants={fadeUp} className="lg-label lg-eyebrow">
                pricing
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display lg-h2">
                Sign your Season 1 contract.
              </motion.h2>
              <motion.div variants={fadeUp} className="lg-price">
                <div className="lg-price__head">
                  <span className="lg-label lg-price__label">
                    Founding Season Entry
                  </span>
                  <span className="lg-price__badge">Season 1</span>
                </div>
                <div className="lg-price__amount">${league.fullPrice}</div>
                <div className="lg-price__per">for the seven-week season</div>
                <div className="lg-price__rows">
                  <div className="lg-price__row">
                    Seven-week regular season, {league.totalMatches} scheduled matches
                  </div>
                  <div className="lg-price__row">
                    Official PTO ranking, weekly standings
                  </div>
                  <div className="lg-price__row">
                    Player content and league photography
                  </div>
                  <div className="lg-price__row">
                    Eligibility for the PTO Tournament (if Top 8)
                  </div>
                </div>
                <p className={`lg-price__spots lg-spots ${spotsTone}`}>
                  {league.spotsClaimed} of {league.totalRoster} spots claimed
                </p>
                <a
                  className="rly-pill lg-cta"
                  href={ctaHref}
                  target={ctaTarget}
                  rel="noopener noreferrer"
                >
                  {CTA_LABEL_SEASON}
                </a>
                <p className="lg-label lg-price__meta">
                  ${league.depositPrice} secures your roster spot · balance due
                  before {shortDate(league.depositDeadline)}
                </p>
                <p className="lg-price__fine">
                  Registration closes{" "}
                  {shortDate(league.registrationCloseAt.slice(0, 10))} or when
                  all roster spots are claimed — whichever comes first.
                  Deposits are non-refundable once your roster position is
                  confirmed. League fees are non-refundable once the season
                  begins.
                </p>
              </motion.div>
            </div>
          </motion.section>

          {/* ── who should join ────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-section lg-section--raised"
          >
            <div className="lg-inner">
              <motion.p variants={fadeUp} className="lg-label lg-eyebrow">
                who should join
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display lg-h2">
                Built for people who love to play.
              </motion.h2>
              <motion.ul variants={fadeUp} className="lg-who__lines">
                <li>
                  Maybe you're the person who keeps asking everyone when the
                  next game is.
                </li>
                <li>
                  Maybe you've started taking your matches a little too
                  seriously.
                </li>
                <li>
                  Maybe you already think you're better than your friends.
                </li>
              </motion.ul>
              <motion.p variants={fadeUp} className="lg-who__close">
                Perfect. PTO League gives you somewhere to prove it.
              </motion.p>
              <motion.p variants={fadeUp} className="lg-who__note">
                You don't have to be an advanced player. You just need enough
                padel experience to comfortably serve, rally, keep score, and
                play a full match. This is a social recreational league first.
                Come to compete. Stay for the people, the rivalries, and
                everything around the matches.
              </motion.p>
              <motion.p variants={fadeUp} className="lg-label lg-who__fine">
                New to padel? Start with Club PTO Skill Lab or one of our
                regular Meets first. Registration is subject to skill-fit
                confirmation.
              </motion.p>
            </div>
          </motion.section>

          {/* ── the pathway ────────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-section"
          >
            <div className="lg-inner">
              <motion.p variants={fadeUp} className="lg-label lg-eyebrow">
                where the league fits
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display lg-h2">
                The pathway.
              </motion.h2>
              <ol className="lg-path">
                {PATHWAY.map((step, i) => {
                  const inner = (
                    <>
                      <span className="lg-path__num">{`0${i + 1}`}</span>
                      <span className="lg-path__label">{step.label}</span>
                      <span className="lg-path__text">{step.text}</span>
                      {step.here && (
                        <span className="lg-path__here">You are here</span>
                      )}
                    </>
                  );
                  return (
                    <motion.li
                      variants={fadeUp}
                      key={step.label}
                      className={`lg-path__step ${step.here ? "lg-path__step--here" : ""}`}
                    >
                      {step.href ? (
                        <a href={step.href} className="lg-path__link">
                          {inner}
                        </a>
                      ) : (
                        <div className="lg-path__link">{inner}</div>
                      )}
                    </motion.li>
                  );
                })}
              </ol>
            </div>
          </motion.section>

          {/* ── faq ────────────────────────────────────────────────── */}
          <motion.section
            id="faq"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-section lg-section--raised"
          >
            <div className="lg-inner">
              <motion.p variants={fadeUp} className="lg-label lg-eyebrow">
                faq
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display lg-h2">
                Questions people ask first.
              </motion.h2>
              <motion.div variants={fadeUp} className="lg-faq__list">
                {FAQ.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </motion.div>
            </div>
          </motion.section>

          {/* ── final CTA — the gold inversion band ─────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="lg-final"
          >
            <motion.p variants={fadeUp} className="lg-label lg-final__eyebrow">
              final call
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="rly-display lg-final__title"
            >
              Every career has a first season.
            </motion.h2>
            <motion.p variants={fadeUp} className="lg-final__sub">
              {league.totalRoster} players will make up the inaugural PTO
              League roster. Seven weeks later, only 16 will move on to the PTO
              Tournament. Your first match is {shortDate(league.startDate)}.
            </motion.p>
            <motion.div variants={fadeUp}>
              <a
                className="rly-pill lg-cta"
                href={ctaHref}
                target={ctaTarget}
                rel="noopener noreferrer"
              >
                {CTA_LABEL_FOUNDING}
              </a>
            </motion.div>
            <motion.p variants={fadeUp} className="lg-label lg-final__fact">
              ${league.depositPrice} deposit · ${league.fullPrice} total ·
              Registration closes{" "}
              {shortDate(league.registrationCloseAt.slice(0, 10))}
            </motion.p>
            <motion.p variants={fadeUp} className="lg-final__close">
              See you on game day.
            </motion.p>
          </motion.section>

          {/* ── sticky bar ─────────────────────────────────────────── */}
          <AnimatePresence>
            {heroGone && !dismissed && (
              <StickyBar onDismiss={() => setDismissed(true)} />
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </PageWrapper>
  );
};

/** One FAQ row — hairline rules, disclosure semantics, visible focus. */
const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg-faq__item">
      <button
        type="button"
        className="lg-faq__q"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {q}
        <span className="lg-faq__mark" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <p className="lg-faq__a">{a}</p>}
    </div>
  );
};

export default League;
