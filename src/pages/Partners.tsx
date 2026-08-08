import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { clubInfo, weeklyMeets } from "@/lib/constants";
import photoDj from "@/assets/wall/s2_dj.jpg";

// The form composes a structured email; nothing is silently collected.
const Partners = () => {
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const org = String(fd.get("org") || "").trim();
    const name = String(fd.get("name") || "").trim();
    const subject = `Partner inquiry · ${org || name}`;
    const body = [
      `Name: ${name}`,
      `Organization: ${org}`,
      `Email: ${String(fd.get("email") || "").trim()}`,
      `Interest: ${String(fd.get("interest") || "")}`,
      "",
      String(fd.get("message") || "").trim(),
    ].join("\n");
    window.location.href = `mailto:${clubInfo.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <PageWrapper>
      <div className="rly-page">
        <motion.section
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="rly-page__hero"
        >
          <motion.p variants={fadeUp} className="rly-kicker">
            <span className="rly-dot" /> Partners + sponsors
          </motion.p>
          <motion.h1 variants={fadeUp} className="rly-display rly-page__title">
            Build it
            <br />
            <span className="rly-script">with us.</span>
          </motion.h1>
          <motion.div variants={fadeUp} className="rly-prose" style={{ marginTop: "2rem" }}>
            <p>
              Courtside brings tournament padel, DJ sets, and a room that shows
              up. Series I sold out in advance. Weekly sessions run{" "}
              {weeklyMeets.days}, every week, all year.
            </p>
            <p>
              Past partners include CELSIUS. If your brand belongs in that
              room, tell us about it.
            </p>
          </motion.div>
        </motion.section>

        <div className="rly-page__body">
          <div className="rly-partner-grid">
            <motion.form
              variants={fadeUp}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-80px" }}
              className="rly-form"
              onSubmit={onSubmit}
            >
              <div className="rly-form__row">
                <label>
                  Name
                  <input name="name" type="text" required autoComplete="name" />
                </label>
                <label>
                  Brand / organization
                  <input name="org" type="text" autoComplete="organization" />
                </label>
              </div>
              <label>
                Email
                <input name="email" type="email" required autoComplete="email" />
              </label>
              <label>
                Interest
                <select name="interest" defaultValue="Sponsorship">
                  <option>Sponsorship</option>
                  <option>Venue</option>
                  <option>Media</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Tell us more
                <textarea name="message" placeholder="What do you have in mind?" />
              </label>
              <div className="rly-cta-row" style={{ marginTop: 0 }}>
                <button type="submit" className="rly-pill">
                  Send it ↗
                </button>
              </div>
              <p className="rly-form__note">
                Send opens your email app · or write us directly at{" "}
                <a href={`mailto:${clubInfo.email}`}>{clubInfo.email}</a>
              </p>
            </motion.form>

            <motion.figure
              variants={fadeUp}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-80px" }}
              className="rly-partner-photo"
            >
              <img src={photoDj} alt="" loading="lazy" />
            </motion.figure>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Partners;
