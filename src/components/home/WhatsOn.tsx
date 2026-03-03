import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";

const events = [
  {
    date: "Wed, Mar 12",
    name: "Wednesday Night League",
    time: "8:00 PM — 10:00 PM",
    location: "Toronto",
    spots: 8,
  },
  {
    date: "Sat, Mar 15",
    name: "Beginner Clinic",
    time: "10:00 AM — 12:00 PM",
    location: "Toronto",
    spots: 4,
  },
  {
    date: "Thu, Mar 20",
    name: "PTO Social",
    time: "7:00 PM — 10:00 PM",
    location: "Toronto",
    spots: 0,
  },
];

const WhatsOn = () => {
  return (
    <section className="py-24 md:py-32 px-5 md:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col md:flex-row md:justify-between md:items-end mb-12"
        >
          <div>
            <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium mb-3">
              What's On
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-cream">
              Upcoming at Club PTO
            </h2>
          </div>
          <Link
            to="/events"
            className="text-muted hover:text-cream text-sm font-body transition-colors duration-300 mt-4 md:mt-0"
          >
            View all events →
          </Link>
        </motion.div>

        {/* Event cards */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {events.map((event) => (
            <motion.div
              key={event.name}
              variants={fadeUp}
              className="bg-dark-surface border border-white/5 p-6 hover:border-gold/30 transition-all duration-500 hover:translate-y-[-2px]"
            >
              <p className="text-gold text-xs uppercase tracking-[0.15em] font-body font-medium">
                {event.date}
              </p>
              <h3 className="font-display text-xl text-cream mt-2">
                {event.name}
              </h3>
              <p className="font-body text-muted text-sm mt-1">
                {event.time}
              </p>
              <p className="font-body text-muted/60 text-xs mt-1">
                {event.location}
              </p>
              <p
                className={`text-xs mt-4 font-body ${
                  event.spots > 0
                    ? "text-gold"
                    : "text-muted/50"
                }`}
              >
                {event.spots > 0
                  ? `${event.spots} spots left`
                  : "Sold out"}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default WhatsOn;
