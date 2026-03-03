import { motion } from "framer-motion";
import { fadeUp, slideInLeft, slideInRight } from "@/lib/animations";

const blocks = [
  {
    label: "The Court",
    title: "Your best rally awaits",
    desc: "Competitive when you want it. Casual when you don't. Every session is designed to bring out your best game.",
  },
  {
    label: "The Community",
    title: "Your people are here",
    desc: "Meet players who become friends. The kind of people who text the group chat before Wednesday even hits.",
  },
  {
    label: "The League",
    title: "Find your level",
    desc: "Tiered league nights for every skill level. Whether you're picking up a racket for the first time or chasing match point.",
  },
  {
    label: "The Social",
    title: "Stay for the stories",
    desc: "The best part happens after the last point. Post-match hangs, events, and the conversations that keep you coming back.",
  },
];

const ExperienceArc = () => {
  return (
    <section className="py-24 md:py-32 px-5 md:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto flex flex-col gap-24 md:gap-32">
        {blocks.map((block, i) => {
          const isReversed = i % 2 === 1;

          return (
            <div
              key={block.label}
              className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center ${
                isReversed ? "md:[direction:rtl]" : ""
              }`}
            >
              {/* Image placeholder */}
              <motion.div
                variants={isReversed ? slideInRight : slideInLeft}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true, margin: "-100px" }}
                className="md:[direction:ltr]"
              >
                <div className="bg-dark-surface aspect-video w-full" />
              </motion.div>

              {/* Text */}
              <motion.div
                variants={fadeUp}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true, margin: "-100px" }}
                className="md:[direction:ltr]"
              >
                <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-3">
                  {block.label}
                </p>
                <h3 className="font-display text-2xl md:text-3xl text-cream mb-4">
                  {block.title}
                </h3>
                <p className="font-body text-muted text-base font-light leading-relaxed">
                  {block.desc}
                </p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ExperienceArc;
