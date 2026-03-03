import { useState } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";

const EmailCapture = () => {
  const [email, setEmail] = useState("");

  return (
    <section className="py-32 px-5 md:px-8">
      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className="text-center"
      >
        <h2 className="font-display text-4xl md:text-5xl text-cream">
          Get on the list
        </h2>
        <p className="font-body text-muted text-lg font-light mt-4">
          Founding memberships. First access. Stories from the court.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setEmail("");
          }}
          className="max-w-md mx-auto mt-8"
        >
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent border-b border-cream/20 text-cream placeholder-muted/50 py-3 px-0 text-sm font-body focus:border-gold focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="mt-4 text-gold text-sm uppercase tracking-[0.15em] font-body hover:text-cream transition-colors duration-300"
          >
            Subscribe
          </button>
        </form>
      </motion.div>
    </section>
  );
};

export default EmailCapture;
