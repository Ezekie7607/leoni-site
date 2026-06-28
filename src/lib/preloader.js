import { gsap } from "gsap";
import { prefersReducedMotion } from "./motion.js";

// Animated counter + bar, then curtain-up reveal.
// Resolves once the intro is done so the page can start its entrance.
export function runPreloader() {
  const el = document.querySelector("[data-preloader]");
  const countEl = document.querySelector("[data-preloader-count]");
  const barEl = document.querySelector("[data-preloader-bar]");

  if (!el) return Promise.resolve();

  // Skip intro for reduced motion or the ?nointro dev flag.
  const skip = prefersReducedMotion() || new URLSearchParams(location.search).has("nointro");
  if (skip) {
    el.remove();
    return Promise.resolve();
  }

  // Keep AT and keyboard out of the page behind the curtain.
  const regions = document.querySelectorAll("header, main, footer");
  regions.forEach((r) => (r.inert = true));

  return new Promise((resolve) => {
    const state = { value: 0 };
    const tl = gsap.timeline({
      onComplete: () => {
        regions.forEach((r) => (r.inert = false));
        el.remove();
        resolve();
      },
    });

    tl.to(state, {
      value: 100,
      duration: 1.4,
      ease: "power2.inOut",
      onUpdate: () => {
        const v = Math.round(state.value);
        if (countEl) countEl.textContent = v;
        if (barEl) barEl.style.transform = `scaleX(${state.value / 100})`;
      },
    })
      .to(el, {
        yPercent: -100,
        duration: 0.9,
        ease: "expo.inOut",
      })
      .set(el, { pointerEvents: "none" });
  });
}
