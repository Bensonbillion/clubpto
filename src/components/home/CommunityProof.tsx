import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";

const gridItems = [
  { aspect: "aspect-square" },
  { aspect: "aspect-[3/4]" },
  { aspect: "aspect-square" },
  { aspect: "aspect-[3/4]" },
  { aspect: "aspect-[3/4]" },
  { aspect: "aspect-square" },
  { aspect: "aspect-square" },
  { aspect: "aspect-[3/4]" },
];

const CommunityProof = () => {
  return (
    <section className="py-24 md:py-32 bg-dark-surface">
      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className="text-center mb-12 px-5"
      >
        <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-3">
          The Community
        </p>
        <h2 className="font-display text-3xl md:text-4xl text-cream">
          The faces behind the rackets
        </h2>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-60px" }}
        className="max-w-7xl mx-auto px-5 md:px-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
      >
        {gridItems.map((item, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            className={`${item.aspect} bg-dark relative group overflow-hidden cursor-pointer`}
          >
            <div className="absolute inset-0 bg-cream/0 group-hover:bg-cream/5 transition-colors duration-500" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <span className="text-cream/50 text-xs font-body uppercase tracking-widest">
                Coming soon
              </span>
            </div>
            <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.02]" />
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
        className="text-center mt-8"
      >
        <a
          href="https://instagram.com/clubpto"
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-muted hover:text-gold text-sm transition-colors duration-300"
        >
          Follow us @clubpto
        </a>
      </motion.div>
    </section>
  );
};

export default CommunityProof;
