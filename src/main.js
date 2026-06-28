import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/sections.css";

import { initSmoothScroll } from "./lib/smoothScroll.js";
import { runPreloader } from "./lib/preloader.js";
import { initCursor } from "./lib/cursor.js";
import { initReveals } from "./animations/reveals.js";
import { initScrollFX } from "./animations/scrollfx.js";
import { initMarquee } from "./animations/marquee.js";
import { initMenu } from "./lib/menu.js";
import { initWebGL } from "./webgl/scene.js";
import { mountIslands } from "./react/islands.js";

// WebGL must never take the page down: if the context can't be created
// (Low Power Mode, old Safari, blocked WebGL) we degrade to the static page.
let gl = null;
try {
  gl = initWebGL();
} catch (err) {
  console.warn("WebGL disabled:", err);
}

let scroll = null;
let islands = null;
let menu = null;
let marquee = null;

// Set the reveal initial states early (while the preloader still covers the page)
// so headings don't flash visible-then-hidden when the curtain lifts.
initReveals();

// The intro must never permanently block content either.
runPreloader()
  .catch(() => {})
  .then(() => {
    scroll = initSmoothScroll();
    initCursor();
    initScrollFX(scroll.lenis);
    menu = initMenu({ lenis: scroll.lenis });
    marquee = initMarquee({ lenis: scroll.lenis });
    islands = mountIslands();
    if (gl) gl.start();
  });

// Clean up across Vite HMR cycles. Reveals/scrollfx/cursor register listeners and
// ScrollTriggers that aren't individually torn down, so a full reload on hot-update
// is the clean, leak-free choice in dev (no effect on production).
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (gl) gl.destroy();
    if (scroll) scroll.destroy();
    if (islands) islands.destroy();
    if (menu) menu.destroy();
    if (marquee) marquee.destroy();
  });
  import.meta.hot.accept(() => window.location.reload());
}
