// SKILL LAB — one public page, deliberately simple.
//
// WHAT IS DELIBERATELY ABSENT. Venue, session day, session time, cohort start
// date and payment mechanism are all unconfirmed, so none of them appears —
// not as a fact, and not as "coming soon" either. A placeholder is a promise
// the page cannot keep, and it dates the page the moment it ships. Any
// sentence that needed one of those facts was cut rather than hedged.
//
// The source document is a long sales page. Most of it did not survive: the
// rule-of-three headers, the three-audience block (one promise stated three
// times), the upbeat closers, and the FAQ whose two most important answers —
// the missed-session policy and the equipment requirement — the document
// itself defers. An FAQ that defers its own questions is worse than none.

import { useEffect } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { skillLab } from "@/lib/constants";

// The four weeks, one line each. Wording is the source's, compressed.
const WEEKS = [
  "Racket control, the basic shots, serving, and where to stand.",
  "Movement, the walls, and playing with a partner.",
  "Attacking, defending, volleys, lobs, and building a point.",
  "Coached match play.",
];

// Only the $199 tier has a stated inclusions list in the source. The other two
// stay bare rather than inheriting one — whether snacks and the complimentary
// Meet apply to them is unconfirmed, and guessing would put a false promise
// next to a price.
const TIERS = [
  {
    name: "SKILL LAB Cohort",
    price: "$199",
    lead: "Four weeks, four sessions, six players maximum.",
    includes:
      "A coach, technical and tactical work, match play, snacks, and a complimentary Club PTO Meet when you finish.",
    cta: "Join the next cohort",
  },
  {
    name: "Two sessions",
    price: "$99",
    lead: "That's $49.50 each.",
    includes: "For when you already play and want a top-up.",
    cta: "Take two sessions",
  },
  {
    name: "One session",
    price: "$60",
    lead: "A single session.",
    includes: "If you'd rather try it before committing to four weeks.",
    cta: "Book one session",
  },
];

const Cta = ({ label }: { label: string }) => (
  <a
    className="rly-pill"
    href={skillLab.bookingUrl}
    target="_blank"
    rel="noopener noreferrer"
  >
    {label}
  </a>
);

const SkillLab = () => {
  // The site is a single-page app with one static <title> in index.html, so a
  // per-page title has to be set here. No helmet library for one page.
  useEffect(() => {
    const previous = document.title;
    document.title = "SKILL LAB · Club PTO";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <PageWrapper>
      <div className="rly-page">
        {/* ── 1. Hero ─────────────────────────────────────────────── */}
        <motion.section
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="rly-page__hero"
        >
          <motion.p variants={fadeUp} className="rly-kicker">
            <span className="rly-dot" /> Club PTO
          </motion.p>
          {/* No rly-script second line here, unlike About and Partners. Those
              titles are prose ("A room of / regulars."), where the cursive
              closes a sentence. This is a product name that has to read
              exactly as the poster sets it, and "SKILL Lab." is not that
              name. The line break is for the 375px column, not for effect. */}
          <motion.h1 variants={fadeUp} className="rly-display rly-page__title">
            SKILL
            <br />
            LAB
          </motion.h1>
          <motion.p variants={fadeUp} className="rly-prose" style={{ marginTop: "1.5rem" }}>
            Six players, four weeks, one coach.
          </motion.p>

          <motion.div variants={fadeUp} className="rly-cta-row" style={{ marginTop: "2rem" }}>
            <Cta label="Join the next cohort" />
          </motion.div>
          <motion.p variants={fadeUp} className="rly-mono" style={{ marginTop: "0.75rem" }}>
            Six players per cohort.
          </motion.p>
        </motion.section>

        {/* ── 2. The problem, in the reader's words ────────────────── */}
        <section className="rly-page__body">
          <div className="rly-prose">
            <p>
              Maybe you've been meaning to try padel and haven't booked. Maybe
              you've played a few times but still feel like you don't really
              know what you're doing. Or you play most weeks now and you've
              stopped getting better.
            </p>
            <p>We'll place you in the appropriate cohort.</p>
          </div>
        </section>

        {/* ── 3. What it is ───────────────────────────────────────── */}
        <section className="rly-steps">
          <div className="rly-steps__head">
            <h2 className="rly-steps__heading">What it is</h2>
          </div>
          <div className="rly-prose">
            <p>Six players, four weeks, one session a week.</p>
            <p>
              You're not signing up for a class with 20 people waiting around
              for their turn. You get more reps, and a coach who can actually
              see you.
            </p>
          </div>
          <ol className="rly-steps__grid">
            {WEEKS.map((line, i) => (
              <li key={line} className="rly-steps__item">
                <span className="rly-steps__num">{`Week ${i + 1}`}</span>
                <p className="rly-steps__text">{line}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 4. Pricing ──────────────────────────────────────────── */}
        <section className="rly-page__body">
          <h2 className="rly-steps__heading">Pricing</h2>
          <div className="rly-partner-grid" style={{ marginTop: "1.5rem" }}>
            {TIERS.map((tier) => (
              <div key={tier.name} className="rly-card">
                <p className="rly-card__kicker">{tier.name}</p>
                <p className="rly-card__title">{tier.price}</p>
                <div className="rly-card__rows">
                  <p>{tier.lead}</p>
                  <p>{tier.includes}</p>
                </div>
                <div className="rly-card__cta-row">
                  <Cta label={tier.cta} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. After the four weeks, then the footer CTA ─────────── */}
        <section className="rly-final">
          <h2 className="rly-final__title">After the four weeks</h2>
          <div className="rly-prose">
            <p>
              You finish with one complimentary Club PTO Wednesday or Sunday
              Meet.
            </p>
            <p>
              That's the part that matters. Four weeks of coaching is only
              useful if you then go and play, against people you don't know,
              who do things you don't expect.
            </p>
          </div>
          <div className="rly-cta-row" style={{ marginTop: "2rem" }}>
            <Cta label="Join the next cohort" />
          </div>
          <p className="rly-mono" style={{ marginTop: "0.75rem" }}>
            Six players per cohort.
          </p>
        </section>
      </div>
    </PageWrapper>
  );
};

export default SkillLab;
