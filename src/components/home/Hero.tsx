import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import heroGridStyle from "@/assets/hero-grid-style.jpg";
import heroGridPoint from "@/assets/hero-grid-point.jpg";
import heroSocial from "@/assets/hero-s2-social.jpg";
import { courtsideII, weeklyMeets, isCourtsideUpcoming } from "@/lib/constants";
import "./heroRally.css";

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);

  // Entrance choreography and idle float, as authored in hero-c
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.from(".f1", { y: 60, rotate: 12, autoAlpha: 0, duration: 0.9, ease: "expo.out", delay: 0.2 });
      gsap.from(".f2", { y: 60, rotate: -14, autoAlpha: 0, duration: 0.9, ease: "expo.out", delay: 0.38 });
      gsap.from(".f3", { y: 60, rotate: 10, autoAlpha: 0, duration: 0.9, ease: "expo.out", delay: 0.56 });
      gsap.from(".stamp", { scale: 0.4, rotate: 14, autoAlpha: 0, duration: 0.8, ease: "elastic.out(1,0.5)", delay: 0.9 });
      gsap.to(".f1", { y: -7, duration: 3.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(".f2", { y: 6, duration: 3.8, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(".f3", { y: -5, duration: 3.5, yoyo: true, repeat: -1, ease: "sine.inOut" });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="hero-rally">
      <div className="stage">
        <h1 className="type">
          More
          <br />
          than
          <br />
          a
          <br />
          game<i>.</i>
        </h1>
        <figure className="frame f1">
          <img src={heroGridStyle} alt="Style in the room at Set 01" />
        </figure>
        <figure className="frame f2">
          <img src={heroGridPoint} alt="Match point at golden hour" loading="lazy" />
        </figure>
        <figure className="frame f3">
          <img src={heroSocial} alt="Two friends in the room" loading="lazy" />
        </figure>
        <span className="stamp mono">
          Set 01 sold out
          <br />
          in advance
        </span>
      </div>
      <div className="foot">
        <p className="eyebrow mono">
          <span className="dot" /> A Padel Social Club in Toronto
        </p>
        {isCourtsideUpcoming() ? (
          <a className="cta" href={courtsideII.ticketsUrl} target="_blank" rel="noopener noreferrer">
            Courtside II · {courtsideII.dateLabel} · Tickets ↗
          </a>
        ) : (
          <a className="cta" href={weeklyMeets.bookingUrl} target="_blank" rel="noopener noreferrer">
            Book a weekly spot ↗
          </a>
        )}
        <div className="meta mono">
          <span>The Pad · 309 Cherry St</span>
          <span>Wed + Sun weekly</span>
        </div>
      </div>
    </section>
  );
};

export default Hero;
