# Round 1 — GSAP Animation Modules

## Files

- `src/animations/reveals.js` — rebuilt (replaces prior skeleton)
- `src/animations/scrollfx.js` — new

## main.js wiring

`main.js` already imports `initReveals` and calls it. Add `initScrollFX` in the same `runPreloader().then()` block, passing the lenis instance returned by `initSmoothScroll()`:

```js
import { initReveals } from "./animations/reveals.js";
import { initScrollFX } from "./animations/scrollfx.js";

runPreloader()
  .catch(() => {})
  .then(() => {
    scroll = initSmoothScroll();   // returns { lenis, destroy }
    initCursor();
    initReveals();
    initScrollFX(scroll.lenis);   // lenis is null under reduced-motion — handled
    if (hero) hero.start();
  });
```

Order matters: `initSmoothScroll` must run before `initScrollFX` so `scroll.lenis` exists. `initReveals` and `initScrollFX` are independent of each other.

## Effects implemented

### reveals.js

| Hook | Effect | Config |
|---|---|---|
| `[data-split]` | SplitText lines, `yPercent` 110→0, mask-up | duration 1s, expo.out, stagger 0.08, once, start "top 88%" |
| `[data-reveal]` | fade + rise (`y` 28→0, opacity 0→1) | duration 0.9s, power3.out, once, start "top 90%" |
| `[data-reveal-now]` | immediate nav entrance (`gsap.from`) | duration 0.8s, power2.out, clearProps on finish |

Mask clip: `overflow: hidden` applied inline to each `[data-split]` element before splitting. Hero `.line` spans already had it in CSS; about/contact spans get it from JS. `SplitText` is constructed only after `document.fonts.ready`.

Resize: debounced 200ms handler re-splits all elements, sets `yPercent: 0` on already-revealed lines (tracked via `item.revealed` flag), calls `ScrollTrigger.refresh()`.

### scrollfx.js

| Hook | Effect | Notes |
|---|---|---|
| `[data-skew]` | `skewY` from Lenis velocity | `gsap.quickTo`, duration 0.6s, power2.out, clamp ±6deg, factor 0.008 deg/unit |
| `[data-hero-parallax]` | Mouse: `x`/`y` ±12px via `quickTo` | Fine pointer only (`isCoarsePointer()` guard) |
| `[data-hero-parallax]` | Scroll: `yPercent` 0→-8 scrubbed | ScrollTrigger scrub, hero section as trigger; separate property from mouse `y` so GSAP composes both |
| `.section__index` | Subtle `y` 0→-24px upward float | scrub 0.5, start "top bottom" → "bottom top" |

Velocity skew uses `lenis.on('scroll', ({ velocity }) => ...)` — no scroll handler churn, one listener total.

## Selector verification

All selectors confirmed present in `index.html`:
- `[data-split]`: 7 elements (hero h1 spans, about__lead spans, showroom h2, contact__title spans)
- `[data-reveal]`: 9 elements (eyebrow, meta p, hero__scroll, section__index labels, about body p×2, service li×3, work article×4)
- `[data-reveal-now]`: 1 element (`header.nav`)
- `[data-skew]`: 2 elements (`about__lead h2`, `contact__title h2`)
- `[data-hero-parallax]`: 1 element (`hero h1#hero-title`)
- `.section__index`: 4 elements

## Performance notes

- All animated properties: `transform` (translate, skewY, yPercent), `opacity`. No layout properties touched.
- `will-change: transform, opacity` already applied via `.js [data-reveal]` and `.js [data-split] .split-line` in `base.css`.
- `gsap.quickTo` pre-warms setters — no per-frame object allocation for skew and mouse parallax.
- Section index parallax uses `scrub: 0.5` (not `true`) to add slight smoothing without decoupling from scroll.
- Hero scroll parallax uses `scrub: true` (instant sync) since it compounds with the mouse quickTo already adding smoothness.

## Reduced-motion handling

- `reveals.js`: early-return at top of `initReveals()` if `prefersReducedMotion()`.
- `scrollfx.js`: early-return at top of `initScrollFX()` if `prefersReducedMotion() || !lenis`.
- `lenis` is `null` when reduced-motion is active (returned by `initSmoothScroll()`), so passing `scroll.lenis` safely triggers the null guard even without the explicit `prefersReducedMotion()` check.
- `base.css` `@media (prefers-reduced-motion: reduce)` block forces `opacity: 1 !important` and `transform: none !important` on all hidden elements — content is never gated behind JS.

## Build

STATUS: PASS — `vite build` clean, 40 modules, no warnings. Bundle 192.58 kB / 68.41 kB gzip.
