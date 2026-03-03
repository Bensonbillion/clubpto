import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { socialLinks } from "@/lib/constants";
import PageWrapper from "@/components/layout/PageWrapper";

/* ──────────────────── Data ──────────────────── */

const galleryItems = [
  { id: 1, aspect: "aspect-square" },
  { id: 2, aspect: "aspect-[3/4]" },
  { id: 3, aspect: "aspect-video" },
  { id: 4, aspect: "aspect-square" },
  { id: 5, aspect: "aspect-[3/4]" },
  { id: 6, aspect: "aspect-square" },
  { id: 7, aspect: "aspect-video" },
  { id: 8, aspect: "aspect-[3/4]" },
  { id: 9, aspect: "aspect-square" },
  { id: 10, aspect: "aspect-video" },
  { id: 11, aspect: "aspect-[3/4]" },
  { id: 12, aspect: "aspect-square" },
];

const stats = [
  { number: "200+", label: "Members" },
  { number: "50+", label: "Sessions run" },
  { number: "3", label: "Skill tiers" },
  { number: "1", label: "Community" },
];

/* ──────────────────── Page ──────────────────── */

const Community = () => {
  return (
    <PageWrapper>
      {/* ── Hero ── */}
      <section className="h-[50vh] flex flex-col items-center justify-center text-center px-5">
        <motion.h1
          variants={fadeUp}
          initial="initial"
          animate="animate"
          className="font-display text-5xl md:text-7xl text-cream"
        >
          The community
        </motion.h1>
        <motion.p
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.3 }}
          className="text-muted text-lg mt-4 font-body font-light"
        >
          The faces and stories behind the rackets
        </motion.p>
      </section>

      {/* ── Photo Gallery ── */}
      <section className="py-24 md:py-32 px-5 md:px-8 lg:px-12">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
        >
          {galleryItems.map((item) => (
            <motion.div
              key={item.id}
              variants={fadeUp}
              className={`${item.aspect} bg-dark-surface relative group overflow-hidden`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-muted/20 text-xs font-body">
                {item.id}
              </span>
              <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/10 transition-all duration-500 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-cream opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
              </div>
              <div className="absolute inset-0 group-hover:scale-[1.02] transition-transform duration-500" />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 bg-dark-surface px-5 md:px-8">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              className="text-center"
            >
              <p className="font-display text-4xl text-gold">{stat.number}</p>
              <p className="text-muted text-xs uppercase tracking-[0.15em] font-body mt-2">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Instagram CTA ── */}
      <section className="py-24 md:py-32 px-5 md:px-8 text-center">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
        >
          <h2 className="font-display text-2xl md:text-3xl text-cream mb-4">
            Follow the action
          </h2>
          <a
            href={socialLinks.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold text-lg font-body hover:text-cream transition-colors duration-300"
          >
            @clubpto
          </a>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-40px" }}
          className="max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-2 mt-12"
        >
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="aspect-square bg-dark-surface group relative overflow-hidden"
            >
              <span className="absolute inset-0 flex items-center justify-center text-muted/20 text-xs font-body">
                IG
              </span>
              <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/10 transition-all duration-500" />
            </motion.div>
          ))}
        </motion.div>
      </section>
    </PageWrapper>
  );
};

export default Community;
