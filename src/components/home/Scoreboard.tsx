import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { weeklyMeets } from "@/lib/constants";

// The facts, scoreboard style. Every value here is real. Both nights get a
// cell of their own: same size, same treatment, no ranking between them.
const cells = [
  { value: "Wed + Sun", label: "every week" },
  { value: weeklyMeets.price, label: "a session" },
  ...weeklyMeets.nights.map((n) => ({ value: n.venue, label: n.day.toLowerCase() })),
];

const Scoreboard = () => (
  <motion.section
    variants={staggerContainer}
    initial="initial"
    whileInView="animate"
    viewport={{ once: true, margin: "-60px" }}
    className="rly-score"
  >
    <div className="rly-score__grid">
      {cells.map((c) => (
        <motion.div key={c.value} variants={fadeUp} className="rly-score__cell">
          <span className="rly-score__value">{c.value}</span>
          <span className="rly-score__label">{c.label}</span>
        </motion.div>
      ))}
    </div>
  </motion.section>
);

export default Scoreboard;
