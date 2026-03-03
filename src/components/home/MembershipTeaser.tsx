import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";

const tiers = [
  {
    name: "Rally",
    price: "$79",
    features: [
      "7-day advance booking",
      "15% court discount",
      "2 guest passes / year",
      "Member events",
    ],
  },
  {
    name: "Club",
    price: "$149",
    features: [
      "14-day advance booking",
      "30% peak / 60% off-peak discount",
      "6 guest passes / year",
      "League access + member events",
    ],
  },
  {
    name: "Founding",
    price: "Limited",
    features: [
      "Everything in Club",
      "Locked-in pricing forever",
      "12 guest passes / year",
      "Private founding events",
    ],
  },
];

const MembershipTeaser = () => {
  return (
    <section className="py-24 md:py-32 bg-dark-surface">
      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-5xl mx-auto px-5 md:px-8 text-center"
      >
        <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-4">
          Membership
        </p>
        <h2 className="font-display text-3xl md:text-5xl text-cream mb-4">
          Built for players who want more
        </h2>
        <p className="font-body text-muted text-base md:text-lg font-light max-w-2xl mx-auto">
          Priority booking. League access. Events you'll actually want to go
          to. And a community that makes Wednesday the best night of the week.
        </p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-80px" }}
        className="max-w-5xl mx-auto px-5 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
      >
        {tiers.map((tier) => (
          <motion.div
            key={tier.name}
            variants={fadeUp}
            className="bg-dark border border-white/5 p-8 hover:translate-y-[-2px] transition-transform duration-300"
          >
            <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium">
              {tier.name}
            </p>
            <p className="mt-3">
              <span className="font-display text-3xl text-cream">
                {tier.price}
              </span>
              {tier.price !== "Limited" && (
                <span className="text-muted text-sm font-body">/month</span>
              )}
            </p>
            <ul className="mt-6 space-y-3">
              {tier.features.map((f) => (
                <li
                  key={f}
                  className="font-body text-muted text-sm font-light"
                >
                  {f}
                </li>
              ))}
            </ul>
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
        <Link
          to="/membership"
          className="inline-block border border-gold text-gold px-8 py-3 text-xs uppercase tracking-[0.15em] font-body hover:bg-gold hover:text-dark transition-all duration-300 active:scale-[0.98]"
        >
          Explore Membership
        </Link>
      </motion.div>
    </section>
  );
};

export default MembershipTeaser;
