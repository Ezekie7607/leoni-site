# Round 2 — A11y & UX Audit (new animation features)

Scope: velocity skew, hero parallax, WebGL gallery distortion, cursor "Vedi", canvas aria hygiene, keyboard/touch fallbacks, contrast.
Prior round items (focus-visible, skip-link, preloader inert, reduced-motion gating on reveals) are confirmed still in place and are not re-reported.

---

## CRITICAL

None found.

---

## HIGH

### H1 — "Vedi" cursor label implies clickability on non-interactive tiles

**File:** `index.html` lines 143-203 / `src/lib/cursor.js` lines 48-55 / `src/styles/sections.css` lines 94-106

**Problem:** All four `<article class="work">` elements carry `data-cursor-view`, which causes the custom cursor to expand into an 88 px ring displaying the label "Vedi" on hover. "Vedi" is Italian for "View" or "See" — it is a call to action that communicates "you can open this." The tiles are plain `<article>` elements with no `<a>`, no `href`, no `role="link"`, no `tabindex`. Clicking does nothing.

This is a broken affordance: a fine-pointer user sees a large interactive-looking cursor state and clicks, receiving no feedback. This fails WCAG 3.3.2 (Labels or Instructions) in spirit and is a direct UX regression regardless of WCAG conformance level.

The showroom screenshot confirms the "Vedi" ring is visually prominent.

**Fix options (choose one):**

Option A (preferred — minimum code, honest): Remove `data-cursor-view` from all `.work` articles until the tiles link somewhere.

```html
<!-- Before -->
<article class="work" data-reveal data-cursor-view>

<!-- After -->
<article class="work" data-reveal>
```

Option B: Wrap each `<article>` in an `<a>` pointing to a case study URL or anchor, then keep `data-cursor-view`.

```html
<a href="/lavori/roma-lift" class="work" data-reveal data-cursor-view>
  <!-- content unchanged -->
</a>
```

Option C: Change the label from "Vedi" to a neutral descriptor ("Progetto", "01") so it reads as identification rather than navigation. Still weaker than removing it.

---

### H2 — Reduced-motion: hero canvas renders but gl-canvas still fades in (`.is-ready` added)

**File:** `src/webgl/scene.js` lines 246-260

**Problem:** Under `prefers-reduced-motion`, `renderStatic()` is called. It renders one hero backdrop frame and then calls `canvas.classList.add("is-ready")`. The `.is-ready` class triggers the CSS transition:

```css
/* base.css line 135 */
.gl-canvas {
  opacity: 0;
  transition: opacity 1.2s var(--ease-out-expo);
}
.gl-canvas.is-ready {
  opacity: 1;
}
```

So even in reduced-motion mode the canvas fades in over 1.2 seconds — a transition that `prefers-reduced-motion: reduce` should eliminate. The `base.css` reduced-motion block (lines 169-188) resets `*` scroll-behavior and hides the cursor, but it does not zero out the `.gl-canvas` transition.

**Fix:** Add to the `@media (prefers-reduced-motion: reduce)` block in `base.css`:

```css
@media (prefers-reduced-motion: reduce) {
  /* ... existing rules ... */
  .gl-canvas {
    transition: none;
  }
}
```

Note: the current block already contains `.hero-canvas { transition: none; }` (line 175) — that targets a class that no longer exists in the markup (the canvas uses `.gl-canvas`). That rule is therefore dead and should be renamed to `.gl-canvas`.

---

## MEDIUM

### M1 — Texture bakes project name into canvas; redundant for sighted, invisible to AT

**File:** `src/webgl/gallery.js` lines 155-162

The `buildTexture` function draws the project name ("Roma Lift", "FOR.", etc.) in white text directly onto the canvas texture. The DOM `work__meta` below each tile already shows the same name and tag as readable text. For sighted users the canvas name is visually redundant (it appears behind a distortion shader). For screen readers the canvas is `aria-hidden="true"` so the texture text is correctly invisible to AT.

No a11y regression here — the DOM text is the accessible source of truth — but worth documenting:

- If the canvas ever becomes the primary visual vehicle for the name (e.g., tile collapses to canvas only), the DOM meta must remain visible or the canvas must supply an alternative.
- Current state: `.webgl .work__meta` has no display:none rule, so name and tag remain in the DOM under WebGL mode. This is correct.

Action: no code change required, but add a comment near the `.webgl` CSS block noting that `work__meta` must not be hidden, as a guard against future regressions.

---

### M2 — `.webgl .work__index` hides the DOM number but leaves a gap in fallback UX

**File:** `src/styles/base.css` lines 150-155

```css
.webgl .work__index {
  display: none;
}
```

When WebGL is active the large watermark number is hidden from the DOM (already rendered on the texture). This is correct — it avoids double rendering. However the `work__index` spans are already `aria-hidden="true"` in the HTML, so they carry zero a11y weight regardless. No AT regression.

The medium concern: if a user loads the page with WebGL supported, then experiences a context loss (`webglcontextlost` event), `scene.js` removes `.is-ready` from the canvas but does NOT remove the `.webgl` class from `<html>`. This means the CSS gradient background is still `transparent` and the DOM index numbers are still `display:none`, leaving the tiles visually blank until context is restored.

**Fix:** In `scene.js` `onContextLost`, also remove `.webgl`:

```js
function onContextLost(e) {
  e.preventDefault();
  cancelAnimationFrame(raf);
  running = false;
  canvas.classList.remove("is-ready");
  document.documentElement.classList.remove("webgl"); // ADD THIS
}
```

And restore it in `onContextRestored` before restarting the loop (already done implicitly when `start()` is called again — but `onContextRestored` does not call `start()`, it calls `raf = requestAnimationFrame(loop)` directly, bypassing the `.webgl` re-add). Either call `start()` from `onContextRestored`, or re-add the class manually there.

---

### M3 — `prefersReducedMotion` is read once at module evaluation time; live changes ignored

**File:** `src/lib/motion.js` lines 1-4

```js
const query = window.matchMedia("(prefers-reduced-motion: reduce)");
export const prefersReducedMotion = () => query.matches;
```

This is a function, not a cached value, so individual calls reflect the current state. However none of the callers add a `change` event listener on `query`. If a user toggles the OS reduce-motion setting mid-session (possible on macOS), the running RAF loop, velocity skew, and hero parallax will continue firing because they checked the preference at init time and early-returned.

This is a MEDIUM rather than HIGH because mid-session toggles are uncommon, and WCAG 2.3.3 (Animation from Interactions) is AAA. It is still best practice to listen and tear down.

**Fix:** In `main.js`, after setup, add:

```js
query.addEventListener('change', () => {
  if (query.matches) {
    if (gl) gl.destroy();
    if (scroll) scroll.destroy(); // or just pause Lenis
  }
});
```

(Exact `query` reference would need to be exported from `motion.js` or re-queried in `main.js`.)

---

### M4 — Gallery hover events wired on coarse-pointer touch devices despite no visual feedback

**File:** `src/webgl/gallery.js` lines 253-259

The gallery's `_build()` method attaches `pointerenter`, `pointerleave`, and `pointermove` listeners on every article unconditionally. On a coarse-pointer device the WebGL gallery still runs (the scene only skips on coarse + `innerWidth < 500`, so tablets get the full loop). Touch/pointer events will fire uHover GSAP tweens, adding GPU work with no visual payoff because the hover distortion is only meaningful for fine-pointer gestures.

**Fix:** Gate the hover event wiring:

```js
import { isCoarsePointer } from '../lib/motion.js';

// In _build(), inside the figures.forEach:
if (!isCoarsePointer()) {
  article.addEventListener("pointerenter", onEnter);
  article.addEventListener("pointerleave", onLeave);
  article.addEventListener("pointermove",  onMove);
  plane._onEnter = onEnter;
  plane._onLeave = onLeave;
  plane._onMove  = onMove;
}
```

Also update `destroy()` to guard the removeEventListener calls similarly (or check `plane._onEnter` exists before removing).

---

### M5 — Dead CSS rule targets `.hero-canvas` (class does not exist in markup)

**File:** `src/styles/base.css` line 175

```css
@media (prefers-reduced-motion: reduce) {
  .hero-canvas {
    transition: none;
  }
}
```

The canvas element has class `.gl-canvas`, not `.hero-canvas`. This rule has zero effect. Combined with H2 above, the fix is to rename the selector to `.gl-canvas`.

---

## LOW

### L1 — `<article>` is the right element for work tiles, but no accessible name on the article itself

**File:** `index.html` lines 143-203

Each tile is `<article class="work">`. An `<article>` should have an accessible name when it represents a self-contained content item in a feed. The `work__name` `<h3>` inside gives it an implicit accessible name via heading, which is sufficient in most AT. However, adding `aria-labelledby="work-name-01"` (or similar) on each article would make the relationship explicit and help in article landmark navigation.

Low priority because the heading inside is standard practice and widely supported.

---

### L2 — `work__tag` text alignment on mobile

**File:** `src/styles/sections.css` line 347

```css
.work__tag {
  text-align: right;
}
```

At 320 px wide with a 1-column grid, the name and tag sit in a flex row. Long tag strings ("E-commerce · POD brand") may wrap awkwardly or clip. Not a WCAG failure but worth testing at 320 px.

---

### L3 — Scroll parallax on `.section__index` labels: no `will-change` cleanup

**File:** `src/animations/scrollfx.js` lines 123-142

`will-change: transform` is set implicitly by GSAP on scroll-triggered elements but is never explicitly removed after the animation completes. For scroll-scrubbed elements this persists for the page lifetime. Low memory concern on a single-page portfolio, but documented for completeness.

---

### L4 — No `<title>` update or `aria-live` region for "page loads" triggered by hash navigation

**File:** `index.html` lines 59-63

The single-page site uses anchor links (`#chi-sono`, `#showroom`, etc.). These do not update `document.title` or announce section changes to screen readers. This is expected behavior for anchor navigation, but a `role="status"` or skip-link focus announcement would improve orientation for AT users jumping sections.

---

## Summary table

| ID | Severity | File | Issue |
|----|----------|------|-------|
| H1 | HIGH | index.html / cursor.js | "Vedi" affordance on non-clickable tiles |
| H2 | HIGH | scene.js / base.css | gl-canvas fade-in transition fires under reduced-motion; dead `.hero-canvas` rule |
| M1 | MEDIUM | gallery.js | Texture name redundant but correctly aria-hidden; guard comment recommended |
| M2 | MEDIUM | scene.js | `.webgl` class not removed on context loss; tiles go visually blank |
| M3 | MEDIUM | motion.js / main.js | No live listener for mid-session prefers-reduced-motion change |
| M4 | MEDIUM | gallery.js | Hover event listeners wired on coarse-pointer devices, unnecessary GPU work |
| M5 | MEDIUM | base.css | Dead `.hero-canvas` CSS rule, should be `.gl-canvas` |
| L1 | LOW | index.html | No explicit `aria-labelledby` on `<article>` work tiles |
| L2 | LOW | sections.css | `work__tag` right-align may clip at 320 px |
| L3 | LOW | scrollfx.js | `will-change` not cleaned up after scroll parallax completes |
| L4 | LOW | index.html | No section-change announcement for anchor navigation |

---

## Confirmations (pass)

- `canvas[data-gl-canvas]` has `aria-hidden="true"` — correct, canvas is decorative.
- `pointer-events: none` is set on `.gl-canvas` — canvas never traps interaction.
- `cursor[data-cursor]` has `aria-hidden="true"` — correct.
- `prefersReducedMotion()` guard in `initScrollFX` early-returns correctly — velocity skew, hero parallax, and section-index parallax are all gated.
- `prefersReducedMotion()` guard in `initCursor` early-returns — cursor + magnetic disabled under reduced motion.
- `prefersReducedMotion()` guard in `scene.start()` — no `.webgl` class added, no RAF loop, gallery distortion never runs; static one-frame render only.
- `isCoarsePointer()` guard in `initCursor` — cursor completely skipped on touch.
- `isCoarsePointer()` guard on hero mouse parallax (`_setupHeroParallax`) — skipped on touch.
- `isCoarsePointer() && innerWidth < 500` guard in `initWebGL` — WebGL skipped on narrow touch viewports.
- `.webgl .work__meta` has no display rule — name and tag remain DOM-accessible when WebGL is active.
- `work__index` spans are `aria-hidden="true"` — correct, they are purely decorative.
- `.js [data-reveal]` correctly scoped — content visible without JS.
- Hero text remains visible without JS: no opacity gating or animation-class dependency at parse time.
- `@media (prefers-reduced-motion: reduce)` block forces `opacity: 1 !important; transform: none !important` on reveal and split elements — confirmed.
- Custom cursor `display: none` under `(hover: none), (pointer: coarse)` in both `base.css` and `sections.css`.
