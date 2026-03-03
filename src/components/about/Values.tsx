import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";

const values = [
  {
    title: "Community First",
    desc: "The game brings us together. The people keep us coming back. Everything we build starts with who it's for.",
  },
  {
    title: "All Levels Welcome",
    desc: "First serve or match point — everyone belongs on the court. We meet you where you are and grow together.",
  },
  {
    title: "Play With Purpose",
    desc: "Every session has intention. Compete honestly, support your partner, and leave the court better than you found it.",
  },
];

const Values = () => {
  return (
    <section className="py-24 md:py-32 px-5 md:px-8 lg:px-12">
      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className="text-center mb-12"
      >
        <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-3">
          What We Believe
        </p>
        <h2 className="font-display text-3xl md:text-4xl text-cream">
          Our values
        </h2>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-60px" }}
        className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12"
      >
        {values.map((v) => (
          <motion.div key={v.title} variants={fadeUp} className="text-center">
            <h3 className="font-display text-xl text-cream mb-3">
              {v.title}
            </h3>
            <p className="font-body text-muted text-sm font-light leading-relaxed">
              {v.desc}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};

export default Values;
