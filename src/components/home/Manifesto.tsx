import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const Manifesto = () => {
  const sectionRef = useRef<HTMLElement>(null);

  // Scrub-fill: each line brightens as it crosses the viewport
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".rly-manifesto__line").forEach((line) => {
        gsap.fromTo(
          line,
          { opacity: 0.13 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: line,
              start: "top 85%",
              end: "top 45%",
              scrub: 0.6,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="rly-manifesto">
      <h2>
        <span className="rly-manifesto__line block">Not a venue.</span>
        <span className="rly-manifesto__line block">Not a league.</span>
        <span className="rly-manifesto__line block">Not a gym.</span>
        <span className="rly-manifesto__line rly-manifesto__line--volt block">
          A padel social club.
        </span>
      </h2>
      <p className="rly-manifesto__sub">Toronto · Where the game meets the city</p>
    </section>
  );
};

export default Manifesto;
