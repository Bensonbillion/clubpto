import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import PageWrapper from "@/components/layout/PageWrapper";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { weeklyMeets } from "@/lib/constants";
import photoGolden from "@/assets/wall/hero_goldenhour.jpg";
import photoCourt from "@/assets/wall/gn_strip_court.jpg";
import photoLounge from "@/assets/wall/s2_lounge.jpg";

const About = () => (
  <PageWrapper>
    <div className="rly-page">
      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="rly-page__hero"
      >
        <motion.p variants={fadeUp} className="rly-kicker">
          <span className="rly-dot" /> The club
        </motion.p>
        <motion.h1 variants={fadeUp} className="rly-display rly-page__title">
          A room of
          <br />
          <span className="rly-script">regulars.</span>
        </motion.h1>
        <motion.div variants={fadeUp} className="rly-prose" style={{ marginTop: "2rem" }}>
          <p>
            A padel social club in Toronto. We meet twice a week, every week:
            compete Wednesday, unwind Sunday.
          </p>
          <p>
            Courtside is the flagship. Tournament padel, DJ sets, and a room
            that shows up. Set 01 sold out in advance.
          </p>
          <p>Once you're in, you're in.</p>
        </motion.div>
        <motion.div variants={fadeUp} className="rly-facts-row">
          <span>{weeklyMeets.days} · every week</span>
          <span>Courtside · the flagship</span>
          <span>{weeklyMeets.city}</span>
        </motion.div>
        <motion.div variants={fadeUp} className="rly-cta-row">
          <a
            className="rly-pill"
            href={weeklyMeets.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Book a session ↗
          </a>
          <Link className="rly-pill rly-pill--ghost" to="/community">
            See the wall
          </Link>
        </motion.div>
      </motion.section>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-80px" }}
        className="rly-photo-strip"
      >
        {[photoGolden, photoCourt, photoLounge].map((src) => (
          <motion.figure key={src} variants={fadeUp}>
            <img src={src} alt="" loading="lazy" />
          </motion.figure>
        ))}
      </motion.div>
    </div>
  </PageWrapper>
);

export default About;
