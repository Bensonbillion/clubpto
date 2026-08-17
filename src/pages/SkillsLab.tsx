// Skills Lab — the front door of the club for people who haven't started
// yet. Twelve sections, one narrative arc: you're welcome here before
// you're good.
//
// Operational facts live in src/content/skillsLab.ts. Anything Benson
// hasn't confirmed is a TODO_BENSON sentinel there, and every element that
// depends on one hides itself — the integrity test fails the build if a
// sentinel ever reaches rendered HTML. The program has never run, so there
// are no testimonials anywhere on this page by design; the founding-cohort
// section is the social-proof slot instead.

import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { ctaHref, isSet, skillsLab } from "@/content/skillsLab";
import "./skillsLab.css";

const CTA_LABEL = "Join the next cohort ↗";

const WEEKS = [
  {
    title: "Build Your Foundation",
    text: "Fundamentals: racket control, the basic shots, serving, and where to stand.",
  },
  {
    title: "Own The Court",
    text: "Movement, positioning, the walls, and playing with a partner.",
  },
  {
    title: "Build Your Game",
    text: "Attacking, defending, volleys, lobs, and building a point.",
  },
  {
    title: "Put It Into Play",
    text: "Coached match play.",
  },
];

const WHO = [
  { label: "never played", text: "You'll start from zero, next to five people doing the same." },
  { label: "know the basics", text: "You'll turn scattered games into actual technique." },
  { label: "play regularly", text: "You'll break the plateau with a coach's eyes on your game." },
];

const INCLUDED = [
  "Four weekly coached sessions",
  "A group of six, never more",
  "A dedicated padel coach",
  "Technical and tactical development",
  "Match-play training",
  "Rackets and balls provided",
  "Snacks and refreshments",
  "One complimentary Wednesday or Sunday Meet",
];

const FAQ = [
  {
    q: "Do I need experience?",
    a: "No. You're placed in a cohort at your level, so nobody's out of their depth.",
  },
  { q: "How big is the group?", a: "Six players. Never more." },
  { q: "How often are the sessions?", a: "Once a week, for four weeks." },
  {
    q: "What if I miss a session?",
    a: "One make-up session in the following cohort, arranged with us directly.",
  },
  {
    q: "Do I need a racket?",
    a: "No — rackets and balls are provided. Just bring court shoes and water.",
  },
  {
    q: "What happens after the four weeks?",
    a: "Your first Wednesday or Sunday Meet is on us. After that, the room is yours.",
  },
];

/**
 * A photo slot. Benson drops real session photos into
 * public/images/skills-lab/ and they appear here without a code change;
 * until then the slot renders the branded placeholder — forest block, cream
 * frame inset 12px, a lowercase VT323 caption of the intended shot. Never a
 * broken image either way.
 */
const PhotoSlot = ({
  name,
  caption,
  className,
  width,
  height,
  eager = false,
}: {
  name: string;
  caption: string;
  className: string;
  width: number;
  height: number;
  eager?: boolean;
}) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <figure className={`skl-photo ${className}`}>
      <img
        src={`/images/skills-lab/${name}.jpg`}
        alt={loaded ? caption : ""}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        style={loaded ? undefined : { visibility: "hidden" }}
      />
      {!loaded && (
        <span className="skl-photo__placeholder" aria-hidden="true">
          <span className="skl-label skl-photo__caption">[ photo — {caption} ]</span>
        </span>
      )}
    </figure>
  );
};

/**
 * The sticky bar is memoized and receives only stable props, so it renders
 * once when it mounts and never again while the page scrolls — scrolling
 * flips no state here (the mount itself is IntersectionObserver-driven from
 * the parent, which also renders only on that one flip).
 */
const StickyBar = memo(({ onDismiss }: { onDismiss: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 16 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="skl-sticky"
  >
    <p className="skl-label skl-sticky__fact">
      skills lab — 6 per cohort
      {isSet(skillsLab.cohortStartDate) && `, next cohort ${skillsLab.cohortStartDate}`}
    </p>
    <a className="rly-pill skl-cta" href={ctaHref()}>
      Join ↗
    </a>
    <button
      type="button"
      className="skl-sticky__dismiss"
      aria-label="Dismiss"
      onClick={onDismiss}
    >
      ✕
    </button>
  </motion.div>
));
StickyBar.displayName = "StickyBar";

const SkillsLab = () => {
  useEffect(() => {
    const previous = document.title;
    document.title = "Skills Lab · Club PTO";
    return () => {
      document.title = previous;
    };
  }, []);

  // Sticky bar: appears after the hero scrolls out, dismissible on mobile.
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

  return (
    <PageWrapper>
      {/* reducedMotion="user": every animation renders its final state for
          people who asked the OS for less motion. */}
      <MotionConfig reducedMotion="user">
        <div className="skl-page">
          {/* ── 1. Hero — split ─────────────────────────────────────── */}
          <section ref={heroRef} className="skl-hero">
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="skl-hero__text"
            >
              <motion.p variants={fadeUp} className="skl-label skl-hero__eyebrow">
                club pto skills lab
              </motion.p>
              <motion.h1 variants={fadeUp} className="rly-display skl-hero__title">
                You don't need to be good to start.
              </motion.h1>
              <motion.p variants={fadeUp} className="skl-hero__sub">
                Small-group padel coaching. Six players, four weeks, one coach.
              </motion.p>
              <motion.div variants={fadeUp}>
                <a className="rly-pill skl-cta" href={ctaHref()}>
                  {CTA_LABEL}
                </a>
              </motion.div>
              <motion.p variants={fadeUp} className="skl-label skl-hero__specs">
                6 players · 4 weeks · 4 sessions
              </motion.p>
              {isSet(skillsLab.cohortStartDate) && (
                <motion.p variants={fadeUp} className="skl-label skl-hero__next">
                  next cohort — {skillsLab.cohortStartDate}
                </motion.p>
              )}
            </motion.div>
            <PhotoSlot
              name="hero"
              caption="coach + 6 players, courtside"
              className="skl-hero__photo"
              width={1000}
              height={1250}
              eager
            />
          </section>

          {/* ── 2. The empathy beat ─────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-empathy"
          >
            <div className="skl-inner">
              <motion.div variants={fadeUp} className="skl-empathy__lines">
                <p>Maybe you've been meaning to try padel and haven't booked.</p>
                <p>
                  Maybe you've played a few times but still feel like you don't
                  really know what you're doing.
                </p>
                <p>Or you play most weeks now and you've stopped getting better.</p>
              </motion.div>
              <motion.p variants={fadeUp} className="skl-script">
                that's exactly why we built this.
              </motion.p>
            </div>
          </motion.section>

          {/* ── 3. The four weeks ───────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-weeks"
          >
            <div className="skl-inner">
              <div>
                <div className="skl-weeks__head">
                  <motion.p variants={fadeUp} className="skl-label skl-hero__eyebrow">
                    the program
                  </motion.p>
                  <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                    Four weeks, in order.
                  </motion.h2>
                </div>
                <ol className="skl-weeks__rail">
                  {WEEKS.map((week, i) => (
                    <motion.li variants={fadeUp} key={week.title} className="skl-week">
                      <span className="skl-label skl-week__num">{`0${i + 1}`}</span>
                      <h3 className="skl-week__title">{week.title}</h3>
                      <p className="skl-week__text">{week.text}</p>
                    </motion.li>
                  ))}
                </ol>
              </div>
              <motion.div variants={fadeUp}>
                <PhotoSlot
                  name="coaching-1"
                  caption="coach mid-drill with the group"
                  className="skl-weeks__photo"
                  width={1200}
                  height={800}
                />
              </motion.div>
            </div>
          </motion.section>

          {/* ── 4. Why six ──────────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-six"
          >
            <div className="skl-inner">
              <motion.div variants={fadeUp}>
                <h2 className="rly-display skl-h2">
                  Six players. One coach. No waiting around.
                </h2>
                <p className="skl-body" style={{ marginTop: 20, opacity: 0.85 }}>
                  A twenty-person clinic gives you a queue and a handful of
                  touches an hour. Six means the coach sees every rep you take —
                  and you take a lot of them.
                </p>
              </motion.div>
              <motion.div variants={fadeUp}>
                <PhotoSlot
                  name="coaching-2"
                  caption="small group at the net, mid-session"
                  className="skl-six__photo"
                  width={1200}
                  height={800}
                />
              </motion.div>
            </div>
          </motion.section>

          {/* ── 5. Who it's for ─────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-who"
          >
            <div className="skl-inner">
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                Who it's for
              </motion.h2>
              <ul className="skl-who__row" style={{ marginTop: 32 }}>
                {WHO.map((who) => (
                  <motion.li variants={fadeUp} key={who.label} className="skl-who__cell">
                    <span className="skl-label skl-who__label">{who.label}</span>
                    <p>{who.text}</p>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.section>

          {/* ── 6. The bridge — graduation into the club ────────────── */}
          <section className="skl-bridge">
            <PhotoSlot
              name="community"
              caption="the room on a meet night"
              className="skl-bridge__photo"
              width={2100}
              height={900}
            />
            <div className="skl-bridge__scrim" />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-80px" }}
              className="skl-bridge__content"
            >
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                Then the room is yours.
              </motion.h2>
              {/* One source line for the two nights — the night-parity guard
                  checks line by line. */}
              <motion.p variants={fadeUp} className="skl-bridge__copy">
                Finish the four weeks and your first Club PTO Wednesday or Sunday Meet is on us.
                You won't walk in as a graduate. You'll walk in as a member of
                the room.
              </motion.p>
              <motion.p variants={fadeUp} className="skl-label skl-bridge__proof">
                600+ players have come through this room
              </motion.p>
              <motion.p variants={fadeUp} className="skl-script">
                see you out there.
              </motion.p>
            </motion.div>
          </section>

          {/* ── 7. What's included ──────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-included"
          >
            <div className="skl-inner">
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                What's included
              </motion.h2>
              <ul className="skl-included__list">
                {INCLUDED.map((item) => (
                  <motion.li variants={fadeUp} key={item} className="skl-included__item">
                    <span className="skl-included__check" aria-hidden="true">
                      ✓
                    </span>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.section>

          {/* ── 8. Pricing ──────────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            id="pricing"
            className="skl-section skl-pricing"
          >
            <div className="skl-inner">
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                Choose how you train.
              </motion.h2>
              <div className="skl-pricing__cards">
                <motion.div variants={fadeUp} className="skl-price skl-price--primary">
                  <span className="skl-label skl-price__label">skills lab cohort</span>
                  <span className="skl-price__amount">
                    ${skillsLab.cohortPrice}
                    <small>cad</small>
                  </span>
                  <p className="skl-price__desc">
                    Four weeks, four coached sessions, six players. Your first
                    Wednesday or Sunday Meet is included.
                  </p>
                  {isSet(skillsLab.sessionDay) && isSet(skillsLab.venueName) && (
                    <p className="skl-label skl-price__meta">
                      {skillsLab.sessionDay}s · {skillsLab.venueName}
                    </p>
                  )}
                  <a className="rly-pill skl-cta" href={ctaHref()}>
                    {CTA_LABEL}
                  </a>
                </motion.div>
                <motion.div variants={fadeUp} className="skl-price">
                  <span className="skl-label skl-price__label">single session</span>
                  <span className="skl-price__amount">
                    ${skillsLab.singleSessionPrice}
                    <small>cad</small>
                  </span>
                  <p className="skl-price__desc">Try one session first.</p>
                  <a className="rly-pill rly-pill--ghost skl-cta" href={ctaHref()}>
                    Try a session ↗
                  </a>
                </motion.div>
                {skillsLab.showTwoSessionPack && (
                  <motion.div variants={fadeUp} className="skl-price">
                    <span className="skl-label skl-price__label">two sessions</span>
                    <span className="skl-price__amount">
                      ${skillsLab.twoSessionPackPrice}
                      <small>cad</small>
                    </span>
                    <p className="skl-price__desc">Two sessions, back to back weeks.</p>
                    <a className="rly-pill rly-pill--ghost skl-cta" href={ctaHref()}>
                      Book two ↗
                    </a>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.section>

          {/* ── 9. Founding cohort — the social-proof slot for a program
                 that has never run. Honest, specific, no manufactured
                 hype. ──────────────────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-founding"
          >
            <div className="skl-inner">
              <motion.p variants={fadeUp} className="skl-label skl-founding__motif">
                cohort 001
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                Be one of the first six.
              </motion.h2>
              <motion.p variants={fadeUp} className="skl-body">
                Nobody has done this program before you — that's the offer, not
                the catch. The first six put their names on it: founding
                members get named in the room's history, and first access to
                every cohort after.
              </motion.p>
            </div>
          </motion.section>

          {/* ── 10. FAQ ─────────────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-faq"
          >
            <div className="skl-inner">
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                Questions, answered.
              </motion.h2>
              <motion.div variants={fadeUp} className="skl-faq__list">
                {FAQ.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </motion.div>
            </div>
          </motion.section>

          {/* ── 11. Final CTA ───────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-final"
          >
            <div className="skl-inner">
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                Stop waiting to be "good enough."
              </motion.h2>
              <motion.div variants={fadeUp}>
                <a className="rly-pill skl-cta" href={ctaHref()}>
                  {CTA_LABEL}
                </a>
              </motion.div>
              <motion.p variants={fadeUp} className="skl-label skl-final__fact">
                only 6 places per cohort
              </motion.p>
            </div>
          </motion.section>

          {/* ── 12. Sticky bar ──────────────────────────────────────── */}
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

/** One FAQ row — hairline rules, native disclosure semantics, visible focus. */
const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="skl-faq__item">
      <button
        type="button"
        className="skl-faq__q"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {q}
        <span className="skl-label skl-faq__mark" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <p className="skl-faq__a">{a}</p>}
    </div>
  );
};

export default SkillsLab;
