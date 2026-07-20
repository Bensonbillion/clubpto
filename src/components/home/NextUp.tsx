import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { courtsideII, weeklyMeets } from "@/lib/constants";

// Real countdown only. Returns null once the event has passed.
function daysOut(dateISO: string): string | null {
  const target = new Date(`${dateISO}T00:00:00-04:00`).getTime();
  const days = Math.ceil((target - Date.now()) / 86_400_000);
  if (days > 1) return `In ${days} days`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today";
  return null;
}

const NextUp = () => {
  const countdown = daysOut(courtsideII.date);

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
        {/* Courtside II */}
        <motion.article variants={fadeUp} className="rly-card rly-card--blue">
          <span className="rly-stamp rly-card__stamp">
            Set 01 sold out
            <br />
            in advance
          </span>
          <p className="rly-card__kicker">Courtside · Set 02</p>
          <h3 className="rly-display rly-card__title">{courtsideII.name}</h3>
          <div className="rly-card__rows">
            <span>
              <strong>{courtsideII.dateLabel}</strong>
            </span>
            <span>{courtsideII.venue}</span>
            <span>{courtsideII.subtitle}</span>
          </div>
          <div className="rly-card__cta-row">
            {countdown ? (
              <>
                <a
                  className="rly-pill"
                  href={courtsideII.ticketsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tickets ↗
                </a>
                <span className="rly-mono" style={{ fontSize: 11, color: "var(--chalk-dim)" }}>
                  {countdown}
                </span>
              </>
            ) : (
              <span className="rly-mono" style={{ fontSize: 11, color: "var(--chalk-dim)" }}>
                Just played · Recap soon
              </span>
            )}
          </div>
        </motion.article>

        {/* Weekly meets */}
        <motion.article variants={fadeUp} className="rly-card rly-card--volt">
          <p className="rly-card__kicker">Every week</p>
          <h3 className="rly-display rly-card__title">Weekly meets</h3>
          <div className="rly-card__rows">
            <span>
              <strong>{weeklyMeets.days}</strong>
            </span>
            <span>{weeklyMeets.city}</span>
          </div>
          <div className="rly-card__cta-row">
            <a
              className="rly-pill rly-pill--ghost"
              href={weeklyMeets.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a spot ↗
            </a>
          </div>
        </motion.article>
      </motion.div>
    </section>
  );
};

export default NextUp;
