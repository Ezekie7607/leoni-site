# Round 1 — Accessibility & UX Audit
**Site:** leoni-site (Vite vanilla-JS, Awwwards/dverso-style)
**Date:** 2026-06-28
**Standard:** WCAG 2.2 AA
**Status:** CHANGES REQUESTED

---

## Methodology

Files read: `index.html`, `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/sections.css`, `src/lib/cursor.js`, `src/lib/smoothScroll.js`, `src/lib/preloader.js`, `src/lib/motion.js`, `src/animations/reveals.js`, `src/webgl/hero.js`, `src/main.js`.

Contrast ratios are computed from approximate sRGB conversions of the oklch token values (bg ≈ rgb 35,31,27; text ≈ 238,234,228; text-dim ≈ 163,158,151; accent ≈ 226,131,46). Where mix-blend-mode:difference is involved, the effective visible pixel color is computed as |src - dst|.

---

## CRITICAL

### C-1: No `:focus-visible` styles anywhere in the codebase
**File:** `src/styles/base.css`, `src/styles/sections.css` — no `:focus-visible` rule exists.  
**Impact:** Keyboard users (tab navigation) get zero visible focus indicator on every interactive element: nav links, work cards (`<a>`), contact email link, footer email link, hero scroll link. This is a WCAG 2.2 SC 2.4.11 (Focus Appearance) failure and a SC 2.4.7 failure.  
`body { cursor: none }` is active for all pointer:fine devices, meaning even the OS cursor is suppressed. Without a focus ring, a keyboard user has no idea where focus is.  
**Fix:** Add to `base.css`:
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  border-radius: var(--radius);
}
/* suppress ring on mouse click (browsers that don't support :focus-visible natively handle this automatically) */
a:focus:not(:focus-visible),
button:focus:not(:focus-visible) {
  outline: none;
}
```
And verify the nav links, `.work`, `.contact__mail`, `.hero__scroll`, `.footer a`, `.nav__brand` all receive this ring.

### C-2: Preloader traps keyboard and screen-reader focus for ~2.3s
**File:** `src/lib/preloader.js` lines 1-46; `src/styles/sections.css` lines 1-44.  
**Impact:** The preloader `<div>` sits at z-index 1000 covering the full viewport. It has no `role`, no `aria-live`, and critically no `aria-hidden` or `inert` attribute. During the 2.3s animation, a screen reader announces the `<span class="preloader__count">` number changing from 0 to 100 as live content — producing a flood of announcements. Keyboard focus is not trapped by the preloader element itself but the preloader DOM sits above `<main>`, and since no `inert` is applied to the rest of the page, focus can reach behind the preloader visually.  
**Fix:**
1. Add `aria-hidden="true"` to `[data-preloader]` — the counter is decorative, not informative.
2. Add `inert` attribute to `<main>`, `<header>`, and `<footer>` while preloader is active; remove them in the `onComplete` callback before `el.remove()`.
3. Or, simpler: add `role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"` to `[data-preloader]` and update `aria-valuenow` in the `onUpdate` callback — one announcement at completion, not 100 incremental ones.

### C-3: No skip-navigation link
**File:** `index.html` — missing before line 27.  
**Impact:** Keyboard users must tab through all 4 nav links + brand on every page load before reaching main content. WCAG SC 2.4.1 bypass blocks.  
**Fix:** Insert as the first child of `<body>`:
```html
<a href="#top" class="skip-link">Salta al contenuto</a>
```
And in CSS:
```css
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--gutter);
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: var(--bg);
  font-size: var(--text-sm);
  z-index: 2000;
  border-radius: var(--radius);
}
.skip-link:focus {
  top: 1rem;
}
```
Note: `<main id="top">` already exists; the skip link target is valid.

---

## HIGH

### H-1: Nav links contrast failure under mix-blend-mode:difference
**File:** `src/styles/sections.css` lines 96-122; `src/styles/tokens.css` lines 4-9.  
**Impact:** The `.nav` has `mix-blend-mode: difference`. The effective visible pixel for `.nav__menu a` (color: `--text-dim` ≈ rgb 163,158,151) over the page background (≈ rgb 35,31,27) is `|163-35, 158-31, 151-27|` = rgb(128,127,124). Contrast ratio of that result against the page background = **4.09:1**. Required for body text at `--text-sm` (~13.7-16px) = **4.5:1**. FAIL.  
The `.nav__cta` (color: `--accent` ≈ rgb 226,131,46) difference-blended result = rgb(191,100,19), contrast **3.93:1**. FAIL. This is the only nav item visible on mobile and it fails.  
When the WebGL canvas is active and an orange-tinted pixel (e.g. rgb 200,100,40) sits under the nav, the blended result can drop to **2.77:1**. Worst case FAIL.  
**Fix options (pick one):**
- Option A (recommended): Remove `mix-blend-mode: difference` from `.nav`. Style brand as `--text`, nav links as `--text-dim`, CTA as `--accent` directly. Add a subtle `background: color-mix(in oklab, var(--bg) 80%, transparent)` with `backdrop-filter: blur(12px)` for the glassmorphism effect without blend-mode contrast hazards.
- Option B: Keep the blend mode but change the source color of nav links to white (`#fff`). White difference-blended over near-black = near-white, which passes. The CTA could become white too (losing the accent distinction), so differentiate via font-weight or underline.
- Option C: Add a `background: var(--bg)` strip to the nav (full opacity) and drop the blend mode. Less editorial, but contrast-safe.

### H-2: `[data-reveal-now]` on `<header>` means nav is opacity:0 without JS... except it is not gated
**File:** `src/animations/reveals.js` lines 56-58; `src/styles/base.css` lines 114-119.  
**Impact:** `data-reveal-now` is NOT in the `.js [data-reveal]` selector, so the header is visible by default even without JS — this is correct behavior. However, when JS runs, `initReveals` calls `gsap.from(navNow, { y: -20, opacity: 0 ... })`. This means for the ~1.4s preloader window, the nav is present in the DOM but `gsap.from` sets its starting opacity to 0 immediately, making the nav invisible during preloader. If the preloader is skipped (reduced-motion path), `initReveals()` bails early at line 13, so `gsap.from` is never called. The nav is visible. This is actually correct. But if JS loads but preloader fails/errors before calling `initReveals`, the nav stays at opacity 0 permanently. Low-probability but worth noting.  
More importantly: the nav `gsap.from` starts the nav at opacity 0 with no CSS fallback. If GSAP fails to load (CDN block, parse error), nav stays invisible. Since GSAP is npm-bundled (not CDN), this risk is lower, but the pattern is fragile.  
**Fix:** Add `transition: opacity 0.8s` to `.nav` in CSS, and rely on a CSS class toggle rather than `gsap.from` for the nav entrance, so a GSAP failure degrades gracefully.

### H-3: All four `.work` cards link to `href="#"` — empty/placeholder links
**File:** `index.html` lines 131, 138, 145, 152.  
**Impact:** `href="#"` triggers a page jump to top, announces nothing meaningful to screen readers, and provides no destination. Screen readers announce "link" with no description. Keyboard users who activate any work card get scroll-jacked to top. WCAG SC 2.4.4 link purpose failure.  
**Fix (short-term):** Add `aria-label` and `aria-disabled="true"` + `role="button"` if the case study pages don't exist yet, or use `<div>` with a visible "In arrivo" badge instead of `<a href="#">`. Do not leave functional-looking links pointing nowhere.

### H-4: `<header>` used as nav wrapper, semantic role conflict
**File:** `index.html` line 44.  
**Impact:** The `<header>` element here wraps the entire navigation bar including brand and `<nav>`. This is semantically valid — `<header>` as a landmark is correct. However the `<header>` has `data-reveal-now` and no `role` override, so screen readers announce it as "banner" landmark. The `<nav aria-label="Navigazione principale">` is correctly nested. No ARIA failure here, but see H-5 below.

### H-5: Mobile nav hides all links except `.nav__cta` at ≤640px — navigation effectively disappears
**File:** `src/styles/sections.css` lines 118-122.  
**Impact:** At 320-640px viewport, only the "Contatti" CTA link is visible. "Chi sono", "Cosa faccio", "Showroom" are `display: none`. There is no hamburger menu, no mobile nav alternative. Users on mobile can only jump to the contact section from the nav. All other sections require manual scrolling with no keyboard shortcut to jump. This is not a hard WCAG failure (the sections are reachable by scrolling) but it is a HIGH usability issue — and for keyboard mobile users it is functionally a bypass-blocks failure since there is no way to skip to mid-page sections.  
**Fix:** Either implement a mobile hamburger menu (adds significant JS), or keep all 4 nav links but stack them or use a scrollable row, or show abbreviated link text. The current solution of hiding 3/4 of the navigation is not acceptable UX.

---

## MEDIUM

### M-1: No `lang` attribute fallback for any English text fragments
**File:** `index.html` line 2 — `lang="it"` is set, correct. However inline English phrases ("Web Design & Development", "Web developer & AI builder", service names mixing EN/IT) are not wrapped with `lang="en"` spans. Screen readers will mispronounce these using Italian phonetics.  
**Fix:** Wrap English terms in `<span lang="en">` or accept the mispronunciation as cosmetic. Priority depends on target audience.

### M-2: Hero `<h1>` split into `<span class="line" data-split>` — SplitText wraps lines in additional markup that loses semantic line breaks
**File:** `index.html` lines 59-62; `src/animations/reveals.js` lines 15-19.  
**Impact:** SplitText wraps each line in a `<div class="split-line">` inside the spans. The heading text reads correctly to screen readers (text content is preserved), but the intermediate DOM may confuse some AT when split lines are announced separately. Low severity, but worth testing with VoiceOver/NVDA.  
**Fix:** Add `aria-label` to `<h1 id="hero-title">` with the full sentence as a single string, and add `aria-hidden="true"` to the individual `<span class="line">` children. This ensures AT reads the clean heading while visual split works normally.

### M-3: `hero__scroll` anchor scroll target confusion with Lenis
**File:** `src/lib/smoothScroll.js` lines 31-39; `index.html` line 65.  
**Impact:** The "Scorri per scoprire ↓" link has `href="#showroom"`. Lenis intercepts this click and smooth-scrolls to `#showroom`. Under reduced-motion, Lenis is not initialized, so the link falls back to native anchor — which works. However when JS is disabled entirely, the link also works natively. Good. The `↓` arrow has `aria-hidden="true"` — correct.  
Minor issue: the Lenis `scrollTo` call passes `offset: 0`, so the section header may be partially occluded by the fixed nav bar (nav height ~56px). No ARIA problem, but UX issue.  
**Fix:** Pass `offset: -80` (or the nav's computed height) to `lenis.scrollTo` for all anchor clicks.

### M-4: `service` list items use `<li>` with `<h3>` — correct — but hover padding-left on `<li>` causes layout shift
**File:** `src/styles/sections.css` lines 199-210.  
**Impact:** `.service:hover { padding-left: clamp(0.5rem, 2vw, 2rem) }` shifts the grid content. This triggers a CLS (layout shift) event on hover. Not a WCAG failure, but violates WCAG SC 1.4.10 (Reflow) spirit and degrades CWV. Also, animating `padding` is a layout-bound property (per project style rules).  
**Fix:** Replace with `transform: translateX(clamp(0.5rem, 2vw, 2rem))` on `.service:hover` to keep motion compositor-friendly and avoid layout shift.

### M-5: `contact__mail` link has no visible focus state AND no `:focus-visible` (covered by C-1 globally, but this specific element has extra risk)
**File:** `src/styles/sections.css` lines 317-329.  
The font size is `--text-lg` (1.4-2.4rem) and it uses `border-bottom` as a visual underline treatment. When C-1 is fixed, ensure the focus ring is visually distinct from the existing border-bottom underline.

### M-6: `work__index` spans inside `.work__media` have no `aria-hidden`
**File:** `index.html` lines 132, 139, 146, 153.  
The decorative `<span class="work__index">01</span>` numbers ("01", "02", "03", "04") inside the work cards are read by screen readers as content. Combined with the `<h3 class="work__name">` and `<p class="work__tag">`, a screen reader announces "01 Roma Lift Sito aziendale · Forklift" which is cluttered but not harmful. Still, the number is decorative.  
**Fix:** Add `aria-hidden="true"` to each `.work__index` span.

### M-7: Preloader count element announces live number changes (duplicate of C-2, medium if role=progressbar is applied)
Already covered in C-2. If the progressbar fix is applied, this is resolved.

### M-8: `isCoarsePointer()` query uses `(hover: none), (pointer: coarse)` with comma as OR — correct syntax but evaluated once at init, not reactive to device change
**File:** `src/lib/motion.js` lines 7-8.  
`window.matchMedia("(hover: none), (pointer: coarse)").matches` is evaluated once. If a user connects a mouse mid-session (Surface tablet, iPad with trackpad), the cursor stays disabled. Low-severity edge case.  
**Fix:** Use `window.matchMedia(...).addEventListener('change', ...)` to reinitialize cursor and restore `body { cursor }` dynamically, or document this as a known limitation.

---

## LOW

### L-1: No `<meta name="theme-color">` for mobile browser chrome
**File:** `index.html` head.  
Mobile browsers (Chrome Android, Safari iOS) show a colored tab bar. Without `theme-color`, it defaults to white, visually jarring against the dark site.  
**Fix:** `<meta name="theme-color" content="#231f1b">` (approximate sRGB of `--bg`).

### L-2: Font loaded from Fontshare CDN with no `font-display: optional` or SRI hash
**File:** `index.html` lines 15-18.  
Two `preconnect` hints are present — good. But the stylesheet is from an external CDN with no Subresource Integrity. If Fontshare is down, the page loads with system fallbacks (General Sans → system-ui), which is acceptable, but layout shifts may occur.  
**Fix:** Add `font-display: swap` is already in the URL parameter (`display=swap`). Consider SRI or self-hosting for production.

### L-3: `<em>` inside `<h1>` is used for accent color, not emphasis
**File:** `index.html` line 60; `src/styles/base.css` lines 62-64.  
`<em>` semantically means emphasis (stress). `font-style: normal` is applied via CSS which removes the italic, but screen readers may still announce it with emphasis intonation depending on the AT. This is a semantic misuse.  
**Fix:** Replace `<em>` with `<span class="accent">` and add `.accent { color: var(--accent) }`. Or keep `<em>` but add `aria-label` to the `<h1>` with the full plain text.

### L-4: `cursor: none` on `body` with no progressive enhancement fallback in non-JS scenario
**File:** `src/styles/base.css` line 30.  
With JS disabled, `cursor.js` never runs, the custom cursor element is invisible/empty, but `cursor: none` persists (it's in base CSS, not gated on `.js`). Users with JS disabled see no cursor at all on pointer:fine devices.  
**Fix:** Gate `cursor: none` on `.js body` in base.css to match the JS-gating pattern already used for reveals.

### L-5: `hero-canvas` opacity transition (1.2s) has no reduced-motion guard in base.css for the `.is-ready` state transition
**File:** `src/styles/base.css` lines 100-106.  
The `@media (prefers-reduced-motion: reduce)` block sets `.hero-canvas { transition: none }` — CORRECT. However `hero.js` line 125-128 still calls `canvas.classList.add("is-ready")` in reduced-motion mode after rendering one static frame. Since the transition is removed by the media query, the opacity jumps immediately to 1 (good). No functional issue, but worth noting the intent is correct and working.

### L-6: Showroom section title `<h2 class="showroom__title">` uses `data-reveal` but no `aria-labelledby` cross-reference issue
**File:** `index.html` lines 123-128.  
The section has `aria-labelledby="showroom-title"`. The `<h2>` has `data-reveal`, which under JS gets set to `opacity:0` initially. Screen readers can still read the element even when `opacity:0` (opacity does not remove from accessibility tree). No failure, but worth confirming in AT testing.

### L-7: `footer` has no `<nav>` wrapper or `aria-label` for its links
**File:** `index.html` lines 175-179.  
The footer links ("Scrivimi" email) are bare `<a>` tags inside `<footer>`. Fine semantically, but if a footer nav were intended, it should be wrapped in `<nav aria-label="Footer">`.

### L-8: No `autocomplete` attributes on any form inputs
Not applicable — there are no form inputs. The contact section uses a `mailto:` link only. No form, no issue. Listed for completeness.

### L-9: Touch target size — `.nav__cta` on mobile is the only visible nav link
**File:** `src/styles/sections.css` lines 103-117.  
`.nav__menu a` has no explicit padding. The tap target size depends on font-size (`--text-sm` ~14px) and line-height (1.5). Effective tap height ≈ 14px × 1.5 = 21px. Minimum 44px required (WCAG SC 2.5.8, AA target size). On mobile, this is the ONLY navigation link, making it critical.  
**Fix:** Add `padding-block: 0.75rem; padding-inline: 0.5rem` to `.nav__menu a` to bring tap area to ≥44px.

### L-10: `data-tilt` attribute on `.work__media` — no corresponding JS tilt handler found in reviewed files
**File:** `index.html` lines 132, 139, 146, 153.  
`data-tilt` is present but `src/main.js` does not call any tilt init function, and no tilt JS file was found in the file tree. Either the feature is not yet implemented or the handler is in an unread file. If unimplemented, the attribute is inert. If there is a tilt handler elsewhere, it should respect `prefersReducedMotion()`.

---

## Contrast Summary Table

| Pair | Ratio | Threshold | Result |
|------|-------|-----------|--------|
| `--text` on `--bg` (direct) | 13.66:1 | 4.5 | PASS |
| `--text-dim` on `--bg` (direct) | 6.15:1 | 4.5 | PASS |
| `--accent` on `--bg` (direct) | 5.86:1 | 4.5 | PASS |
| `--text-dim` on `--bg-elev` (direct) | 5.51:1 | 4.5 | PASS |
| Nav links (`--text-dim`) via `mix-blend-mode:difference` over `--bg` | 4.09:1 | 4.5 | **FAIL** |
| Nav CTA (`--accent`) via `mix-blend-mode:difference` over `--bg` | 3.93:1 | 4.5 | **FAIL** |
| Nav links via difference over WebGL orange area (worst case) | ~2.77:1 | 4.5 | **FAIL** |
| `section__index` accent (uppercase, `--text-sm`) on `--bg` | 5.86:1 | 4.5 | PASS |
| `contact__mail` (`--text-dim`, large text `--text-lg`) on `--bg` | 6.15:1 | 3.0 | PASS |
| `about__body` p (`--text-dim`, body) on `--bg` | 6.15:1 | 4.5 | PASS |
| `footer` span (`--text-dim`) on `--bg` | 6.15:1 | 4.5 | PASS |
| `preloader__label` (`--text-dim`) on `--bg` | 6.15:1 | 4.5 | PASS |

Note: contrast ratios derived from sRGB approximations of oklch tokens. Variance of ±0.3 is expected; the FAIL cases are well outside the margin.

---

## No-JS & Reduced-Motion Verification

| Check | Result |
|-------|--------|
| Content visible without JS (`.js` gate on reveals) | PASS — `[data-reveal]` elements only hidden when `.js` class present |
| Content visible under `prefers-reduced-motion` | PASS — `base.css` forces `opacity:1 !important` on all hidden elements |
| Smooth scroll disabled under reduced-motion | PASS — `smoothScroll.js` returns null and skips Lenis init |
| GSAP reveals skip under reduced-motion | PASS — `reveals.js` early-returns at line 13 |
| WebGL canvas reduced-motion | PASS — `hero.js` renders one static frame, no animation loop |
| Preloader skips under reduced-motion | PASS — `preloader.js` removes el immediately |
| Custom cursor disabled under reduced-motion | PASS — `cursor.js` returns early; CSS also hides `.cursor` |
| Nav visible without JS | PASS — `data-reveal-now` is not in the `.js [data-reveal]` CSS selector |
| `cursor: none` without JS | FAIL — see L-4 |

---

## Priority Fix Order (for Round 2)

1. C-1: `:focus-visible` styles — single CSS addition, zero risk, maximum a11y impact.
2. C-3: Skip link — 8 lines of HTML + CSS.
3. C-2: Preloader aria-hidden + inert — 4 lines of JS.
4. H-1: Nav contrast under mix-blend-mode — remove/replace the blend mode on nav. This is the most design-impacting fix; Option A (backdrop-filter) preserves the editorial feel.
5. H-3: Placeholder `href="#"` on work cards — add `aria-label` + `aria-disabled` or convert to `<div>`.
6. H-5: Mobile nav — at minimum add padding to `.nav__cta` (L-9) and decide on a mobile menu strategy.
7. L-4: Gate `cursor: none` on `.js body`.
8. M-4: Replace padding-left hover on services with translateX.
9. M-6: `aria-hidden` on decorative work index numbers.
10. L-1: Add `<meta name="theme-color">`.

---

## STATUS: CHANGES REQUESTED

Three CRITICAL issues (no focus rings, preloader blocks AT, no skip link) and two HIGH issues (nav contrast failure, mobile nav disappears) must be resolved before the site can be considered WCAG 2.2 AA compliant. The rest of the reduced-motion and semantic structure work is solid.
