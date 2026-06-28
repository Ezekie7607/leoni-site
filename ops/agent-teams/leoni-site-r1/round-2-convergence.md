# Round 2 — Convergence (worker fixes applied by lyon)

STATUS: APPROVED (fixes applied to all CRITICAL/HIGH and most MEDIUM)

Build: passes. Console errors: none (verified via puppeteer). Full-page + hero
screenshots reviewed.

## Applied from round-1 reviews

### Code (typescript-reviewer)
- C-1 WebGL crash hanging preloader → `initHero()` wrapped in try/catch in main.js; degrades to static page.
- H-1/H-3 ticker + listeners never removed → `initSmoothScroll` returns `{lenis, destroy}`; `import.meta.hot.dispose` cleans hero + scroll across HMR.
- H-2 SplitText never re-split on resize → debounced re-split (visible after first reveal); splits built after `document.fonts.ready`.
- H-4 `querySelector(id)` could throw on invalid id → try/catch + `id === "#"` guard.
- H-5 preloader promise rejection → `.catch(() => {})` so page never blocks.
- M-1 DPR re-read on resize; M-3 webglcontextlost handler added.

### A11y (a11y-ux-auditor)
- C-1 no focus indicators → `:focus-visible` accent outline globally.
- C-2 preloader trapped AT → `aria-hidden` + `inert` on header/main/footer during intro.
- C-3 no skip link → `.skip-link` added.
- H-1 nav contrast fail under mix-blend → removed `mix-blend-mode: difference` from nav.
- H-3 work tiles `href="#"` scroll-jack → converted to non-link `<article>`; decorative index numbers `aria-hidden`.
- H-5 mobile nav hid 3/4 links → nav now wraps/keeps all links (no display:none).
- L-1 theme-color added; L-4 `cursor:none` gated on `.js` (no-JS keeps cursor).

### Design (frontend-design-stylist)
- P4 section__index accent → text-dim (accent reserved for hero "AI" + nav CTA).
- P1/P2 heading weight gradient (h1 700 / h2 600 / h3 500); work__name smaller.
- P6/P7 work index numbers bleed off tile (opacity ~0.07, absolute); alternating 4:3 / 3:4 aspect ratios.
- P5/P12 work hover → inset accent border (not scale-down); name hover → text not accent.
- P10 contact left-aligned bookend (not centered); P9 about lead asymmetry nudge.
- P11 service hover → translateX (compositor) instead of padding-left (reflow/CLS).
- P13 removed nav mix-blend cliche; cursor keeps blend (functional).

## Deferred (low priority, noted in README)
- Real work images, case-study destinations, copy pass, deploy, font self-host, production CSP.
- M-2 frame-rate-independent mouse lerp; preloader layout flip (P14) partial.
