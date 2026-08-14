import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import photoCompete from "@/assets/featured/grid_rally.jpg";
import photoConnect from "@/assets/featured/s2_net.jpg";
import photoAfter from "@/assets/featured/s2_dj.jpg";

// The experience, numbered. Play / Connect / the after, with the room's own
// faces. Row 01 covers both nights equally: no night is the serious one and
// no night is the easy one (see weeklyMeets in lib/constants).
const rows = [
  {
    num: "01",
    title: "Play",
    script: null,
    text: "Two nights a week, same game both times. Long rallies, close points, a court that fills up fast. Take whichever night you can make.",
    photo: photoCompete,
    alt: "A rally at golden hour in front of the crowd",
  },
  {
    num: "02",
    title: "Connect",
    script: null,
    text: "The room between matches is the point. New partners, new rivals, a crew that keeps showing up. Once you're in, you're in.",
    photo: photoConnect,
    alt: "Handshakes and laughs at the net",
  },
  {
    num: "03",
    title: "The",
    script: "after.",
    text: "Courtside is the flagship: tournament padel at The Pad, DJ sets, golden hour until the lights come on. The game is half of it.",
    photo: photoAfter,
    alt: "The DJ booth at Courtside",
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
