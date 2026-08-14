import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { socialLinks } from "@/lib/constants";

// Persona three's five-minute read: how the club grew, in facts.
const moments = [
  {
    when: "2025",
    what: "The first meets",
    note: "A padel social club starts in Toronto. Wednesdays and Sundays, every week since.",
  },
  {
    when: "May '26",
    what: "Courtside · Series I",
    note: "The first Summer Series set. Tournament padel at The Pad. Sold out in advance.",
  },
  {
    when: "Jul '26",
    what: "Courtside · Series II",
    note: "The Day Party. Tournament padel, DJ sets, golden hour until the lights came on.",
  },
  {
    when: "Now",
    what: "Every week",
    note: "Wednesdays and Sundays, both nights on court. The room keeps growing.",
  },
  {
    when: "Next",
    what: "Watch this space",
    note: "The next series drops on @club_pto first.",
  },
];

const Story = () => (
  <section className="rly-story">
    <motion.div
      variants={fadeUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-80px" }}
      className="rly-story__head"
    >
      <p className="rly-kicker">
        <span className="rly-dot" /> The story so far
      </p>
      <h2 className="rly-display rly-story__heading">
        Built one <span className="rly-script">night</span> at a time.
      </h2>
    </motion.div>

    <motion.ol
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-60px" }}
      className="rly-story__list"
    >
      {moments.map((m) => (
        <motion.li key={m.when + m.what} variants={fadeUp} className="rly-story__item">
          <span className="rly-story__when">{m.when}</span>
          <span className="rly-story__what">{m.what}</span>
          <span className="rly-story__note">{m.note}</span>
        </motion.li>
      ))}
    </motion.ol>

    <motion.div
      variants={fadeUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
      className="rly-story__cta"
    >
      <a
        className="rly-pill rly-pill--ghost"
        href={socialLinks.instagram}
        target="_blank"
        rel="noopener noreferrer"
      >
        Watch it grow on @club_pto ↗
      </a>
    </motion.div>
  </section>
);

export default Story;
