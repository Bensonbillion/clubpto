import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";

const FinalCTA = () => {
  return (
    <section className="py-24 px-5 md:px-8">
      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className="text-center"
      >
        <h2 className="font-display text-3xl md:text-4xl text-cream">
          Your game starts here.
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
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
        </div>
      </motion.div>
    </section>
  );
};

export default FinalCTA;
