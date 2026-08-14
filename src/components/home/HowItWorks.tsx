import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { weeklyMeets } from "@/lib/constants";

// Persona one's push: first-timers need to know exactly how easy it is.
// Both nights are described identically on purpose (see weeklyMeets).
const nights = weeklyMeets.nights
  .map((n) => `${n.day} at ${n.venue}, ${n.area}`)
  .join(". ");

const steps = [
  {
    num: "01",
    title: "Book a spot",
    text: `${weeklyMeets.price} on our booking page, either night. No membership, no commitment.`,
  },
  {
    num: "02",
    title: "Show up",
    text: `${nights}. First time on a padel court? Perfect. Come as you are.`,
  },
  {
    num: "03",
    title: "Stay for the hang",
    text: "The game is half of it. Meet the room, stay for golden hour. Once you're in, you're in.",
  },
];

const HowItWorks = () => (
  <section className="rly-steps">
    <motion.div
      variants={fadeUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-80px" }}
      className="rly-steps__head"
    >
      <p className="rly-kicker">
        <span className="rly-dot" /> New here?
      </p>
      <h2 className="rly-display rly-steps__heading">
        Your first <span className="rly-script">session.</span>
      </h2>
    </motion.div>

    <motion.div
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-60px" }}
      className="rly-steps__grid"
    >
      {steps.map((s) => (
        <motion.div key={s.num} variants={fadeUp} className="rly-steps__item">
          <span className="rly-steps__num">{s.num}</span>
          <h3 className="rly-display rly-steps__title">{s.title}</h3>
          <p className="rly-steps__text">{s.text}</p>
        </motion.div>
      ))}
    </motion.div>

    <motion.div
      variants={fadeUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
      className="rly-steps__cta"
    >
      <a
        className="rly-pill"
        href={weeklyMeets.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Book your first session ↗
      </a>
    </motion.div>
  </section>
);

export default HowItWorks;
