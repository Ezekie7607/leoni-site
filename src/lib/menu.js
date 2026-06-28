import { gsap } from "gsap";
import { prefersReducedMotion } from "./motion.js";

/**
 * Full-screen overlay menu + scroll-reactive header.
 *
 * The menu open/close is driven by a CSS class (clip-path reveal) so it works
 * even without JS motion; GSAP layers the staggered word reveal on top. The
 * header hides on scroll-down and returns on scroll-up.
 *
 * @param {{ lenis?: import('lenis').default | null }} [opts]
 * @returns {{ destroy: () => void }}
 */
export function initMenu({ lenis } = {}) {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-menu]");
  const nav = document.querySelector("[data-nav]");
  const toggleTxt = document.querySelector("[data-toggle-txt]");
  if (!toggle || !menu) return { destroy() {} };

  const words = menu.querySelectorAll(".menu__word");
  const reduce = prefersReducedMotion();
  let open = false;
  let tl = null;

  const setOpen = (next) => {
    if (next === open) return;
    open = next;
    toggle.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    menu.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    if (toggleTxt) toggleTxt.textContent = open ? "Chiudi" : "Menu";
    if (lenis) open ? lenis.stop() : lenis.start();

    if (reduce) {
      gsap.set(words, { yPercent: 0 });
      return;
    }
    if (tl) tl.kill();
    if (open) {
      tl = gsap
        .timeline()
        .set(words, { yPercent: 110 })
        .to(words, {
          yPercent: 0,
          duration: 0.7,
          ease: "expo.out",
          stagger: 0.07,
          delay: 0.12,
        });
    } else {
      tl = gsap.to(words, {
        yPercent: 110,
        duration: 0.4,
        ease: "power2.in",
        stagger: 0.03,
      });
    }
  };

  const onToggle = () => setOpen(!open);
  const onKey = (e) => {
    if (e.key === "Escape" && open) setOpen(false);
  };
  toggle.addEventListener("click", onToggle);
  document.addEventListener("keydown", onKey);

  // Close when a destination is chosen (smooth-scroll is already wired on
  // a[href^="#"] in smoothScroll.js, so we only need to dismiss the overlay).
  const links = menu.querySelectorAll("[data-menu-link]");
  const onLink = () => setOpen(false);
  links.forEach((l) => l.addEventListener("click", onLink));

  // --- Scroll-reactive header ---
  let lastY = 0;
  const onScroll = (cur) => {
    if (open) return;
    const goingDown = cur > lastY;
    nav?.classList.toggle("nav--hidden", cur > 90 && goingDown);
    nav?.classList.toggle("nav--scrolled", cur > 24);
    lastY = cur;
  };

  let detachScroll = () => {};
  if (lenis) {
    const handler = ({ scroll }) => onScroll(scroll);
    lenis.on("scroll", handler);
    detachScroll = () => lenis.off("scroll", handler);
  } else {
    const handler = () => onScroll(window.scrollY || 0);
    window.addEventListener("scroll", handler, { passive: true });
    detachScroll = () => window.removeEventListener("scroll", handler);
  }

  return {
    destroy() {
      toggle.removeEventListener("click", onToggle);
      document.removeEventListener("keydown", onKey);
      links.forEach((l) => l.removeEventListener("click", onLink));
      detachScroll();
      if (tl) tl.kill();
      if (lenis) lenis.start();
      document.body.classList.remove("menu-open");
    },
  };
}
