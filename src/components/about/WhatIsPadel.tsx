import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";

const stats = [
  { number: "25M+", label: "Players worldwide" },
  { number: "#1", label: "Fastest growing sport" },
  { number: "4", label: "Players per court, always" },
];

const WhatIsPadel = () => {
  return (
    <section className="py-24 md:py-32 bg-dark-surface">
      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-3xl mx-auto px-5 md:px-8 text-center"
      >
        <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-3">
          The Sport
        </p>
        <h2 className="font-display text-3xl md:text-4xl text-cream mb-8">
          What is padel?
        </h2>

        <p className="font-body text-muted font-light leading-relaxed mb-6">
          Imagine tennis and squash had a kid that was more fun than both of
          them. That's padel. Played in doubles on a glass-walled court
          roughly a third the size of a tennis court, it's fast, strategic,
          and wildly social.
        </p>

        <p className="font-body text-muted font-light leading-relaxed mb-6">
          The learning curve is gentle — most people are rallying within
          minutes. But the depth is real. Angles, walls, teamwork. It rewards
          finesse over power, which is why it brings people together instead
          of keeping them apart.
        </p>

        <p className="font-body text-muted font-light leading-relaxed">
          And because it's always doubles, you never play alone. Every point
          is shared. Every game is a conversation.
        </p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-60px" }}
        className="max-w-3xl mx-auto px-5 md:px-8 grid grid-cols-3 gap-8 mt-16"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={fadeUp} className="text-center">
            <p className="font-display text-4xl text-gold">{stat.number}</p>
            <p className="font-body text-muted text-xs uppercase tracking-[0.15em] mt-2">
              {stat.label}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};

export default WhatIsPadel;
