import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { socialLinks } from "@/lib/constants";

// Every curated photo in src/assets/wall renders here, no captions.
const photos = Object.values(
  import.meta.glob("@/assets/wall/*.jpg", { eager: true, as: "url" })
) as string[];

const Community = () => (
  <PageWrapper>
    <div className="rly-page">
      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="rly-page__hero"
      >
        <motion.p variants={fadeUp} className="rly-kicker">
          <span className="rly-dot" /> The wall
        </motion.p>
        <motion.h1 variants={fadeUp} className="rly-display rly-page__title">
          Real <span className="rly-script">nights.</span>
        </motion.h1>
      </motion.section>

      <div className="rly-masonry">
        {photos.map((src) => (
          <img key={src} src={src} alt="" loading="lazy" />
        ))}
      </div>

      <div className="rly-page__body">
        <div className="rly-cta-row">
          <a
            className="rly-pill"
            href={socialLinks.instagram}
            target="_blank"
            rel="noopener noreferrer"
          >
            More on @club_pto ↗
          </a>
        </div>
      </div>
    </div>
  </PageWrapper>
);

export default Community;
