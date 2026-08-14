import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { socialLinks, weeklyMeets } from "@/lib/constants";

const NextUp = () => {
  return (
    <section className="rly-nextup rly-nextup--chalk">
      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className="rly-nextup__head"
      >
        <p className="rly-kicker">
          <span className="rly-dot" /> The calendar
        </p>
        <h2 className="rly-display rly-nextup__title">
          Next up<i>.</i>
        </h2>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-80px" }}
        className="rly-nextup__grid"
      >
        {/* Weekly sessions: the main event now */}
        <motion.article variants={fadeUp} className="rly-card rly-card--volt">
          <span className="rly-stamp rly-card__stamp">This week</span>
          <p className="rly-card__kicker">Every week</p>
          <h3 className="rly-display rly-card__title">Weekly sessions</h3>
          {/* Both nights, same weight, same treatment. */}
          <div className="rly-card__rows">
            {weeklyMeets.nights.map((night) => (
              <span key={night.day}>
                <strong>{night.day}</strong> · {night.venue}, {night.area}
              </span>
            ))}
            <span>{weeklyMeets.price} · no membership</span>
          </div>
          <div className="rly-card__cta-row">
            <a
              className="rly-pill"
              href={weeklyMeets.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a session ↗
            </a>
          </div>
        </motion.article>

        {/* Summer Series: wrapped */}
        <motion.article variants={fadeUp} className="rly-card rly-card--blue">
          <p className="rly-card__kicker">Courtside · Summer Series</p>
          <h3 className="rly-display rly-card__title">That's a wrap</h3>
          <div className="rly-card__rows">
            <span>
              <strong>Series I · sold out in advance</strong>
            </span>
            <span>Series II · the Day Party at The Pad</span>
            <span>Next series · announced on @club_pto first</span>
          </div>
          <div className="rly-card__cta-row">
            <a
              className="rly-pill rly-pill--ghost"
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              See the recaps ↗
            </a>
          </div>
        </motion.article>
      </motion.div>
    </section>
  );
};

export default NextUp;
