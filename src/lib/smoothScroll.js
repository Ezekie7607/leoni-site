import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "./motion.js";

gsap.registerPlugin(ScrollTrigger);

// Wire Lenis inertia scroll into the GSAP ticker so ScrollTrigger stays in sync.
// Returns { lenis, destroy } — or a no-op controller when reduced motion is set.
export function initSmoothScroll() {
  if (prefersReducedMotion()) {
    return { lenis: null, destroy() {} };
  }

  const lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    wheelMultiplier: 1,
  });

  lenis.on("scroll", ScrollTrigger.update);

  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  // Offset anchor jumps by the fixed nav height.
  const nav = document.querySelector(".nav");
  const navOffset = nav ? nav.offsetHeight + 8 : 0;

  const onClick = (e) => {
    const link = e.currentTarget;
    const id = link.getAttribute("href");
    if (!id || id === "#" || id.length < 2) return;
    let target;
    try {
      target = document.querySelector(id);
    } catch {
      return; // invalid selector (e.g. id starting with a digit)
    }
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -navOffset });
  };

  const anchors = document.querySelectorAll('a[href^="#"]');
  anchors.forEach((link) => link.addEventListener("click", onClick));

  function destroy() {
    gsap.ticker.remove(tick);
    anchors.forEach((link) => link.removeEventListener("click", onClick));
    lenis.destroy();
  }

  return { lenis, destroy };
}
