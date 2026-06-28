# leoni-site — Round 1 Code Review

Reviewer: typescript-reviewer agent
Date: 2026-06-28
Stack: Vite vanilla ES modules, GSAP 3.15, Lenis 1.3.25, OGL 1.0.11

---

## CRITICAL

### C-1 — WebGL context creation crash takes down the whole page
**File:** `src/webgl/hero.js:74-80`  
**File:** `src/main.js:12`

`new Renderer(...)` can throw synchronously when WebGL is unavailable (blocked by OS policy, old Safari Private Mode, low-power GPU cutoff). The throw propagates up through `initHero()` into `main.js`, which has no try/catch around it. The result: the `runPreloader()` call on line 14 is never reached, the preloader promise never runs, and the page hangs on the preloader screen indefinitely with a JavaScript error in console — the rest of the site (text, nav, reveals) never initialises.

**Fix:** wrap `initHero()` in a try/catch:

```js
// main.js
let hero = null;
try {
  hero = initHero();
} catch (e) {
  console.warn('[hero] WebGL unavailable, skipping canvas', e);
}
```

Or guard inside `initHero()` itself and make it return `null` on failure rather than throwing.

---

## HIGH

### H-1 — gsap.ticker callback leaks on every `initSmoothScroll()` call
**File:** `src/lib/smoothScroll.js:25-27`

```js
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
```

`gsap.ticker.add` registers a new callback each time `initSmoothScroll()` is called. On a single-page site this is called exactly once, so it is not a practical problem today. However, `destroy()` is never returned from `initSmoothScroll()`, so there is no way to clean it up. If hot-module replacement (Vite HMR) triggers a module re-evaluation during development, or if any future routing adds a second call, stale Lenis instances will continue to advance via the ticker forever, causing scroll jitter.

**Fix:** capture the ticker function reference and expose a cleanup:

```js
const tick = (time) => lenis.raf(time * 1000);
gsap.ticker.add(tick);
// return { lenis, destroy: () => { gsap.ticker.remove(tick); lenis.destroy(); } }
```

### H-2 — SplitText lines not re-split on viewport resize
**File:** `src/animations/reveals.js:17-36`

`SplitText` splits each `[data-split]` element into lines exactly once at init time. Line breaks are computed from the element's rendered width at that moment. On viewport resize (especially orientation change on tablet/phone) the text reflows into different lines, but the `split.lines` array still references the old DOM nodes with the old `yPercent: 110` initial state. The clipping parents also retain their original dimensions. The result is broken line-mask animations: lines may overflow their clip containers or animate from wrong positions after resize.

**Fix:** add a ResizeObserver (or debounced `window.resize`) that calls `split.revert()`, re-splits, re-sets `yPercent: 110`, and re-creates ScrollTriggers. GSAP's `ScrollTrigger.refresh()` alone (called after font load) does not fix this because it only updates scroll positions, not DOM split points.

### H-3 — OGL RAF loop: `destroy()` is never called — resize listener accumulates across HMR
**File:** `src/webgl/hero.js:103, 135-139`  
**File:** `src/main.js:12-18`

`main.js` receives `{ start, destroy }` from `initHero()` but only calls `start()`. `destroy()` is never called anywhere. On a production single-page site with no navigation this does not cause a real memory leak (the page is unloaded with the tab). However during Vite HMR each module reload calls `initHero()` again, adding a new `resize` listener and a new `pointermove` listener on `window` without removing the previous ones. After 10 reloads, 10 independent resize handlers each call `renderer.setSize()` on now-orphaned (but not GC'd) OGL contexts.

**Fix:** store the return value of `initHero()` at module scope in `main.js` and call `destroy()` in a `beforeunload` or Vite's `import.meta.hot.dispose` hook:

```js
// main.js (dev guard)
if (import.meta.hot) {
  import.meta.hot.dispose(() => hero?.destroy());
}
```

### H-4 — Anchor click handler: href="#" silently queries `document.querySelector("#")` which throws
**File:** `src/lib/smoothScroll.js:31-39`

```js
const id = link.getAttribute("href");    // "#"
if (id.length < 2) return;               // skips correctly: "#".length === 1
```

The guard `id.length < 2` correctly bails on bare `"#"` (length 1). This is fine. However the guard does NOT protect against `href="#section"` where `document.querySelector("#section")` returns `null`. If `target` is `null`, the `if (!target) return` guard on line 36 handles that correctly too.

The real bug is subtler: `document.querySelector(id)` where `id` is a valid CSS selector string like `"#foo--bar"` works fine, but if the `id` attribute of the target element contains characters that are valid in HTML IDs but invalid in CSS selectors (e.g. `id="2col"` — leading digit), `querySelector` throws a `SyntaxError` rather than returning `null`, and the unhandled exception bubbles up. This is a low-probability but real breakage.

**Fix:**

```js
let target;
try {
  target = document.querySelector(id);
} catch {
  return;
}
if (!target) return;
```

### H-5 — Preloader: missing null guard on `countEl`/`barEl` when `el` exists
**File:** `src/lib/preloader.js:8-9, 34-36`

`el` is checked on line 11 and the function returns early if absent. But if `[data-preloader]` exists while `[data-preloader-count]` or `[data-preloader-bar]` are missing (typo in HTML, partial template), the `onUpdate` callback on line 34-36 safely guards them with `if (countEl)` / `if (barEl)`. This part is fine.

The only genuine unresolved path concern: if `gsap.timeline()` itself throws (e.g. GSAP not loaded — unlikely but possible in a subresource failure scenario), the `Promise` constructor callback throws synchronously, rejecting the promise. `runPreloader()` in `main.js` is called with `.then()` but no `.catch()`. The rejection becomes an unhandled promise rejection and `initSmoothScroll`, `initCursor`, `initReveals` never run.

**Fix:**

```js
// main.js
runPreloader()
  .then(() => { /* init */ })
  .catch((err) => {
    console.error('[preloader] failed, recovering', err);
    initSmoothScroll();
    initCursor();
    initReveals();
    if (hero) hero.start();
  });
```

---

## MEDIUM

### M-1 — DPR applied at init, never updated on resize
**File:** `src/webgl/hero.js:73-76, 96-101`

`dprCap` and `renderer.dpr` are fixed at construction time using `window.devicePixelRatio`. The `resize()` function calls `renderer.setSize(w, h)` but does not re-read `devicePixelRatio`. On systems where DPR can change at runtime (moving a Chrome window between a Retina and a non-Retina display, or Chrome's zoom level change), the canvas will render at the wrong resolution until page reload.

**Fix:** inside `resize()`:

```js
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.dpr = dpr;
  renderer.setSize(window.innerWidth, window.innerHeight);
  program.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
}
```

### M-2 — Mouse easing in RAF loop uses frame-rate-dependent lerp
**File:** `src/webgl/hero.js:116-118`

```js
m.x += (target.x - m.x) * 0.05;
m.y += (target.y - m.y) * 0.05;
```

At 144 Hz the mouse trails more slowly than at 60 Hz (factor-of-2.4 difference). The easing speed is monitor-dependent.

**Fix:** use a delta-time corrected lerp:

```js
// loop(t) already receives timestamp in ms; track previous t
const alpha = 1 - Math.pow(0.05, dt * 0.001 * 60); // normalise to 60fps
m.x += (target.x - m.x) * alpha;
m.y += (target.y - m.y) * alpha;
```

Or use GSAP's `gsap.quickTo` for the mouse value (consistent with the cursor module's approach).

### M-3 — OGL context loss not handled
**File:** `src/webgl/hero.js:69-142`

There is no `webglcontextlost` / `webglcontextrestored` event handler. On mobile, the browser can silently terminate GPU contexts under memory pressure. When this happens, `renderer.render()` either throws or draws nothing, and the RAF loop continues calling into a dead context each frame.

**Fix:** minimal guard:

```js
gl.canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  cancelAnimationFrame(raf);
  running = false;
});
gl.canvas.addEventListener('webglcontextrestored', () => {
  // Re-create program/geometry or simply restart
  start();
});
```

### M-4 — `ScrollTrigger.refresh()` called before Lenis is initialised
**File:** `src/lib/smoothScroll.js:13`

When `prefersReducedMotion()` is true, the function returns after `ScrollTrigger.refresh()` on line 13. But `ScrollTrigger` is registered and `refresh()` is called before `document.fonts.ready` resolves (fonts load asynchronously). This means scroll positions are computed before webfonts affect layout. For the reduced-motion path this matters slightly less (no smooth scroll), but `initReveals()` also calls `ScrollTrigger.refresh()` via `document.fonts.ready.then(...)`, so there will be two refresh calls racing.

**Fix:** remove the early `ScrollTrigger.refresh()` in `initSmoothScroll()` — the `document.fonts.ready` refresh in `initReveals()` is sufficient and better timed.

### M-5 — Lenis scroll event listener not removed on hypothetical destroy
**File:** `src/lib/smoothScroll.js:23`

```js
lenis.on("scroll", ScrollTrigger.update);
```

`initSmoothScroll()` returns only the `lenis` instance, not a destroy function. There is no way to call `lenis.off("scroll", ScrollTrigger.update)` or `lenis.destroy()` from the outside. Not a live issue for a single-page static site, but it blocks any future SPA routing cleanly. Document the limitation or return `{ lenis, destroy }`.

### M-6 — `motion.js` evaluates `window.matchMedia` at module parse time
**File:** `src/lib/motion.js:2`

```js
const query = window.matchMedia("(prefers-reduced-motion: reduce)");
```

This executes when the module is first imported. In SSR contexts (Vite SSR, Astro, etc.) or in a Web Worker, `window` is undefined and this throws immediately. Not a problem today for a pure client Vite SPA, but worth noting if the site is ever adapted for SSR/prerendering.

**Fix:** wrap in a lazy getter, or at minimum document the constraint.

---

## LOW

### L-1 — `loop(t)` updates `uTime` with raw RAF timestamp in seconds, not elapsed
**File:** `src/webgl/hero.js:114`

```js
program.uniforms.uTime.value = t * 0.001;
```

`requestAnimationFrame` passes the `DOMHighResTimeStamp` since page load (milliseconds), so `t * 0.001` gives seconds since page load. The shader uses `uTime * 0.06` which is fine visually. However, if the tab is backgrounded for a long time and then refocused, `t` jumps to a large value and `uTime` jumps discontinuously, causing a visible flash of a very different noise position. Use elapsed delta instead:

```js
let startT = null;
function loop(t) {
  if (!startT) startT = t;
  program.uniforms.uTime.value = (t - startT) * 0.001;
  // ...
}
```

### L-2 — Cursor `pointerleave` removes `is-hover` unconditionally
**File:** `src/lib/cursor.js:41-44`

```js
el.addEventListener("pointerleave", () => {
  cursor.classList.remove("is-hover");
  // ...
});
```

If there are multiple `[data-magnetic]` elements and the pointer moves rapidly from one directly to another, `pointerleave` fires on the first before `pointerenter` fires on the second. The `is-hover` class is removed for a single frame. Visually imperceptible in most cases but technically incorrect. Fixing it requires a counter or checking `relatedTarget`.

### L-3 — No `console` statements found; clean for production

All seven files are free of `console.log`. Only `console.warn`/`console.error` are recommended as per coding standards — currently there are none at all, which is fine. If C-1's fix is applied, use `console.warn` there.

---

## Summary Table

| ID | Severity | File | Issue |
|----|----------|------|-------|
| C-1 | CRITICAL | hero.js:74 / main.js:12 | WebGL Renderer throw uncaught, hangs preloader |
| H-1 | HIGH | smoothScroll.js:25 | gsap.ticker.add never removed, leaks on HMR/re-init |
| H-2 | HIGH | reveals.js:17 | SplitText not re-split on resize, breaks line masks |
| H-3 | HIGH | hero.js:103 / main.js | destroy() never called, resize listeners accumulate HMR |
| H-4 | HIGH | smoothScroll.js:35 | querySelector can throw SyntaxError on unusual HTML IDs |
| H-5 | HIGH | preloader.js / main.js:14 | runPreloader rejection unhandled, page stuck on failure |
| M-1 | MEDIUM | hero.js:96 | DPR not updated on resize / display change |
| M-2 | MEDIUM | hero.js:116 | Frame-rate-dependent mouse lerp (0.05 factor) |
| M-3 | MEDIUM | hero.js | No webglcontextlost handler |
| M-4 | MEDIUM | smoothScroll.js:13 | Early ScrollTrigger.refresh() before fonts ready |
| M-5 | MEDIUM | smoothScroll.js | No destroy() returned, Lenis cleanup impossible |
| M-6 | MEDIUM | motion.js:2 | window.matchMedia at parse time, SSR-unsafe |
| L-1 | LOW | hero.js:114 | uTime absolute timestamp causes jump after tab background |
| L-2 | LOW | cursor.js:41 | is-hover flickers on rapid magnetic-to-magnetic transition |

---

## Notes on Scope

**destroy() never called on single-page site (H-3):** On a deployed static SPA the page is destroyed with the tab and all resources are released by the OS. The `destroy()` never being called is not a real-world memory leak for visitors. The practical problem is exclusively during Vite HMR development sessions where module re-evaluation stacks up listeners.

**SplitText resize (H-2):** This IS a real visitor-facing bug. Any user who lands on mobile portrait, rotates to landscape, and then scrolls will see broken line animations. It should be treated as high priority despite the single-page context.

**WebGL context failure (C-1):** Particularly relevant for the iOS Safari "Low Power Mode" path where WebGL is blocked. Without the guard the preloader spinner hangs forever and users see a broken page.

---

STATUS: CHANGES REQUESTED
