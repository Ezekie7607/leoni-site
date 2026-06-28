import { gsap } from "gsap";
import { isCoarsePointer, prefersReducedMotion } from "./motion.js";

// Custom dot+ring cursor with a lagging ring, plus magnetic pull on
// [data-magnetic] elements. No-op on touch / reduced motion.
export function initCursor() {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const cursor = document.querySelector("[data-cursor]");
  const dot = document.querySelector("[data-cursor-dot]");
  const ring = document.querySelector("[data-cursor-ring]");
  if (!cursor || !dot || !ring) return;

  const dotX = gsap.quickTo(dot, "x", { duration: 0.15, ease: "power3" });
  const dotY = gsap.quickTo(dot, "y", { duration: 0.15, ease: "power3" });
  const ringX = gsap.quickTo(ring, "x", { duration: 0.5, ease: "power3" });
  const ringY = gsap.quickTo(ring, "y", { duration: 0.5, ease: "power3" });

  window.addEventListener("pointermove", (e) => {
    dotX(e.clientX);
    dotY(e.clientY);
    ringX(e.clientX);
    ringY(e.clientY);
  });

  // Magnetic elements
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    const strength = 0.35;
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });

    el.addEventListener("pointerenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - (r.left + r.width / 2);
      const my = e.clientY - (r.top + r.height / 2);
      xTo(mx * strength);
      yTo(my * strength);
    });
    el.addEventListener("pointerleave", () => {
      cursor.classList.remove("is-hover");
      xTo(0);
      yTo(0);
    });
  });

  // Project tiles: expand the ring into a "Vedi" label.
  const label = document.querySelector("[data-cursor-label]");
  document.querySelectorAll("[data-cursor-view]").forEach((el) => {
    el.addEventListener("pointerenter", () => {
      if (label) label.textContent = el.dataset.cursorView || "Vedi";
      cursor.classList.add("is-view");
    });
    el.addEventListener("pointerleave", () => cursor.classList.remove("is-view"));
  });
}
