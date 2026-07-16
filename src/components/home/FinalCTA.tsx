import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import { clubInfo, courtsideII, socialLinks } from "@/lib/constants";

const FinalCTA = () => (
  <section className="rly-final">
    <motion.div
      variants={fadeUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-100px" }}
    >
      <h2 className="rly-display rly-final__title">
        Your game
        <br />
        starts here<i>.</i>
      </h2>
      <div className="rly-final__pills">
        <a
          className="rly-pill"
          href={courtsideII.ticketsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Courtside II · Tickets ↗
        </a>
        <Link className="rly-pill rly-pill--ghost" to="/book">
          Book a weekly spot
        </Link>
      </div>
      <p className="rly-final__contact">
        <a href={`mailto:${clubInfo.email}`}>{clubInfo.email}</a>
        <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer">
          @club_pto
        </a>
        <span>Toronto</span>
      </p>
    </motion.div>
  </section>
);

export default FinalCTA;
