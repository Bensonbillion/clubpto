// Skill Lab — implemented from the approved wireframe (Claude Design
// project "Website wireframes and design notes", turn 2): the dark
// direction, poster as the only image, level-up positioning, nine numbered
// sections ending on the gold inversion band.
//
// Copy comes from the wireframe verbatim, with two standing conventions
// applied: the club's name renders "Club PTO" (the site's spelling), and
// the program name is "Skill Lab" — singular, as the poster and the
// wireframe both write it. Operational facts still live in
// src/content/skillsLab.ts; day/time/venue stay hidden until filled, and
// the build fails if a TODO sentinel ever renders.

import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { ctaHref, isSet, skillsLab } from "@/content/skillsLab";
import "./skillsLab.css";

const CTA_LABEL = "Join the next cohort";

/** "2026-08-30" → "30.08.2026", the poster's own date format. */
const posterDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

const WEEKS = [
  {
    title: "Build your foundation",
    text: "Fundamentals: racket control, basic shots, serving, positioning.",
  },
  {
    title: "Own the court",
    text: "Movement, positioning, walls, working with your partner.",
  },
  {
    title: "Build your game",
    text: "Attacking, defending, volleys, lobs, constructing points.",
  },
  {
    title: "Put it into play",
    text: "Coached match play and real game situations.",
  },
];

const LEVELS = [
  {
    chip: "Never played",
    volt: true,
    text: "Good. No experience needed. We start with fundamentals and get you comfortable on court.",
  },
  {
    chip: "Know the basics",
    volt: false,
    text: "Still inconsistent? Skill Lab gives you the reps to put it together.",
  },
  {
    chip: "Play regularly",
    volt: false,
    text: "Sharpen technique, improve decision-making, keep climbing.",
  },
];

const INCLUDED = [
  "4 weeks of structured training",
  "4 small-group coaching sessions",
  "Maximum 6 players per cohort",
  "Dedicated padel coach",
  "Technical & tactical development",
  "Match-play training",
  "Snacks & refreshments",
  "Complimentary Club PTO Meet after the program",
];

const FAQ = [
  {
    q: "Do I need experience?",
    a: "No. Players are placed by level and complete beginners are welcome. Regulars are too. The coach just works on different things with you.",
  },
  { q: "How big is the group?", a: "Six players. Never more." },
  { q: "How often do we play?", a: "Once a week, for four weeks." },
  {
    q: "What if I miss a session?",
    a: "One make-up session in the following cohort, arranged with us directly.",
  },
  {
    q: "Do I need a racket?",
    a: "No. Rackets and balls are provided. Just bring court shoes and water.",
  },
  {
    q: "What happens after the four weeks?",
    a: "Your first Wednesday or Sunday Meet is on us. After that, the room is yours.",
  },
];

/**
 * The poster slot. If the file under public/images/skills-lab/ ever goes
 * missing, the branded placeholder renders instead — never a broken image.
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
          <span className="skl-label skl-photo__caption">[ photo: {caption} ]</span>
        </span>
      )}
    </figure>
  );
};

/**
 * Memoized with stable props: renders once at mount, never on scroll. The
 * mount is IntersectionObserver-driven from the parent, which itself only
 * renders when that one boolean flips.
 */
const StickyBar = memo(({ onDismiss }: { onDismiss: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="skl-sticky"
    >
      <p className="skl-label skl-sticky__fact">Skill Lab · 6 per cohort</p>
      <a className="rly-pill skl-cta" href={ctaHref()}>
        Join
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
  );
});
StickyBar.displayName = "StickyBar";

const SkillsLab = () => {
  useEffect(() => {
    const previous = document.title;
    document.title = "Skill Lab · Club PTO";
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

  return (
    <PageWrapper>
      {/* reducedMotion="user": every animation renders its final state for
          people who asked the OS for less motion. */}
      <MotionConfig reducedMotion="user">
        <div className="skl-page">
          {/* ── ribbon — the one fact banner ────────────────────────── */}
          <div className="skl-ribbon skl-label">
            <span>Skill Lab · cohort of six</span>
            {isSet(skillsLab.cohortStartDate) && (
              <>
                <span className="skl-ribbon__sep">/</span>
                <span>live {posterDate(skillsLab.cohortStartDate)}</span>
              </>
            )}
          </div>

          {/* ── hero — pitch left, poster right. Not animated: the
                 headline and poster are the largest paints. ───────────── */}
          <section ref={heroRef} className="skl-hero">
            <div>
              <p className="skl-label skl-hero__eyebrow">
                Club PTO presents Skill Lab
              </p>
              <h1 className="rly-display skl-hero__title">
                Level up
                <br />
                your game.
              </h1>
              <p className="skl-hero__sub">
                Four weeks of small-group padel coaching in Toronto. Six
                players, one coach, and a plan that meets you where you are,
                whether you've never held a racket or you play every week and
                keep hitting the same ceiling.
              </p>
              <div className="skl-hero__action">
                <a className="rly-pill skl-cta" href={ctaHref()}>
                  {CTA_LABEL}
                </a>
                <span className="skl-label skl-hero__price">
                  ${skillsLab.cohortPrice} · four weeks
                </span>
              </div>
              <div className="skl-stats">
                <div className="skl-stat">
                  <span className="skl-stat__num">6</span>
                  <span className="skl-label skl-stat__label">Players</span>
                </div>
                <div className="skl-stat">
                  <span className="skl-stat__num">4</span>
                  <span className="skl-label skl-stat__label">Weeks</span>
                </div>
                <div className="skl-stat">
                  <span className="skl-stat__num">4</span>
                  <span className="skl-label skl-stat__label">Sessions</span>
                </div>
              </div>
            </div>
            <PhotoSlot
              name="hero"
              caption="SKILL LAB · Club PTO"
              className="skl-hero__photo"
              width={1000}
              height={1502}
              eager
            />
          </section>

          {/* ── why we built it ────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-section--raised"
          >
            <div className="skl-inner">
              <motion.p variants={fadeUp} className="skl-label skl-eyebrow">
                why we built it
              </motion.p>
              <motion.ul variants={fadeUp} className="skl-why__lines">
                <li>Maybe you've been meaning to try padel and haven't booked.</li>
                <li>
                  Maybe you've played a few times but still feel like you don't
                  really know what you're doing.
                </li>
                <li>Or you play most weeks now and you've stopped getting better.</li>
              </motion.ul>
              <motion.p variants={fadeUp} className="skl-why__close">
                That's exactly why we built this.
              </motion.p>
              <motion.p variants={fadeUp} className="skl-why__note">
                Same four weeks, same six players, same coach. Where you start
                doesn't change the program. It changes what the coach works on
                with you.
              </motion.p>
            </div>
          </motion.section>

          {/* ── the four weeks ─────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section"
          >
            <div className="skl-inner">
              <div className="skl-weeks__head">
                <div>
                  <motion.p variants={fadeUp} className="skl-label skl-eyebrow">
                    the four weeks
                  </motion.p>
                  <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                    Four weeks, four jobs.
                  </motion.h2>
                </div>
                <motion.p variants={fadeUp} className="skl-weeks__intro">
                  One session a week, four weeks running. Each one builds on
                  the last, so you finish with a game rather than a list of
                  drills.
                </motion.p>
              </div>
              <ol className="skl-weeks__grid">
                {WEEKS.map((week, i) => (
                  <motion.li
                    variants={fadeUp}
                    key={week.title}
                    className={`skl-week ${i === 0 ? "skl-week--first" : ""}`}
                  >
                    <div className="skl-week__num">{`0${i + 1}`}</div>
                    <h3 className="skl-week__title">{week.title}</h3>
                    <p className="skl-week__text">{week.text}</p>
                  </motion.li>
                ))}
              </ol>
            </div>
          </motion.section>

          {/* ── why six ────────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-section--raised"
          >
            <div className="skl-inner">
              <motion.p variants={fadeUp} className="skl-label skl-eyebrow">
                why six
              </motion.p>
              <div className="skl-six__grid">
                <motion.div variants={fadeUp} className="skl-six__numeral" aria-hidden="true">
                  6
                </motion.div>
                <motion.div variants={fadeUp}>
                  <h2 className="rly-display skl-h2">
                    Six players. One coach.
                    <br />
                    No waiting around.
                  </h2>
                  <p className="skl-six__copy">
                    A twenty-person clinic gives you a queue and a handful of
                    touches an hour. Six means the coach sees every rep you
                    take, and you take a lot of them.
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* ── levels ─────────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section"
          >
            <div className="skl-inner">
              <motion.p variants={fadeUp} className="skl-label skl-eyebrow">
                levels
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                Not a beginners class. A better-players class.
              </motion.h2>
              <motion.p variants={fadeUp} className="skl-levels__sub">
                Players are placed by level, so you train with people moving at
                your speed. Find yourself below.
              </motion.p>
              <ul className="skl-levels__row">
                {LEVELS.map((level) => (
                  <motion.li variants={fadeUp} key={level.chip} className="skl-level">
                    <span className={`skl-chip ${level.volt ? "skl-chip--volt" : ""}`}>
                      {level.chip}
                    </span>
                    <p>{level.text}</p>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.section>

          {/* ── what's included ────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-section--raised"
          >
            <div className="skl-inner">
              <div className="skl-included__grid">
                <div>
                  <motion.p variants={fadeUp} className="skl-label skl-eyebrow">
                    what's included
                  </motion.p>
                  <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                    Everything in the four weeks.
                  </motion.h2>
                  <motion.p variants={fadeUp} className="skl-included__note">
                    Rackets and balls are on us. Bring court shoes and water.
                    Nothing else to buy.
                  </motion.p>
                </div>
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
            </div>
          </motion.section>

          {/* ── after the four weeks ───────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section"
          >
            <div className="skl-inner">
              <motion.p variants={fadeUp} className="skl-label skl-eyebrow">
                after the four weeks
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display skl-after__title">
                Skill Lab doesn't end at graduation.
              </motion.h2>
              {/* One source line for the two nights — the night-parity guard
                  checks line by line. */}
              <motion.p variants={fadeUp} className="skl-after__copy">
                Finish the program and you get one complimentary Club PTO Wednesday or Sunday Meet.
                You're not a graduate, you're in the room. Come back next week
                and play.
              </motion.p>
              <motion.div variants={fadeUp} className="skl-after__chips">
                <span className="skl-chip">Meet new players</span>
                <span className="skl-chip">Play different styles</span>
                <span className="skl-chip">Keep playing</span>
              </motion.div>
            </div>
          </motion.section>

          {/* ── pricing ────────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            id="pricing"
            className="skl-section skl-section--raised skl-pricing"
          >
            <div className="skl-inner">
              <motion.p variants={fadeUp} className="skl-label skl-eyebrow">
                pricing
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                Choose how you train.
              </motion.h2>
              <div className="skl-pricing__cards">
                <motion.div variants={fadeUp} className="skl-price skl-price--primary">
                  <div className="skl-price__head">
                    <span className="skl-label skl-price__label">Skill Lab cohort</span>
                    <span className="skl-price__badge">Most players start here</span>
                  </div>
                  <div className="skl-price__amount">${skillsLab.cohortPrice}</div>
                  <div className="skl-price__per">for the full four weeks</div>
                  <div className="skl-price__rows">
                    <div className="skl-price__row">4 weeks, 4 structured sessions</div>
                    <div className="skl-price__row">6 players maximum</div>
                    <div className="skl-price__row">Complimentary Club PTO Meet</div>
                  </div>
                  <a className="rly-pill skl-cta" href={ctaHref()}>
                    {CTA_LABEL}
                  </a>
                  {isSet(skillsLab.sessionDay) &&
                    isSet(skillsLab.sessionTime) &&
                    isSet(skillsLab.venueName) && (
                      <p className="skl-label skl-price__meta">
                        {skillsLab.sessionDay} · {skillsLab.sessionTime} ·{" "}
                        {skillsLab.venueName}
                      </p>
                    )}
                </motion.div>
                {skillsLab.showTwoSessionPack && (
                  <motion.div variants={fadeUp} className="skl-price">
                    <span className="skl-label skl-price__label skl-price__label--quiet">
                      Two-session pack
                    </span>
                    <div className="skl-price__amount">${skillsLab.twoSessionPackPrice}</div>
                    <div className="skl-price__per">two sessions</div>
                    <p className="skl-price__desc">
                      Two sessions across back-to-back weeks.
                    </p>
                    <a className="rly-pill rly-pill--ghost skl-cta" href={ctaHref()}>
                      Book two
                    </a>
                  </motion.div>
                )}
                <motion.div variants={fadeUp} className="skl-price">
                  <span className="skl-label skl-price__label skl-price__label--quiet">
                    Single session
                  </span>
                  <div className="skl-price__amount">${skillsLab.singleSessionPrice}</div>
                  <div className="skl-price__per">one session</div>
                  <p className="skl-price__desc">
                    Not ready to commit to four weeks? Try one session and see
                    what Skill Lab is about.
                  </p>
                  <a className="rly-pill rly-pill--ghost skl-cta" href={ctaHref()}>
                    Book a session
                  </a>
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* ── founding cohort — the social-proof slot for a
                 program that has never run ─────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section"
          >
            <div className="skl-inner">
              <div className="skl-founding__grid">
                <div>
                  <motion.p variants={fadeUp} className="skl-label skl-eyebrow">
                    founding cohort
                  </motion.p>
                  <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                    Be one of the first six.
                  </motion.h2>
                  <motion.div variants={fadeUp} className="skl-founding__seats">
                    <span className="skl-seat skl-seat--volt">001</span>
                    <span className="skl-seat">002</span>
                    <span className="skl-seat">003</span>
                    <span className="skl-seat">004</span>
                    <span className="skl-seat">005</span>
                    <span className="skl-seat">006</span>
                  </motion.div>
                </div>
                <motion.div variants={fadeUp}>
                  <p className="skl-label skl-founding__motif">Cohort 001</p>
                  <p className="skl-founding__copy">
                    This is the first Skill Lab, so we won't pretend to have
                    testimonials yet. What we can tell you: founding members
                    are named in the room's history and get first access to
                    every cohort after this one. Six seats, and we'd like you
                    in one of them.
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* ── faq ────────────────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-section skl-section--raised"
          >
            <div className="skl-inner">
              <motion.p variants={fadeUp} className="skl-label skl-eyebrow">
                faq
              </motion.p>
              <motion.h2 variants={fadeUp} className="rly-display skl-h2">
                Questions people ask first.
              </motion.h2>
              <motion.div variants={fadeUp} className="skl-faq__list">
                {FAQ.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </motion.div>
            </div>
          </motion.section>

          {/* ── the gold inversion band ─────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="skl-final"
          >
            <motion.h2 variants={fadeUp} className="rly-display skl-final__title">
              Stop waiting to be good enough.
            </motion.h2>
            <motion.p variants={fadeUp} className="skl-final__sub">
              You get better by playing. Four weeks from now you could be a
              different player. Come find out.
            </motion.p>
            <motion.div variants={fadeUp}>
              <a className="rly-pill skl-cta" href={ctaHref()}>
                {CTA_LABEL}
              </a>
            </motion.div>
            <motion.p variants={fadeUp} className="skl-label skl-final__fact">
              Only 6 places per cohort
            </motion.p>
          </motion.section>

          {/* ── sticky bar ──────────────────────────────────────────── */}
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
    <div className="skl-faq__item">
      <button
        type="button"
        className="skl-faq__q"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {q}
        <span className="skl-faq__mark" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <p className="skl-faq__a">{a}</p>}
    </div>
  );
};

export default SkillsLab;
