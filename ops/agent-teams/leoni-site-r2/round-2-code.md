# Round 2 Code Review — leoni-site WebGL + Animation Layer

Reviewer: typescript-reviewer agent  
Date: 2026-06-28  
Scope: src/main.js, src/webgl/scene.js, src/webgl/gallery.js, src/animations/scrollfx.js, src/animations/reveals.js, src/lib/cursor.js, src/lib/smoothScroll.js  
Stack: vanilla JS, Vite 8, OGL 1.0.11, GSAP 3.15, Lenis 1.3.25 (no TypeScript)

---

## CRITICAL

None.

---

## HIGH

### H1 — Shared Plane geometry never freed on destroy (GPU leak)
**File:** `src/webgl/gallery.js:207, 343–358`

`const geo = new Plane(gl, ...)` is created once and shared across all Mesh instances (`new Mesh(gl, { geometry: geo, program })`). In `destroy()`, only `plane.program.remove()` and `gl.deleteTexture(plane.tex.texture)` are called per plane. The shared `geo` object is never assigned to a property on `this`, so it is out of scope after `_build()` returns and `geo.remove()` is never called.

OGL's `Geometry.remove()` deletes all VAOs and VBOs. Without it, every HMR cycle leaks the Plane geometry buffers on the GPU.

**Fix:** Store the geometry reference and free it in destroy:
```js
// _build():
this._geo = new Plane(gl, { width: 1, height: 1 });

// destroy():
if (this._geo) { this._geo.remove(); this._geo = null; }
```

### H2 — HMR dispose does not clean up reveals or scrollfx listeners
**File:** `src/main.js:38–43`

The HMR dispose block only calls `gl.destroy()` and `scroll.destroy()`. It does not clean up:
- The `window` resize listener added in `reveals.js:69` (the debounced re-split handler)
- The `window` mousemove listener added in `scrollfx.js:86`
- All `ScrollTrigger` instances created by both `initScrollFX` and `initReveals`

On each HMR hot reload, a new set of ScrollTrigger instances and window listeners is added on top of the previous ones. After several saves, `[data-split]` elements will be re-split and re-animated by stacking triggers, and mousemove velocity skew will multiply.

`ScrollTrigger` instances are persistent — they survive across `initScrollFX` calls because there is no `ScrollTrigger.getAll().forEach(t => t.kill())` call at teardown time.

Accepting this as dev-only is a reasonable pragmatic choice for a small site, but only if the actual stacking behaviour does not produce visible glitches (duplicate animations, incorrect skew magnitudes). It currently does produce visible issues because `initReveals` re-hides elements that were already revealed (the `revealed: false` flag is reset on the new closure), then ScrollTrigger fires them again mid-session.

**Fix (minimal):** Export a destroy function from `initScrollFX` and `initReveals`, then call them in the HMR dispose block:
```js
// scrollfx.js: return { destroy() { ScrollTrigger.getAll().forEach(t => t.kill()); window.removeEventListener('mousemove', onMouseMove); lenis.off('scroll', handler); } }
// reveals.js: return { destroy() { ScrollTrigger.getAll().forEach(t => t.kill()); window.removeEventListener('resize', handler); } }
// main.js HMR: revealCtrl.destroy(); scrollfxCtrl.destroy();
```
Or, the simpler escape hatch: `import.meta.hot.dispose(() => { location.reload(); })` — forces a full page reload on HMR, avoiding all stacking entirely at the cost of losing the partial HMR benefit.

### H3 — heroGeo (Triangle) not freed in scene.destroy()
**File:** `src/webgl/scene.js:148, 275–291`

`heroProgram.remove()` is called correctly (frees the GPU program), but `heroGeo.remove()` is never called. OGL's `Geometry.remove()` deletes the VAO and vertex buffer for the Triangle. This leaks the full-screen triangle geometry on every HMR cycle or any call to `destroy()`.

**Fix:**
```js
// scene.js destroy():
heroGeo.remove();
heroProgram.remove();
```

---

## MEDIUM

### M1 — Per-frame getBoundingClientRect without batched reads (layout thrash risk)
**File:** `src/webgl/gallery.js:311` (inside `update()`), `src/webgl/gallery.js:294` (inside `_onMouseMove`)

`update()` calls `plane.fig.getBoundingClientRect()` inside a `for` loop over all visible planes, every frame. Simultaneously, `_onMouseMove` also calls `getBoundingClientRect()` on `plane.fig` from pointer event handlers. These are safe read-only calls and do not interleave DOM writes in the same tick, so forced-reflow per call is the browser's normal measurement cost.

However, if the loop grows (e.g. 8 planes), the browser will re-calculate layout for each call sequentially. The `inViewport` guard (`if (!plane.inViewport) continue`) keeps off-screen planes from being measured, which is correct and mitigates the issue.

The remaining concern is that `_onMouseMove` calls `getBoundingClientRect()` outside the RAF budget — on a raw pointer event. This is fine for accuracy but adds a layout query outside the animation frame. Caching the rect on the `plane` object during `update()` and reading the cached value in `_onMouseMove` would eliminate this redundancy.

**Fix (low priority):** In `update()`, store `plane._rect = rect` after reading it, and read `plane._rect` in `_onMouseMove` instead of calling `getBoundingClientRect()` again.

### M2 — scrollfx velocity skew listener stacks on double init (no guard)
**File:** `src/animations/scrollfx.js:49`

`initScrollFX` has no guard against being called twice. If it is called a second time with the same `lenis` instance, `lenis.on('scroll', handler)` will register a second listener, doubling the skew magnitude. This cannot happen in the current `main.js` code path (called once after `runPreloader`), but there is no defensive check. During HMR this is irrelevant because lenis is destroyed, but if the calling contract ever changes the stacking goes unnoticed.

Not blocking, but a one-liner guard would prevent silent drift:
```js
let _initialized = false;
export function initScrollFX(lenis) {
  if (_initialized || prefersReducedMotion() || !lenis) return;
  _initialized = true; // reset in destroy if a destroy is added
  ...
}
```

### M3 — reveals.js resize handler captures stale `items` closure; no cleanup
**File:** `src/animations/reveals.js:68–76`

The resize listener added at line 69 holds a reference to the `items` array and to `resizeTimer`. Neither is cleaned up. In production this is benign (the listener lives for the page lifetime). In HMR, this is the root of H2 — the old listener continues to call `_buildSplit` on DOM nodes that may have been replaced, and the new listener adds another handler.

The `resizeTimer` variable is declared inside `_setupSplits()` so it is properly scoped; no global leak. But the `window.addEventListener('resize', ...)` call has no corresponding removeEventListener anywhere.

### M4 — onContextRestored restarts RAF without checking `running` state correctly
**File:** `src/webgl/scene.js:207–211`

```js
function onContextRestored() {
  if (!running) return;
  canvas.classList.add("is-ready");
  raf = requestAnimationFrame(loop);
}
```

After a context loss, `onContextLost` sets `running = false`. Then `onContextRestored` checks `if (!running) return` — so it will always return early and never restart the loop. The intent is the opposite: restart only when running was true at the time of loss.

**Fix:** Track whether the loop was running at the time of context loss with a separate flag:
```js
let wasRunning = false;
function onContextLost(e) {
  e.preventDefault();
  wasRunning = running;
  cancelAnimationFrame(raf);
  running = false;
  canvas.classList.remove("is-ready");
}
function onContextRestored() {
  if (!wasRunning) return;
  running = true;
  canvas.classList.add("is-ready");
  raf = requestAnimationFrame(loop);
}
```

### M5 — cursor.js: no cleanup of pointermove, pointerenter, pointerleave, or [data-cursor-view] listeners
**File:** `src/lib/cursor.js:19–55`

`initCursor` registers:
- `window.addEventListener("pointermove", ...)` — global
- Per-`[data-magnetic]` element: `pointerenter`, `pointermove`, `pointerleave`
- Per-`[data-cursor-view]` element: `pointerenter`, `pointerleave`

None of these are cleaned up in the HMR dispose block (cursor is not exported, and main.js has no cursor destroy). This is dev-only leakage (same category as H2) but worth tracking as the code grows.

### M6 — smoothScroll.js: Lenis tick added to GSAP ticker, never removed on error paths
**File:** `src/lib/smoothScroll.js:22–24`

```js
const tick = (time) => lenis.raf(time * 1000);
gsap.ticker.add(tick);
```

The `destroy()` function correctly calls `gsap.ticker.remove(tick)`. However, `destroy()` is only called via the HMR dispose and is not called on any error path (e.g. if `runPreloader().then(...)` throws after scroll is created). This is unlikely in practice since the `.catch(() => {})` absorbs errors, but it means a thrown error inside the `then` chain after `scroll = initSmoothScroll()` would leave the ticker running with an orphaned lenis instance. Low probability, acceptable for a personal site.

---

## LOW

### L1 — makHeroFade calls getBoundingClientRect every frame on the hero element
**File:** `src/webgl/scene.js:109–115`

`heroFade.get()` is called once per frame from the render loop. It queries `.hero`'s bounding rect every frame to compute the fade value. This is one call per frame against a single stable element, so the cost is negligible. However, if the hero is entirely scrolled out of view (rect.top << 0), this still fires. A simple scroll-position threshold guard would skip the rect query when the hero is far off-screen.

Not worth changing unless profiling flags it.

### L2 — scrollfx.js: mousemove listener uses passive:true but cursor.js global pointermove does not declare passive
**File:** `src/animations/scrollfx.js:86`, `src/lib/cursor.js:19`

`scrollfx.js` correctly adds `{ passive: true }` to its mousemove listener. `cursor.js` adds a `pointermove` listener without the passive option. Both are read-only (no `preventDefault()`), so the browser's heuristic may treat them as passive anyway, but explicitly declaring `{ passive: true }` is the correct form and avoids a console warning in some browser devtools.

### L3 — `buildTexture` calls `document.fonts` spread on every texture creation
**File:** `src/webgl/gallery.js:142`

```js
const hasGeneralSans = [...document.fonts].some((f) => f.family.includes("General Sans") && f.status === "loaded");
```

`[...document.fonts]` creates a full array copy of the FontFaceSet on every call to `buildTexture`. This runs once per plane at init time, so the cost is not in the hot path. It is slightly wasteful; the result could be computed once and reused.

### L4 — `_onHoverLeave` / `_onHoverEnter` tween stacking: correctly guarded
**File:** `src/webgl/gallery.js:274–291`

This was a concern in the review prompt. The code correctly calls `plane.hoverTween.kill()` before creating a new tween in both enter and leave handlers. No stacking issue. This is implemented correctly.

### L5 — `isCoarsePointer()` called at `initWebGL` call time but motion media query result may change
**File:** `src/webgl/scene.js:120`

`isCoarsePointer()` reads `window.matchMedia` once at init and is not reactive. This is standard and correct — no site re-evaluates this dynamically. Not a bug.

### L6 — `makeScrollTracker` smoothV state can drift if tab is backgrounded
**File:** `src/webgl/scene.js:90–103`

When the RAF loop is paused by tab visibility, `window.scrollY` delta between the last frame and the resumed frame can be very large, feeding a large `raw` value into `smoothV`. The clamp in `get()` (`Math.max(-1, Math.min(1, smoothV / 40))`) caps the output, preventing a visual spike. Acceptable.

---

## Disposition Summary

| ID | Severity | Issue | Action |
|----|----------|-------|--------|
| H1 | HIGH | Shared Plane geometry (geo) never freed in gallery.destroy() | Fix before any production deploy |
| H2 | HIGH | HMR dispose misses reveals/scrollfx ScrollTrigger + window listeners | Fix or adopt full-reload HMR strategy |
| H3 | HIGH | heroGeo (Triangle) not freed in scene.destroy() | Fix before any production deploy |
| M1 | MEDIUM | Per-frame getBoundingClientRect in update loop (no batching) | Mitigate by caching rect on plane |
| M2 | MEDIUM | initScrollFX has no double-call guard | Add init flag |
| M3 | MEDIUM | reveals.js resize listener never removed | Fix alongside H2 |
| M4 | MEDIUM | onContextRestored guard is inverted — loop never restarts after context loss | Fix |
| M5 | MEDIUM | cursor.js listeners never cleaned up on HMR | Fix alongside H2 |
| M6 | MEDIUM | gsap ticker not removed on error path in smoothScroll | Low risk, acceptable |
| L1–L6 | LOW | Various minor issues | Optional |

---

## STATUS: CHANGES REQUESTED

Three HIGH issues are present. H1 and H3 are GPU buffer leaks that manifest on every HMR cycle in dev and on every WebGL context recreation in production (e.g. a tab going to background and returning on iOS Safari). H2 causes visible animation stacking and element re-hiding on HMR. M4 (inverted context-restore guard) means WebGL never recovers after a GPU context loss event.

None of these crash the page or expose security issues, but H1/H3/M4 are correctness bugs that will surface in real usage.
