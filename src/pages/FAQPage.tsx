import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { clubInfo, weeklyMeets } from "@/lib/constants";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Facts only. Times live on the booking page, never here.
const faqs = [
  {
    question: "Do I need a membership?",
    answer:
      "No. There's no membership and no commitment. Book a session, come play.",
  },
  {
    question: "What level do I need to be?",
    answer:
      "All levels. First time holding a padel racket? Perfect. Come as you are.",
  },
  {
    question: "What should I bring?",
    answer:
      "Comfortable athletic wear. Rackets and balls are provided. Court shoes are ideal; clean sneakers work fine.",
  },
  {
    question: "When do sessions run?",
    answer:
      "Wednesdays and Sundays, every week. Same night either way, so take whichever one suits you. Exact start times are on the booking page.",
  },
  {
    question: "Where do you play?",
    answer: `${weeklyMeets.nights[0].day} at ${weeklyMeets.nights[0].venue} in ${weeklyMeets.nights[0].area}. ${weeklyMeets.nights[1].day} at ${weeklyMeets.nights[1].venue} in ${weeklyMeets.nights[1].area}. Courtside events land at The Pad. Full details come with your booking.`,
  },
  {
    question: "How do I book?",
    answer:
      "Through our booking page: CA$20 a session. Spots are limited, so grab yours early.",
  },
  {
    question: "Can I come alone?",
    answer:
      "Yes. Wednesday's format pairs you up when you arrive. Once you're in, you're in.",
  },
  {
    question: "What if I have to cancel?",
    answer:
      "Plans change. Give us 24 hours so your spot can go to someone else.",
  },
];

const FAQPage = () => (
  <PageWrapper>
    <div className="rly-page">
      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="rly-page__hero"
      >
        <motion.p variants={fadeUp} className="rly-kicker">
          <span className="rly-dot" /> Got questions?
        </motion.p>
        <motion.h1 variants={fadeUp} className="rly-display rly-page__title">
          Ask <span className="rly-script">away.</span>
        </motion.h1>
      </motion.section>

      <div className="rly-page__body">
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          style={{ maxWidth: 720 }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={`item-${index}`}
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <AccordionTrigger
                  className="rly-display hover:no-underline text-left"
                  style={{
                    fontSize: "clamp(1.1rem, 2.4vw, 1.5rem)",
                    padding: "1.2rem 0",
                    color: "var(--chalk)",
                  }}
                >
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent
                  style={{
                    fontFamily: "var(--f-body)",
                    fontSize: 16,
                    fontWeight: 300,
                    lineHeight: 1.6,
                    color: "var(--chalk-dim)",
                    paddingBottom: "1.2rem",
                  }}
                >
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="rly-cta-row" style={{ marginTop: "3rem" }}>
            <a
              className="rly-pill"
              href={weeklyMeets.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a session ↗
            </a>
            <a className="rly-pill rly-pill--ghost" href={`mailto:${clubInfo.email}`}>
              Ask us anything
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  </PageWrapper>
);

export default FAQPage;
