# Round 2 — Convergence (full dverso animation rebuild)

STATUS: APPROVED — all CRITICAL/HIGH + most MEDIUM applied. Build passes, zero console errors (puppeteer), hero + showroom-hover + full-page verified.

## What was built (by specialists, integrated by lyon)
- creative-webgl-developer → `src/webgl/scene.js` (single OGL canvas: hero fluid shader + gallery) + `src/webgl/gallery.js` (DOM-synced textured planes, hover RGB distortion, scroll-velocity drift, IntersectionObserver). Removed orphan `hero.js`.
- gsap-choreographer → `src/animations/reveals.js` (SplitText line mask-up, resize re-split) + `src/animations/scrollfx.js` (velocity skew on [data-skew], hero mouse+scroll parallax).
- lyon → integration (main.js), cursor "Presto" state (cursor.js), HTML hooks, CSS (gl-canvas, .webgl fallback, cursor label).
- general-purpose → premium toolkit research → `vault/learning/knowledge/premium-web-animation-tools-2026.md`.

## Critical integration fix found by verification (not by reviewers)
- Split-line headings were invisible in motion mode: base.css gated `.split-line` at opacity:0 but the reveal only animates yPercent. Fixed: lines stay opaque, masked by yPercent + overflow only. Moved `initReveals()` before the preloader so initial states set under the curtain (no flash).

## Round-2 review fixes applied
Code (typescript-reviewer): shared Plane geo freed in gallery.destroy (this._geo); heroGeo already freed; onContextRestored inverted-guard fixed via wasRunning; rect cached for pointermove; pointermove passive; HMR → full reload (no listener stacking).
A11y (a11y-ux-auditor): "Vedi" broken affordance → honest "Presto" label (tiles non-clickable until case studies); gl-canvas transition disabled under reduced-motion (renamed dead .hero-canvas rule); context-loss removes `.webgl` so fallback shows; gallery hover listeners gated behind !coarse-pointer.
Design (frontend-design-stylist): removed name/tag baked into texture (DOM .work__meta carries it — no duplication); unified tile palette to one warm terracotta family (killed amber outlier); showroom title clamp(3rem,6rem); editorial stagger on tile 2; cursor label 13px/0.08em; hero vignette 0.55→0.42 + mouse easing 0.05→0.07.

## Deferred (noted in README)
- Real work images + case-study links (then swap <article>→<a>, "Presto"→"Vedi").
- Live prefers-reduced-motion change listener (M3); copy pass; deploy; font self-host; production CSP.
