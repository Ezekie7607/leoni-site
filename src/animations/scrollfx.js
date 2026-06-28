import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion, isCoarsePointer } from "../lib/motion.js";

// scrollfx.js — scroll-driven compositor-only effects.
//
// Effects:
//  1. Velocity skew  — [data-skew] elements skewY with Lenis scroll velocity.
//                      gsap.quickTo for smooth ease-back to 0.
//  2. Hero parallax  — [data-hero-parallax] responds to mouse (fine pointer only)
//                      and rises on scroll. Disabled on coarse pointer.
//  3. Section index  — subtle upward parallax on .section__index labels (cheap,
//                      compositor-only translateY via ScrollTrigger scrub).
//
// All effects animate only transform/opacity — no layout properties.
// Early-return entirely when prefers-reduced-motion or lenis is null.

export function initScrollFX(lenis) {
  if (prefersReducedMotion() || !lenis) return;

  _setupVelocitySkew(lenis);
  _setupHeroParallax(lenis);
  _setupSectionIndexParallax();
}

// ---------------------------------------------------------------------------
// 1. Velocity skew — [data-skew]
// ---------------------------------------------------------------------------
// Maps Lenis scroll velocity to a small skewY applied via gsap.quickTo.
// quickTo creates a pre-warmed setter with its own ease, so each frame the
// value chases the target with "power2.out" — giving the organic snap-back.
// Ref: https://gsap.com/docs/v3/GSAP/gsap.quickTo()

function _setupVelocitySkew(lenis) {
  const skewEls = gsap.utils.toArray("[data-skew]");
  if (!skewEls.length) return;

  // Build one quickTo setter per element.
  const setSkew = skewEls.map((el) =>
    gsap.quickTo(el, "skewY", { duration: 0.6, ease: "power2.out" })
  );

  // Velocity → skewY mapping constants.
  // Lenis velocity is in px/frame (roughly). Clamp so fast flicks don't
  // over-rotate; +/-6 deg is the ceiling — subtle, never nauseating.
  const VELOCITY_FACTOR = 0.008; // deg per px/frame unit
  const MAX_DEG = 6;

  lenis.on("scroll", ({ velocity }) => {
    const deg = gsap.utils.clamp(-MAX_DEG, MAX_DEG, velocity * VELOCITY_FACTOR);
    setSkew.forEach((setter) => setter(deg));
  });
}

// ---------------------------------------------------------------------------
// 2. Hero parallax — [data-hero-parallax]
// ---------------------------------------------------------------------------
// Two sub-effects on the hero h1:
//   a. Mouse parallax: element follows cursor ±MOUSE_RANGE px on x/y.
//      Uses gsap.quickTo for butter-smooth lag (duration 0.5s, power3.out).
//   b. Scroll parallax: element rises slightly as user scrolls away from hero.
//      Implemented via ScrollTrigger scrub so it stays in sync with Lenis.
//      Only a few px — subtle depth cue, not a full parallax band.
// Both disabled entirely on coarse pointer (touch / mobile).

function _setupHeroParallax(lenis) {
  if (isCoarsePointer()) return;

  const el = document.querySelector("[data-hero-parallax]");
  if (!el) return;

  // --- a. Mouse parallax ---
  const MOUSE_RANGE = 12; // max px offset in either axis

  const quickX = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
  const quickY = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });

  const onMouseMove = (e) => {
    // Normalize pointer position to [-1, 1] relative to viewport centre.
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    quickX(nx * MOUSE_RANGE);
    quickY(ny * MOUSE_RANGE);
  };

  window.addEventListener("mousemove", onMouseMove, { passive: true });

  // --- b. Scroll parallax ---
  // The hero section fills the first viewport. As the user scrolls down,
  // we move the h1 upward by SCROLL_OFFSET px (slower than scroll = parallax).
  // scrub:true ties the animation directly to scroll position.
  const SCROLL_OFFSET = 60; // px upward travel over the hero's scroll distance

  const heroSection = el.closest("section") || document.querySelector(".hero");

  ScrollTrigger.create({
    trigger: heroSection || el,
    start: "top top",
    end: "bottom top",
    scrub: true,
    // We animate a separate CSS var via gsap set to avoid colliding with
    // the mouse quickTo values on the same `y` property. Instead, use a
    // second transform layer via a wrapper — but since we only have the h1,
    // we compose by animating a data attribute and using a GSAP ticker, OR
    // we use two separate gsap properties. The cleanest approach without
    // a wrapper element: use `yPercent` for scroll (different property
    // from `y` which mouse uses). GSAP composes both into one transform matrix.
    animation: gsap.fromTo(
      el,
      { yPercent: 0 },
      { yPercent: -8, ease: "none" }
    ),
  });
}

// ---------------------------------------------------------------------------
// 3. Section index subtle parallax — .section__index
// ---------------------------------------------------------------------------
// Cheap scrubbed translateY on the small "01 — Chi sono" labels.
// Moves them upward slightly faster than the section so they feel floaty.
// Compositor-only (transform). Each label gets its own ScrollTrigger.

function _setupSectionIndexParallax() {
  const labels = gsap.utils.toArray(".section__index");
  if (!labels.length) return;

  labels.forEach((el) => {
    gsap.fromTo(
      el,
      { y: 0 },
      {
        y: -24,
        ease: "none",
        scrollTrigger: {
          trigger: el.closest("section") || el,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.5,
        },
      }
    );
  });
}
