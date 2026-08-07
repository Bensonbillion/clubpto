import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { weeklyMeets } from "@/lib/constants";
import "./heroRally.css";

// Full-bleed real photography: landscape rally shot on desktop,
// the net-handshake frame on phones.
const heroWide = `${import.meta.env.BASE_URL}hero-wide.jpg`;
const heroTall = `${import.meta.env.BASE_URL}hero-tall.jpg`;

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".hero-cine__photo",
        { scale: 1.07 },
        { scale: 1, duration: 2.4, ease: "power2.out" }
      );
      gsap.from(".hero-cine__content > *", {
        y: 40,
        autoAlpha: 0,
        duration: 1.1,
        stagger: 0.13,
        ease: "power3.out",
        delay: 0.15,
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="hero-cine">
      <picture>
        <source media="(max-width: 640px)" srcSet={heroTall} />
        <img className="hero-cine__photo" src={heroWide} alt="A rally at golden hour in front of the Club PTO crowd" />
      </picture>
      <div className="hero-cine__scrim" />
      <div className="hero-cine__content">
        <p className="hero-cine__kicker">
          <span className="dot" /> A padel social club in Toronto
        </p>
        <h1 className="hero-cine__title">
          More than a <span className="script">game.</span>
        </h1>
        <div className="hero-cine__ctas">
          <a
            className="rly-pill"
            href={weeklyMeets.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Book a session ↗
          </a>
        </div>
        <p className="hero-cine__meta">
          <span>{weeklyMeets.days} · every week</span>
          <span>{weeklyMeets.city}</span>
        </p>
      </div>
    </section>
  );
};

export default Hero;
