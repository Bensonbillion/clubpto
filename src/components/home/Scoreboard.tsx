import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";

// The facts, scoreboard style. Every value here is real:
// price and Wednesday venue come from the club's Acuity page.
const cells = [
  { value: "Wed + Sun", label: "every week" },
  { value: "CA$20", label: "a session" },
  { value: "District Padel", label: "Wednesdays" },
  { value: "The Pad", label: "Courtside" },
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
