import { motion } from "framer-motion";
import { fadeUp, slideInLeft } from "@/lib/animations";

const FounderStory = () => {
  return (
    <section className="py-24 md:py-32 px-5 md:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Image placeholder */}
        <motion.div
          variants={slideInLeft}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="bg-dark-surface aspect-[3/4] w-full" />
        </motion.div>

        {/* Text */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
        >
          <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-4">
            Our Story
          </p>

          <p className="font-body text-muted font-light leading-relaxed mb-6">
            Club PTO started with a simple idea:{" "}
            <span className="text-cream font-normal">
              what if the best part of playing wasn't just the game?
            </span>{" "}
            We wanted to build something that felt less like a booking app and
            more like a place you actually belonged.
          </p>

          <p className="font-body text-muted font-light leading-relaxed mb-6">
            Toronto's padel scene was growing fast, but there was no home for
            it. No place where beginners and competitive players could share
            the same court, grab a drink after, and come back next week like
            it was tradition.
          </p>

          <p className="font-body text-muted font-light leading-relaxed mb-6">
            So we built one. Wednesday nights became the anchor. The league
            gave it structure. The people gave it soul.
          </p>

          <p className="font-body text-muted font-light leading-relaxed">
            Today, Club PTO is a growing community of players who show up for
            the sport and stay for each other. No velvet ropes. No
            pretension.{" "}
            <span className="text-cream font-normal">
              Just good games and better people.
            </span>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default FounderStory;
