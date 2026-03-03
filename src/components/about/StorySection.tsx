import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";

const StorySection = () => {
  return (
    <section className="h-[70vh] flex flex-col items-center justify-center px-5">
      <motion.h1
        variants={fadeUp}
        initial="initial"
        animate="animate"
        className="font-display text-5xl md:text-7xl text-cream text-center"
      >
        More than a club
      </motion.h1>
      <motion.p
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.3 }}
        className="text-muted text-sm tracking-[0.15em] uppercase mt-4 font-body"
      >
        est. 2024 · Toronto
      </motion.p>
    </section>
  );
};

export default StorySection;
