import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const Manifesto = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!textRef.current || !sectionRef.current) return;

    // Split into words and wrap each in a span
    const text = textRef.current;
    const original = text.textContent || "";
    const words = original.split(" ");
    text.innerHTML = words
      .map((word) => {
        // Highlight "community" in gold
        if (word.toLowerCase() === "community") {
          return `<span class="inline-block opacity-0 text-gold">${word}</span>`;
        }
        return `<span class="inline-block opacity-0">${word}</span>`;
      })
      .join(' <span class="inline-block">\u200B</span>');

    const spans = text.querySelectorAll("span.inline-block[style], span.inline-block:not([style])");
    const wordSpans = Array.from(text.querySelectorAll("span.inline-block")).filter(
      (el) => el.textContent && el.textContent.trim().length > 0 && el.textContent !== "\u200B"
    );

    gsap.fromTo(
      wordSpans,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          end: "top 25%",
          scrub: 1,
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="min-h-[70vh] flex items-center justify-center px-5 md:px-8"
    >
      <h2
        ref={textRef}
        className="font-display text-3xl md:text-5xl lg:text-6xl leading-tight text-cream font-normal text-center max-w-4xl mx-auto"
      >
        Not just a club. A community built around the fastest-growing sport in
        the world — and the people who play it.
      </h2>
    </section>
  );
};

export default Manifesto;
