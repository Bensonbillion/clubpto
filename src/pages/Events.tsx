import { useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import PageWrapper from "@/components/layout/PageWrapper";

/* ──────────────────── Data ──────────────────── */

type Category = "All" | "Leagues" | "Clinics" | "Social";

const categories: Category[] = ["All", "Leagues", "Clinics", "Social"];

const upcomingEvents = [
  {
    category: "Leagues" as const,
    title: "Wednesday Night League",
    date: "Every Wed · 8:00 PM",
    location: "The Padel Club, Toronto",
    spots: 8,
    total: 16,
  },
  {
    category: "Clinics" as const,
    title: "Saturday Beginner Clinic",
    date: "Sat, Mar 15 · 10:00 AM",
    location: "The Padel Club, Toronto",
    spots: 4,
    total: 12,
  },
  {
    category: "Social" as const,
    title: "PTO Social Night",
    date: "Fri, Mar 21 · 7:00 PM",
    location: "TBD",
    spots: 22,
    total: 40,
  },
  {
    category: "Clinics" as const,
    title: "Skills Workshop",
    date: "Sun, Mar 23 · 11:00 AM",
    location: "The Padel Club, Toronto",
    spots: 6,
    total: 8,
  },
  {
    category: "Leagues" as const,
    title: "Tournament Qualifier",
    date: "Sat, Mar 29 · 9:00 AM",
    location: "The Padel Club, Toronto",
    spots: 12,
    total: 16,
  },
  {
    category: "Social" as const,
    title: "New Member Mixer",
    date: "Fri, Apr 4 · 6:30 PM",
    location: "TBD",
    spots: 30,
    total: 30,
  },
];

const pastEvents = [
  { name: "Winter League Finals", date: "Feb 26, 2025" },
  { name: "Valentine's Mixer", date: "Feb 14, 2025" },
  { name: "New Year Kickoff", date: "Jan 11, 2025" },
  { name: "Holiday Social", date: "Dec 20, 2024" },
  { name: "Fall Tournament", date: "Nov 16, 2024" },
  { name: "Launch Party", date: "Oct 5, 2024" },
];

/* ──────────────────── Page ──────────────────── */

const Events = () => {
  const [filter, setFilter] = useState<Category>("All");

  const filtered =
    filter === "All"
      ? upcomingEvents
      : upcomingEvents.filter((e) => e.category === filter);

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
          What's on
        </motion.h1>
        <motion.p
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.3 }}
          className="text-muted text-lg mt-4 font-body font-light"
        >
          Sessions, leagues, and gatherings
        </motion.p>
      </section>

      {/* ── Upcoming Events ── */}
      <section className="py-24 md:py-32 px-5 md:px-8 lg:px-12">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-6xl mx-auto"
        >
          {/* Filter tabs */}
          <div className="flex gap-6 mb-12">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`text-xs uppercase tracking-[0.15em] font-body pb-2 transition-all duration-300 ${
                  filter === cat
                    ? "text-gold border-b-2 border-gold"
                    : "text-muted hover:text-cream"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filtered.map((event) => (
            <motion.div
              key={event.title}
              variants={fadeUp}
              className="bg-dark-surface border border-white/5 p-6 hover:border-gold/20 transition-all duration-500"
            >
              <p className="text-gold text-xs uppercase tracking-[0.15em] font-body">
                {event.category}
              </p>
              <h3 className="font-display text-xl text-cream mt-2">
                {event.title}
              </h3>
              <p className="text-muted text-sm font-body mt-1">{event.date}</p>
              <p className="text-muted/60 text-xs font-body mt-1">
                {event.location}
              </p>

              {/* Capacity bar */}
              <div className="mt-3">
                <div className="w-full h-1 bg-dark rounded-none overflow-hidden">
                  <div
                    className="h-full bg-gold transition-all duration-700"
                    style={{
                      width: `${(event.spots / event.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-muted text-xs font-body mt-1">
                  {event.spots}/{event.total} spots
                </p>
              </div>

              <a
                href="#"
                className="inline-block text-gold text-xs uppercase tracking-[0.15em] font-body hover:text-cream transition-colors duration-300 mt-4"
              >
                Reserve Spot
              </a>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Past Events ── */}
      <section className="py-24 md:py-32 bg-dark-surface px-5 md:px-8 lg:px-12">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-6xl mx-auto"
        >
          <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-3">
            Past Events
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-cream mb-12">
            See what you missed
          </h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {pastEvents.map((event) => (
            <motion.div
              key={event.name}
              variants={fadeUp}
              className="relative group aspect-video bg-dark overflow-hidden"
            >
              <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/10 transition-all duration-500" />
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <p className="font-display text-lg text-cream">{event.name}</p>
                <p className="text-muted text-xs font-body mt-1">
                  {event.date}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </PageWrapper>
  );
};

export default Events;
