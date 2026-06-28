# Round 1 WebGL — Agent Report

## Tier

Tier 2.5: single OGL Renderer, hero fluid-noise backdrop + DOM-synced showroom gallery with hover distortion.

## Libraries added

None new. Uses the already-installed stack: ogl 1.0.11, gsap 3.15, lenis 1.3.25.

## Files created / changed

### Created
- `src/webgl/scene.js` — single entry point; exports `initWebGL()` per integration contract
- `src/webgl/gallery.js` — Gallery class; DOM-synced planes, texture generation, hover distortion

### Unchanged
- `src/webgl/hero.js` — left intact; main.js currently imports `initHero` from it (see wiring below)
- `src/main.js` — NOT edited per brief; wiring instructions below
- `src/lib/motion.js`, `src/lib/cursor.js`, `src/animations/*` — untouched

## Main.js wiring required (two-line change)

Replace the existing hero import and call:

```js
// REMOVE:
import { initHero } from "./webgl/hero.js";
// ...
hero = initHero();

// REPLACE WITH:
import { initWebGL } from "./webgl/scene.js";
// ...
hero = initWebGL();
```

The `initWebGL()` return shape is `{ start, destroy }` — identical to `initHero()` — so the rest of main.js (preloader then, `hero.start()`, HMR dispose) works unchanged.

## Shader effects implemented

### Hero backdrop (full-screen Triangle)
- Simplex-based fBm fluid-noise (5 octaves), mouse-reactive (eased 5% per frame)
- Top region darkened via smoothstep vignette so hero text stays legible
- `uHeroFade` uniform: reads `hero.getBoundingClientRect()` each frame, fades contribution 1→0 as the hero scrolls away so it does not fight the gallery section
- Reduced-motion: single static frame at t=0, no loop

### Gallery planes (per [data-webgl-plane])
- Pixel-space orthographic projection: `uPlaneOffset` + `uPlaneSize` / `uResolution` → clip space, recomputed from `getBoundingClientRect()` every frame (Lenis uses native scroll so rects are always accurate)
- Texture built on an offscreen 2D canvas (512×512, even dimensions per AVIF rule): vertical gradient from `data-color` → 30% darker, per-pixel noise grain, radial vignette, watermark big-number at 9% opacity, bold project name + editorial rule line
- General Sans used if `document.fonts` shows it loaded, else system bold sans
- **Hover distortion**: GSAP tweens `uHover` 0→1 on `pointerenter` (0.55s power2.out), 1→0 on `pointerleave` (0.7s power3.out). Fragment shader drives: mouse-centred ripple wave (`sin(dist*18 - t*4) * exp(-dist*6)`), RGB channel shift (max ±1.2% UV offset), +7% brightness lift
- **Scroll aliveness**: `uScrollVel` (normalised scroll delta, exponentially smoothed) drives a ±4% vertical plane drift in the vertex shader
- Layering: hero renders first (`clear: false`), then gallery planes render over it without clearing

## Performance guards

- `autoClear: false` on Renderer; single `gl.clear()` per frame, then two layered `render({ clear: false })` calls
- DPR: `Math.min(devicePixelRatio, 2)` fine pointer, `Math.min(devicePixelRatio, 1.5)` coarse; re-read on `resize`
- `IntersectionObserver` (rootMargin 100px) per plane: skips `update()` + `render()` for off-screen tiles
- Shared `Plane` geometry across all four tiles (one VAO upload)
- `geometry.remove()` / `program.remove()` / `gl.deleteTexture()` on destroy; RAF cancelled; all listeners removed
- `webglcontextlost` handler cancels RAF; `webglcontextrestored` resumes

## Accessibility / robustness guards

- `prefersReducedMotion()`: single static hero frame, no RAF loop, `.webgl` class NOT added (CSS fallback tiles stay visible with gradients and numbers)
- `isCoarsePointer() && innerWidth < 500`: returns no-op `{ start, destroy }` immediately, no canvas init
- WebGL context creation failure (try/catch around `new Renderer()`): returns no-op, page fully functional on CSS fallback
- Gallery init failure (try/catch): hero still renders, gallery skipped gracefully
- `.webgl` class only added after gallery planes array is non-empty, ensuring DOM fallback stays if planes fail
- Content never gated on WebGL: `.work__media` CSS gradient + `.work__index` number are the no-JS/no-WebGL fallback; `.webgl` class on `<html>` hides them only when the planes are confirmed live

## Build verification

```
vite v8.1.0 — 40 modules transformed
dist/assets/index-*.js  192.58 kB │ gzip: 68.41 kB
✓ built in 111ms
```

Preview served at :4199, `[data-gl-canvas]` present in HTML, no module errors.

## Hand-off notes

- **gsap-choreographer**: the showroom `article.work` elements already have `data-reveal`; the hover tween on `uHover` is internal to the WebGL layer. Scroll-pinning or stagger reveals on `.work` tiles are yours to add via ScrollTrigger without touching scene.js.
- **frontend-design-stylist**: tile textures use the brand color from `data-color`; typography inside the canvas uses General Sans if available. The CSS fallback gradient in `.work__media` and the token palette are yours to tune. No CSS changes were made in this round.
