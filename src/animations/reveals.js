import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "../lib/motion.js";

gsap.registerPlugin(ScrollTrigger, SplitText);

// Reveal system.
//
// [data-split]     — headline lines mask up (SplitText by lines, yPercent 110→0).
//                    Parent element gets overflow:hidden so the mask actually clips.
//                    Built after document.fonts.ready for correct line boxes.
//                    Debounced resize re-splits and keeps already-revealed lines visible.
//
// [data-reveal]    — generic blocks: y+opacity rise, power3.out, once, start "top 90%".
//
// [data-reveal-now]— nav: animates in immediately on load (no scroll trigger).
//
// Reduced motion: base.css already forces everything visible via !important.
// We early-return and never hide or animate anything.

export function initReveals() {
  if (prefersReducedMotion()) return;

  // Build after webfonts settle so line boxes are measured correctly.
  // document.fonts.ready is a Promise; fall through synchronously on browsers
  // that don't support it (very old Safari).
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(setup);
  } else {
    setup();
  }
}

function setup() {
  _setupSplits();
  _setupRevealBlocks();
  _setupRevealNow();
  ScrollTrigger.refresh();
}

// ---------------------------------------------------------------------------
// [data-split] — mask-up per line
// ---------------------------------------------------------------------------

function _setupSplits() {
  const splitEls = gsap.utils.toArray("[data-split]");
  if (!splitEls.length) return;

  // Track per-element state so the resize handler knows whether to animate.
  // revealed = true means the ST already fired; re-split keeps lines at y:0.
  const items = splitEls.map((el) => {
    // Ensure the element itself clips so yPercent:110 visually masks.
    // CSS already sets overflow:hidden on .hero__title .line spans, but
    // for other contexts (about__lead span, contact__title span) we add it here.
    el.style.overflow = "hidden";

    return { el, split: null, revealed: false };
  });

  const buildAll = () => {
    items.forEach((item) => _buildSplit(item));
  };

  buildAll();

  // Debounced resize: re-split all, preserve revealed state, refresh triggers.
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      items.forEach((item) => _buildSplit(item));
      ScrollTrigger.refresh();
    }, 200);
  });
}

function _buildSplit(item) {
  const { el } = item;

  // Revert previous split so the original DOM is restored before re-splitting.
  if (item.split) {
    item.split.revert();
    item.split = null;
  }

  // Split into lines; each gets class "split-line" (matched by CSS opacity:0).
  item.split = new SplitText(el, {
    type: "lines",
    linesClass: "split-line",
  });

  const lines = item.split.lines;

  if (item.revealed) {
    // Already animated: park lines at final position, visible.
    gsap.set(lines, { yPercent: 0, opacity: 1 });
    return;
  }

  // Set initial off-screen state (down 110% of line height = fully hidden).
  gsap.set(lines, { yPercent: 110 });

  ScrollTrigger.create({
    trigger: el,
    start: "top 88%",
    once: true,
    onEnter: () => {
      item.revealed = true;
      gsap.to(lines, {
        yPercent: 0,
        duration: 1,
        ease: "expo.out",
        stagger: 0.08,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// [data-reveal] — generic fade + rise, once
// ---------------------------------------------------------------------------

function _setupRevealBlocks() {
  const blocks = gsap.utils.toArray("[data-reveal]");
  if (!blocks.length) return;

  blocks.forEach((el) => {
    // base.css sets opacity:0 via .js [data-reveal]; we add the y offset here.
    gsap.set(el, { y: 28 });

    ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      once: true,
      onEnter: () =>
        gsap.to(el, {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
        }),
    });
  });
}

// ---------------------------------------------------------------------------
// [data-reveal-now] — immediate load-in (nav)
// ---------------------------------------------------------------------------

function _setupRevealNow() {
  const el = document.querySelector("[data-reveal-now]");
  if (!el) return;

  // Nav is not hidden by base.css (only [data-reveal] and [data-split] .split-line
  // are initially invisible), so we gsap.from to create the entrance.
  gsap.from(el, {
    y: -20,
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
    clearProps: "transform,opacity",
  });
}
