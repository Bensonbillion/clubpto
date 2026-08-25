import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Picture from "@/components/ui/Picture";
import { fadeUp, staggerContainer } from "@/lib/animations";
import poster from "@/assets/skill-lab-poster.jpg?picture";

// Skill Lab on the homepage: the programme is the product the club is
// pushing, so it gets its own band rather than a line in the calendar.
// It sits after "your first session" on purpose. Someone who just read how
// easy it is to show up is exactly who wants to know how to get good.
//
// Facts here are the confirmed ones only (six players, four weeks, four
// sessions). Day, time, venue and price live on /skills-lab, which owns
// them; this band's job is to say what it is and open that door.

const stats = [
  { num: "6", label: "Players" },
  { num: "4", label: "Weeks" },
  { num: "4", label: "Sessions" },
];

const SkillLab = () => (
  <section className="rly-lab">
    <motion.div
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-80px" }}
      className="rly-lab__inner"
    >
      <motion.figure variants={fadeUp} className="rly-lab__poster">
        <Picture
          img={poster}
          alt="Skill Lab, padel training, refined"
          sizes="(max-width: 900px) 88vw, 38vw"
        />
      </motion.figure>

      <div className="rly-lab__copy">
        <motion.p variants={fadeUp} className="rly-kicker">
          <span className="rly-dot" /> Coaching
        </motion.p>
        <motion.h2 variants={fadeUp} className="rly-display rly-lab__title">
          Level up your <span className="rly-script">game.</span>
        </motion.h2>
        <motion.p variants={fadeUp} className="rly-lab__text">
          Skill Lab is four weeks of small-group padel coaching. Six players,
          one coach, and a plan that meets you where you are, whether you have
          never held a racket or you play every week and keep hitting the same
          ceiling.
        </motion.p>

        <motion.div variants={fadeUp} className="rly-lab__stats">
          {stats.map((s) => (
            <div key={s.label} className="rly-lab__stat">
              <span className="rly-lab__stat-num">{s.num}</span>
              <span className="rly-lab__stat-label">{s.label}</span>
            </div>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} className="rly-lab__cta">
          <Link className="rly-pill" to="/skills-lab">
            See Skill Lab ↗
          </Link>
        </motion.div>
      </div>
    </motion.div>
  </section>
);

export default SkillLab;
