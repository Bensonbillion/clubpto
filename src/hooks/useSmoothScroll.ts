import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useSmoothScroll() {
  useEffect(() => {
    // Disable on touch devices to avoid mobile Safari issues
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) return;

    // Light smoothing only: long durations read as laggy scroll
    const lenis = new Lenis({
      duration: 0.6,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.4,
    });

    lenis.on("scroll", ScrollTrigger.update);

    // Keep the exact reference that was added: removing `lenis.raf` instead
    // leaves this wrapper on the ticker forever, calling into a destroyed
    // Lenis after navigating away (e.g. to /club or /manage).
    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      // Unhook before destroying, so no frame can land on a dead instance.
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
}
