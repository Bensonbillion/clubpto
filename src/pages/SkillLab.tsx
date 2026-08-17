// SKILL LAB — one screen that says what it is, and one link to Acuity.
//
// WHAT IS DELIBERATELY ABSENT. Venue, session day, session time, cohort start
// date and payment mechanism are all unconfirmed, so none of them appears —
// not as a fact, and not as "coming soon" either. A placeholder is a promise
// the page cannot keep, and it dates the page the moment it ships. Any
// sentence that needed one of those facts was cut rather than hedged.
//
// Pricing is not here on purpose. It is the least resolved part of the offer,
// and a page that quotes three tiers is making three promises.

import { useEffect } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import Picture from "@/components/ui/Picture";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { skillLab } from "@/lib/constants";
import poster from "@/assets/skill-lab-poster.jpg?picture";
import "./skillLab.css";

const WEEKS = [
  "Racket control, the basic shots, serving, and where to stand.",
  "Movement, the walls, and playing with a partner.",
  "Attacking, defending, volleys, lobs, and building a point.",
  "Coached match play.",
];

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

  return (
    <PageWrapper>
      <div className="sl-page">
        {/* ── 1. Hero. The poster IS the hero, not an image under a headline. */}
        <motion.section
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="sl-hero"
        >
          <motion.figure variants={fadeUp} className="sl-hero__poster">
            <Picture
              img={poster}
              alt="SKILL LAB — Club PTO"
              priority
              sizes="(max-width: 900px) 100vw, 640px"
            />
          </motion.figure>

          <div>
            <motion.p variants={fadeUp} className="rly-kicker">
              <span className="rly-dot" /> Club PTO
            </motion.p>
            {/* No rly-script second line, unlike About and Partners. Those
                titles are prose ("A room of / regulars."), where the cursive
                closes a sentence. This is a product name that has to read
                exactly as the poster sets it, and "SKILL Lab." is not it. */}
            <motion.h1 variants={fadeUp} className="rly-display sl-hero__title">
              SKILL LAB
            </motion.h1>
            <motion.p variants={fadeUp} className="sl-hero__lead">
              Small-group padel coaching. Six players, four weeks, one coach.
            </motion.p>
          </div>
        </motion.section>

        {/* ── 2. What it is ─────────────────────────────────────────── */}
        <motion.section
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-80px" }}
          className="sl-what"
        >
          <motion.h2 variants={fadeUp} className="rly-display sl-what__heading">
            What it is
          </motion.h2>
          <motion.div variants={fadeUp} className="sl-what__body">
            <div className="sl-what__col">
              <p>
                Maybe you've been meaning to try padel and haven't booked.
                Maybe you've played a few times but still feel like you don't
                really know what you're doing. Or you play most weeks now and
                you've stopped getting better.
              </p>
              <p>We'll place you in the appropriate cohort.</p>
            </div>
            <div className="sl-what__col">
              <p>Six players, four weeks, one session a week.</p>
              <p>
                You're not signing up for a class with 20 people waiting
                around for their turn. You get more reps, and a coach who can
                actually see you.
              </p>
            </div>
          </motion.div>
        </motion.section>

        {/* ── 3. The four weeks, the Meet, one CTA ──────────────────── */}
        <motion.section
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-80px" }}
          className="sl-weeks"
        >
          <div className="sl-weeks__inner">
            <motion.h2 variants={fadeUp} className="rly-display sl-weeks__heading">
              Four weeks
            </motion.h2>
            <ol className="sl-weeks__grid">
              {WEEKS.map((line, i) => (
                <motion.li variants={fadeUp} key={line} className="sl-week">
                  <span className="sl-week__num">{`Week ${i + 1}`}</span>
                  <p className="sl-week__text">{line}</p>
                </motion.li>
              ))}
            </ol>

            <motion.div variants={fadeUp} className="sl-close">
              <p className="sl-close__text">
                You finish with one complimentary Club PTO Wednesday or Sunday
                Meet. That's the part that matters. Four weeks of coaching is
                only useful if you then go and play, against people you don't
                know, who do things you don't expect.
              </p>
              <div className="sl-close__action">
                <a
                  className="rly-pill"
                  href={skillLab.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join the next cohort ↗
                </a>
                <p className="sl-close__note">Six players per cohort.</p>
              </div>
            </motion.div>
          </div>
        </motion.section>
      </div>
    </PageWrapper>
  );
};

export default SkillLab;
