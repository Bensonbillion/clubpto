import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import photoCompete from "@/assets/hero-grid-point.jpg";
import photoConnect from "@/assets/hero-grid-style.jpg";
import photoAfter from "@/assets/hero-s2-social.jpg";

// The experience, numbered. Compete / Connect / the after -
// the book's own words, with the room's own faces.
const rows = [
  {
    num: "01",
    title: "Compete",
    script: null,
    text: "Tournament padel, every Wednesday. Real matches, real standings.",
    photo: photoCompete,
    alt: "Arms up after winning the point",
  },
  {
    num: "02",
    title: "Connect",
    script: null,
    text: "The room between matches. Once you're in, you're in.",
    photo: photoConnect,
    alt: "Friends courtside at golden hour",
  },
  {
    num: "03",
    title: "The",
    script: "after.",
    text: "DJ sets and golden hour. The game is half of it.",
    photo: photoAfter,
    alt: "Laughing at the DJ booth",
  },
];

const Experience = () => (
  <section className="rly-exp" id="experience">
    <div className="rly-exp__head">
      <p className="rly-kicker">
        <span className="rly-dot" /> The experience
      </p>
      <h2 className="rly-display rly-exp__heading">
        This isn't just <span className="rly-script">padel.</span>
      </h2>
    </div>

    {rows.map((row, i) => (
      <motion.div
        key={row.num}
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className={`rly-exp__row ${i % 2 === 1 ? "rly-exp__row--flip" : ""}`}
      >
        <motion.figure variants={fadeUp} className="rly-exp__photo">
          <img src={row.photo} alt={row.alt} loading="lazy" />
        </motion.figure>
        <motion.div variants={fadeUp} className="rly-exp__copy">
          <span className="rly-exp__num">{row.num}</span>
          <h3 className="rly-display rly-exp__title">
            {row.title}
            {row.script ? (
              <>
                {" "}
                <span className="rly-script">{row.script}</span>
              </>
            ) : (
              "."
            )}
          </h3>
          <p className="rly-exp__text">{row.text}</p>
        </motion.div>
      </motion.div>
    ))}
  </section>
);

export default Experience;
