import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const stagger = {
  animate: {
    transition: { staggerChildren: 0.3 },
  },
};

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

const Hero = () => {
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background — subtle radial gradient placeholder (video later) */}
      <div className="absolute inset-0 bg-dark">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, #2D2D2D 0%, #1A1A1A 70%)",
          }}
        />
      </div>

      {/* Content */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="relative z-10 text-center px-5"
      >
        {/* Club name */}
        <motion.h1
          variants={fadeUp}
          className="font-display text-[14vw] md:text-[10vw] leading-[0.9] tracking-[0.15em] text-cream font-normal"
        >
          CLUB
        </motion.h1>
        <motion.h1
          variants={fadeUp}
          className="font-display text-[14vw] md:text-[10vw] leading-[0.9] tracking-[0.15em] text-cream font-normal"
        >
          PTO
        </motion.h1>

        {/* Tagline */}
        <motion.p
          variants={fadeUp}
          className="font-body text-lg md:text-xl text-muted font-light tracking-wide opacity-80 mt-6"
        >
          Where the game meets the city
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8"
        >
          <Link
            to="/membership"
            className="bg-gold text-dark px-8 py-3 text-xs uppercase tracking-[0.15em] font-body font-medium hover:bg-cream transition-all duration-500 active:scale-[0.98]"
          >
            Join the Club
          </Link>
          <Link
            to="/book"
            className="border border-cream/30 text-cream px-8 py-3 text-xs uppercase tracking-[0.15em] font-body hover:border-cream transition-all duration-500 active:scale-[0.98]"
          >
            Reserve a Court
          </Link>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-px h-10 bg-gradient-to-b from-cream/40 to-transparent"
        />
      </motion.div>
    </section>
  );
};

export default Hero;
