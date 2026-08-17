// SKILL LAB — six sections per the final build spec, one lime CTA repeated.
//
// WHAT IS DELIBERATELY ABSENT. Venue, session day, session time, cohort start
// date, payment mechanism, pricing, the coach's name — all unconfirmed, so
// none of them appears, and nothing stands in for them. Every string on this
// page is either pre-approved copy or spec-provided structure.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import Picture from "@/components/ui/Picture";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { skillLab } from "@/lib/constants";
import poster from "@/assets/skill-lab-poster.jpg?picture";
import rallyPhoto from "@/assets/featured/grid_rally.jpg?picture";
import groupPhoto from "@/assets/featured/group-photo.jpg?picture";
import "./skillLab.css";

const WEEKS = [
  "Racket control, the basic shots, serving, and where to stand.",
  "Movement, the walls, and playing with a partner.",
  "Attacking, defending, volleys, lobs, and building a point.",
  "Coached match play.",
];

// Card fills: 01 and 03 on ink, 02 raised, 04 on lime — the payoff week
// reads as the destination.
const WEEK_FILL = ["", "sl-week--raised", "", "sl-week--lime"];

const CTA_LABEL = "Join the next cohort ↗";

const SkillLab = () => {
  // One static <title> lives in index.html for the whole SPA, so a per-page
  // title has to be set here. Not worth a helmet library for one page.
  useEffect(() => {
    const previous = document.title;
    document.title = "SKILL LAB · Club PTO";
    return () => {
      document.title = previous;
    };
  }, []);

  // The sticky bar appears only once the hero — and its CTA — has scrolled
  // away, so the page never shows two buttons at once.
  const heroRef = useRef<HTMLElement | null>(null);
  const [heroGone, setHeroGone] = useState(false);
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
      {/* reducedMotion="user": every variant renders its final state for
          people who asked the OS for less motion. */}
      <MotionConfig reducedMotion="user">
        <div className="sl-page">
          {/* ── 1. Hero — split composition ─────────────────────────── */}
          <section ref={heroRef} className="sl-hero">
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="sl-hero__left"
            >
              <motion.p variants={fadeUp} className="sl-label sl-hero__kicker">
                Club PTO
              </motion.p>
              {/* Two lines, forced: it stacks like a poster lockup. */}
              <motion.h1 variants={fadeUp} className="rly-display sl-hero__title">
                SKILL
                <br />
                LAB
              </motion.h1>
              <motion.p variants={fadeUp} className="sl-hero__lead">
                Small-group padel coaching. Six players, four weeks, one coach.
              </motion.p>
              <motion.div variants={fadeUp} className="sl-stats">
                <div className="sl-stat">
                  <span className="sl-stat__num">{skillLab.players}</span>
                  <span className="sl-label sl-stat__label">Players</span>
                </div>
                <div className="sl-stat">
                  <span className="sl-stat__num">{skillLab.weeks}</span>
                  <span className="sl-label sl-stat__label">Weeks</span>
                </div>
                <div className="sl-stat">
                  <span className="sl-stat__num">4</span>
                  <span className="sl-label sl-stat__label">Sessions</span>
                </div>
              </motion.div>
              <motion.div variants={fadeUp} className="sl-hero__action">
                <a
                  className="rly-pill sl-cta"
                  href={skillLab.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CTA_LABEL}
                </a>
                <p className="sl-label sl-hero__fact">Six players per cohort.</p>
              </motion.div>
            </motion.div>

            {/* The poster is the LCP — it never animates. The lime panel on
                top of it does. */}
            <div className="sl-hero__art">
              <Picture
                img={poster}
                alt="SKILL LAB — Club PTO"
                priority
                sizes="(max-width: 1023px) 100vw, 42vw"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="sl-hero__panel"
              >
                <span className="sl-hero__panel-num">{skillLab.players}</span>
                <span className="sl-label sl-hero__panel-label">
                  Players per cohort
                </span>
              </motion.div>
            </div>
          </section>

          {/* ── 2. What it is — first band change ───────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="sl-what"
          >
            <div className="sl-inner">
              <motion.h2 variants={fadeUp} className="rly-display sl-what__heading">
                What it is
              </motion.h2>
              <motion.div variants={fadeUp} className="sl-what__body">
                <p>
                  Maybe you've been meaning to try padel and haven't booked.
                  Maybe you've played a few times but still feel like you don't
                  really know what you're doing. Or you play most weeks now and
                  you've stopped getting better.
                </p>
                <p className="sl-what__answer">
                  We'll place you in the appropriate cohort.
                </p>
                <hr className="sl-what__rule" />
                <p>
                  You're not signing up for a class with 20 people waiting
                  around for their turn. You get more reps, and a coach who can
                  actually see you.
                </p>
              </motion.div>
            </div>
          </motion.section>

          {/* ── 3. The four weeks ───────────────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="sl-weeks"
          >
            <div className="sl-inner">
              <div className="sl-weeks__head">
                <motion.p variants={fadeUp} className="sl-label sl-weeks__label">
                  The program
                </motion.p>
                <motion.h2 variants={fadeUp} className="rly-display sl-weeks__heading">
                  Four weeks
                </motion.h2>
              </div>
              <ol className="sl-weeks__grid">
                {WEEKS.map((line, i) => (
                  <motion.li
                    variants={fadeUp}
                    key={line}
                    className={`sl-week ${WEEK_FILL[i]}`}
                  >
                    <span className="sl-week__num">{`0${i + 1}`}</span>
                    <h3 className="sl-week__title">{`Week ${i + 1}`}</h3>
                    <p className="sl-week__text">{line}</p>
                  </motion.li>
                ))}
              </ol>
            </div>
          </motion.section>

          {/* ── 4. Photo band — the breather ────────────────────────── */}
          <div className="sl-band">
            <Picture
              img={rallyPhoto}
              alt="A padel rally at golden hour on an outdoor Club PTO court"
              sizes="100vw"
            />
          </div>

          {/* ── 5. The Meet — the lime band ─────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="sl-meet"
          >
            <div className="sl-inner">
              <div>
                <motion.h2 variants={fadeUp} className="rly-display sl-meet__heading">
                  After the four weeks
                </motion.h2>
                <motion.div variants={fadeUp} className="sl-meet__copy">
                  {/* One source line: the nights-are-equal guard checks line
                      by line, and a wrap between the two names reads as
                      naming one night without the other. */}
                  <p>You finish with one complimentary Club PTO Wednesday or Sunday Meet.</p>
                  <p>
                    That's the part that matters. Four weeks of coaching is
                    only useful if you then go and play, against people you
                    don't know, who do things you don't expect.
                  </p>
                </motion.div>
              </div>
              <motion.figure variants={fadeUp} className="sl-meet__photo">
                <Picture
                  img={groupPhoto}
                  alt="Four Club PTO members at the net after a session"
                  sizes="(max-width: 1023px) 90vw, 40vw"
                />
              </motion.figure>
            </div>
          </motion.section>

          {/* ── 6. Closing CTA — the exhale ─────────────────────────── */}
          <motion.section
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            className="sl-close"
          >
            <div className="sl-inner">
              <motion.h2 variants={fadeUp} className="rly-display sl-close__title">
                SKILL LAB
              </motion.h2>
              <motion.div variants={fadeUp}>
                <a
                  className="rly-pill sl-cta"
                  href={skillLab.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CTA_LABEL}
                </a>
              </motion.div>
              <motion.p variants={fadeUp} className="sl-label sl-close__fact">
                Six players per cohort.
              </motion.p>
            </div>
          </motion.section>

          {/* ── sticky mobile CTA bar ───────────────────────────────── */}
          <AnimatePresence>
            {heroGone && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="sl-sticky"
              >
                <p className="sl-label sl-sticky__fact">Six per cohort</p>
                <a
                  className="rly-pill sl-cta"
                  href={skillLab.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CTA_LABEL}
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </PageWrapper>
  );
};

export default SkillLab;
