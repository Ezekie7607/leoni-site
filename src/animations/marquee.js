import { gsap } from "gsap";
import { prefersReducedMotion } from "../lib/motion.js";

/**
 * Seamless infinite marquee strips.
 *
 * Each [data-marquee-track] has its content duplicated so an xPercent 0 -> -50
 * loop repeats with no visible seam. Lenis scroll velocity boosts the speed.
 * Compositor-only (transform). No-op under prefers-reduced-motion.
 *
 * @param {{ lenis?: import('lenis').default | null }} [opts]
 * @returns {{ destroy: () => void }}
 */
export function initMarquee({ lenis } = {}) {
  if (prefersReducedMotion()) return { destroy() {} };

  const tracks = gsap.utils.toArray("[data-marquee-track]");
  if (!tracks.length) return { destroy() {} };

  const tweens = tracks.map((track, i) => {
    // Duplicate the content once (clone nodes, no innerHTML) for a seamless
    // -50% loop.
    Array.from(track.children).forEach((node) =>
      track.appendChild(node.cloneNode(true))
    );

    const dir = track.dataset.marqueeDir === "right" ? 1 : -1;
    const speed = Number(track.dataset.marqueeSpeed) || 26; // seconds per loop

    return gsap.fromTo(
      track,
      { xPercent: dir === -1 ? 0 : -50 },
      {
        xPercent: dir === -1 ? -50 : 0,
        duration: speed,
        ease: "none",
        repeat: -1,
      }
    );
  });

  let detach = () => {};
  if (lenis) {
    const handler = ({ velocity }) => {
      const boost = gsap.utils.clamp(0, 4, Math.abs(velocity) * 0.05);
      tweens.forEach((tw) => tw.timeScale(1 + boost));
    };
    lenis.on("scroll", handler);
    detach = () => lenis.off("scroll", handler);
  }

  return {
    destroy() {
      detach();
      tweens.forEach((tw) => tw.kill());
    },
  };
}
