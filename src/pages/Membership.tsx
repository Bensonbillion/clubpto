import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import PageWrapper from "@/components/layout/PageWrapper";

/* ──────────────────── Data ──────────────────── */

const benefits = [
  {
    title: "Priority Booking",
    desc: "Reserve courts before the public. Your schedule, your game.",
  },
  {
    title: "League Access",
    desc: "Compete in structured Wednesday night league play.",
  },
  {
    title: "Member Events",
    desc: "Mixers, clinics, and socials built around the community.",
  },
  {
    title: "Skill Clinics",
    desc: "Level up with coached sessions for every skill tier.",
  },
  {
    title: "Guest Passes",
    desc: "Bring friends to experience the club firsthand.",
  },
  {
    title: "The Community",
    desc: "The people are the point. You'll see what we mean.",
  },
];

const tiers = [
  {
    id: "rally",
    label: "RALLY",
    labelColor: "text-cream",
    monthly: 79,
    annual: 63,
    features: [
      "7-day advance booking",
      "15% court discount",
      "2 guest passes / year",
      "Member events",
      "Basic welcome pack",
    ],
    cta: "Get Started",
    ctaClass:
      "border border-cream/20 text-cream hover:bg-cream hover:text-dark",
    highlighted: false,
  },
  {
    id: "club",
    label: "CLUB",
    labelColor: "text-gold",
    monthly: 149,
    annual: 119,
    features: [
      "14-day advance booking",
      "30% peak / 60% off-peak discount",
      "6 guest passes / year",
      "League access",
      "Member + exclusive events",
      "Premium welcome pack",
    ],
    cta: "Join the Club",
    ctaClass: "bg-gold text-dark hover:bg-gold/90",
    highlighted: true,
    badge: "MOST POPULAR",
  },
  {
    id: "founding",
    label: "FOUNDING · LIMITED",
    labelColor: "text-gold",
    monthly: null,
    annual: null,
    features: [
      "Everything in Club",
      "Locked-in pricing forever",
      "12 guest passes / year",
      "Private founding events",
      "Priority everything",
    ],
    cta: "Apply Now",
    ctaClass: "border border-gold text-gold hover:bg-gold hover:text-dark",
    highlighted: false,
    counter: "12 of 50 spots claimed",
  },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no long-term contracts. Cancel your membership anytime from your account — no fees, no hassle. Your access continues until the end of your billing period.",
  },
  {
    q: "What's included in court discounts?",
    a: "Members receive discounted hourly rates at our partner facilities. Rally members get 15% off standard rates. Club members get 30% off peak hours and 60% off-peak — the best value for regular players.",
  },
  {
    q: "How does the founding rate work?",
    a: "Founding members lock in their monthly rate for life — it will never increase, even as we grow and prices change. Only 50 spots are available, and once they're gone, they're gone.",
  },
  {
    q: "Can I try before I commit?",
    a: "Absolutely. Drop into any Wednesday night open session as a guest. No commitment, no pressure. If you like what you see, membership is just a click away.",
  },
];

/* ──────────────────── FAQ Item ──────────────────── */

const FAQItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="font-body text-cream text-base">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-gold text-xl leading-none ml-4 flex-shrink-0"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="font-body text-muted text-sm font-light leading-relaxed pb-5">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────── Page ──────────────────── */

const Membership = () => {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <PageWrapper>
      {/* ── Section 1: Hero ── */}
      <section className="h-[60vh] flex flex-col items-center justify-center text-center px-5">
        <motion.h1
          variants={fadeUp}
          initial="initial"
          animate="animate"
          className="font-display text-5xl md:text-7xl text-cream"
        >
          Find your game
        </motion.h1>
        <motion.p
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.3 }}
          className="text-muted text-lg mt-4 font-body font-light max-w-md"
        >
          More than court time. A community that plays together.
        </motion.p>
      </section>

      {/* ── Section 2: Benefits ── */}
      <section className="py-24 md:py-32 px-5 md:px-8 lg:px-12">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-12"
        >
          <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-3">
            What You Get
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-cream">
            Built for the way you play
          </h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-8"
        >
          {benefits.map((b) => (
            <motion.div key={b.title} variants={fadeUp}>
              <div className="w-12 h-12 border border-gold/30 rounded-full mb-4" />
              <h3 className="font-body text-cream text-lg mb-2">{b.title}</h3>
              <p className="font-body text-muted text-sm font-light leading-relaxed">
                {b.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Section 3: Tier Comparison ── */}
      <section className="py-24 md:py-32 bg-dark-surface px-5 md:px-8 lg:px-12">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center"
        >
          <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-8">
            Membership Tiers
          </p>

          {/* Billing toggle */}
          <div className="inline-flex gap-2">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 text-xs uppercase tracking-[0.15em] font-body transition-all duration-300 ${
                billing === "monthly"
                  ? "bg-gold text-dark"
                  : "border border-cream/20 text-cream hover:border-cream/40"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-5 py-2 text-xs uppercase tracking-[0.15em] font-body transition-all duration-300 ${
                billing === "annual"
                  ? "bg-gold text-dark"
                  : "border border-cream/20 text-cream hover:border-cream/40"
              }`}
            >
              Annual
            </button>
          </div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
        >
          {tiers.map((tier) => (
            <motion.div
              key={tier.id}
              variants={fadeUp}
              className={`bg-dark p-8 relative ${
                tier.highlighted
                  ? "border border-gold/40"
                  : tier.id === "founding"
                  ? "border border-gold/20"
                  : "border border-white/5"
              }`}
            >
              {tier.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-dark text-[10px] uppercase tracking-widest px-4 py-1 font-body">
                  {tier.badge}
                </span>
              )}

              <p
                className={`${tier.labelColor} text-xs uppercase tracking-[0.15em] font-body font-medium`}
              >
                {tier.label}
              </p>

              <p className="mt-3">
                {tier.monthly !== null ? (
                  <>
                    <span className="font-display text-4xl text-cream">
                      ${billing === "monthly" ? tier.monthly : tier.annual}
                    </span>
                    <span className="text-muted text-sm font-body">/mo</span>
                  </>
                ) : (
                  <>
                    <span className="font-display text-3xl text-cream">
                      Locked Rate
                    </span>
                    <br />
                    <span className="text-muted text-sm font-body">
                      First 50 members only
                    </span>
                  </>
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

              <Link
                to="/book"
                className={`mt-8 block text-center px-6 py-3 text-xs uppercase tracking-[0.15em] font-body transition-all duration-300 active:scale-[0.98] ${tier.ctaClass}`}
              >
                {tier.cta}
              </Link>

              {tier.counter && (
                <p className="text-gold/60 text-xs font-body text-center mt-4">
                  {tier.counter}
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>

        {billing === "annual" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-gold/60 text-xs font-body mt-6"
          >
            Annual billing — save up to 20%
          </motion.p>
        )}
      </section>

      {/* ── Section 4: FAQ Accordion ── */}
      <section className="py-24 md:py-32 px-5 md:px-8 lg:px-12">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-12"
        >
          <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-3">
            Questions
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-cream">
            Good to know
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          {faqs.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ── Section 5: Final CTA ── */}
      <section className="py-24 md:py-32 text-center px-5">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
        >
          <h2 className="font-display text-3xl md:text-4xl text-cream mb-8">
            Ready to play?
          </h2>
          <Link
            to="/book"
            className="inline-block bg-gold text-dark px-8 py-3 text-xs uppercase tracking-[0.15em] font-body hover:bg-gold/90 transition-all duration-300 active:scale-[0.98]"
          >
            Join the Club
          </Link>
        </motion.div>
      </section>
    </PageWrapper>
  );
};

export default Membership;
