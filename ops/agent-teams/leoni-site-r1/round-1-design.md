# Round 1 — Design Review: Gabriele Leoni Studio Site

**Date:** 2026-06-28
**Reviewer:** Frontend Design Stylist
**Reference:** editorial / creative-studio dark luxury. Clash Display + General Sans. Near-black warm bg, warm-orange accent.
**Anti-template bar:** Awwwards / dverso tier.

---

## 1. Type Scale and Hierarchy

### What works
The scale range is wide and genuinely intentional. `--text-display: clamp(3rem, 1rem + 9vw, 9.5rem)` against `--text-base: clamp(1rem, 0.92rem + 0.4vw, 1.2rem)` is roughly a 7-9x size ratio at wide viewports. The hero screenshot confirms the display headline fills the canvas aggressively — this is correct for the direction.

`line-height: 0.98` on headings (base.css:56) is the right call for a condensed-display face at large optical sizes. No change needed.

### Problems

**P1 — Weight is locked to a single value (600) across all three heading levels.**
`h1`, `h2`, and `h3` all share `font-weight: 600` (base.css:54-58). Clash Display ships 500 and 700 — at no point is either used to create differentiation. The about lead (`font-weight: 500`, sections.css:179) breaks the global rule and introduces some welcome contrast, but the services `h3` (`.service__name`, sections.css:221 also `font-weight: 500`) and the showroom `h3` (`.work__name`, sections.css:294 also `font-weight: 500`) both land at the same optical weight as the about lead even though the about is a major section heading and these are item labels. The visual hierarchy collapses.

Fix: `h1` stays 600-700, `h2` at 500-600, `h3` at 400-500 depending on context. Concretely:
- `.about__lead` (sections.css:179): promote to `font-weight: 600`
- `.service__name` (sections.css:221): keep `font-weight: 500`, but add `letter-spacing: -0.015em` to differentiate from body without inflating size
- `.work__name` (sections.css:294): keep `font-weight: 500`

**P2 — `--text-lg` is doing double duty at two very different semantic levels.**
`.about__lead` uses `--text-xl` (sections.css:178), but both `.service__name` (sections.css:219) and `.work__name` (sections.css:293) also use `--text-lg`. At maximum viewport `--text-lg` resolves to `2.4rem` — large enough to compete visually with what should be major headings. This is acceptable inside services (it is a high-status label) but on the work tiles a `2.4rem` project name over a small tile feels oversized.

Fix for `.work__name`: drop to `--text-base` or a custom `clamp(1rem, 0.9rem + 0.6vw, 1.35rem)` so the tile hierarchy reads as thumbnail + label, not as another section heading.

**P3 — Spacing rhythm is mostly uniform, not intentional.**
Every section uses `padding-block: var(--space-section)` with no modification. The services list is the only section that creates internal rhythm variation through `padding-block: clamp(1.5rem, 3vw, 2.75rem)` per row. Contact and About get the same vertical padding as the hero transition — this compresses the sense of editorial pacing. Award-grade sites tend to assign lighter padding before statement sections (contact) and heavier before content-dense ones.

Suggestion: Give the contact section `padding-block-start: clamp(3rem, 6vw, 8rem)` (roughly 60-65% of `--space-section`) so the CTA feels pulled tighter, more urgent.

---

## 2. Accent Usage

### What works
The accent count is disciplined. Orange appears in exactly five places:
1. Preloader bar (functional — progress signal)
2. `em` within hero title ("AI")
3. `section__index` labels (01, 02, 03, 04)
4. Nav CTA link ("Contatti")
5. Email hover in contact section

This is close to correct restraint for the direction.

### Problems

**P4 — `section__index` as accent is accent overuse within a section.**
When every section opens with an orange "01 — Chi sono" label, the accent appears on every scroll event. Four times per page is not restraint. The index labels are navigational metadata, not semantic emphasis. Using accent for metadata cheapens the one genuinely semantic accent hit (the word "AI" in the hero).

Fix: Move `.section__index` (sections.css:164-170) back to `color: var(--text-dim)` with a small uppercase letter-spacing. Reserve the accent exclusively for the hero `em` and the nav CTA. This makes "AI" the single accent on the entire first screen — far more powerful.

```css
/* sections.css:168 — current: */
color: var(--accent);
/* proposed: */
color: var(--text-dim);
```

**P5 — `.work__name` on hover uses accent (sections.css:297).**
The work grid already uses orange tint in its gradient (`color-mix(in oklab, var(--accent) 22%, var(--bg-elev))`). Adding an orange name on hover creates a second orange hit on the same element. The result reads as accent layering, not accent emphasis.

Fix: On `.work:hover .work__name`, shift to `color: var(--text)` (bright white) rather than `--accent`. The tint already signals interactivity; the name brightening to white provides sufficient feedback without orange duplication.

---

## 3. Showroom Placeholder Treatment

### Current state
The tiles use a diagonal gradient from `--bg-elev` to a 22% accent-tinted version of `--bg-elev`, with a centered large index number at 16% text opacity (sections.css:265-283). The screenshot cannot confirm the showroom, but from the CSS the result is: a barely differentiated warm-dark rectangle with a ghosted number centered in it. This reads as "placeholder" because:
- The gradient direction (135deg) is generic
- The number is too faint to be a deliberate graphic element
- Centered content in a 4:3 box is the default state

### Assessment: Unfinished, not intentional.

**P6 — Make the index number a deliberate graphic element, not a ghost.**
The number should either be invisible (pure texture) or bold and positioned. At 16% opacity it is legible enough to suggest content but not bold enough to be intentional art direction.

Two paths that work without real photos:

**Option A: Full-bleed number as typographic texture**
Remove center-placement. Push the index to bottom-left, scale to `clamp(6rem, 18vw, 14rem)`, opacity 0.06, so it bleeds off the tile edge. The tile reads as a dark field with a faint typographic ghost — editorial, not placeholder. On hover, the number scales slightly (1.04) driven by JS/CSS.

```css
/* sections.css — replace .work__index block */
.work__index {
  position: absolute;
  bottom: -0.15em;
  left: 0.1em;
  font-family: var(--font-display);
  font-size: clamp(6rem, 18vw, 14rem);
  font-weight: 700;
  line-height: 1;
  color: var(--text);
  opacity: 0.06;
  user-select: none;
  pointer-events: none;
  transition: opacity var(--dur-mid) var(--ease-out-expo);
}
.work:hover .work__index {
  opacity: 0.1;
}
```

**Option B: Gradient differentiation per tile**
Give each tile a subtly different gradient angle and mix: 01 at 120deg, 02 at 160deg, 03 at 80deg, 04 at 200deg. Apply via `data-work="01"` attribute selectors. This stops all four tiles reading as identical rectangles.

Option A is stronger for zero-asset state. Option B requires HTML attribute additions.

**P7 — Tile aspect ratio 4:3 is safe.**
At award-grade, mixing aspect ratios breaks grid monotony. Consider: tiles 01 and 03 at `4/3`, tiles 02 and 04 at `3/4` (portrait). The two-column grid then alternates between landscape and portrait — a classic magazine pairing. This requires no images and immediately looks intentional.

```css
/* sections.css — add after .work:nth-child(2) .work__media, .work:nth-child(4) .work__media */
.work:nth-child(2) .work__media,
.work:nth-child(4) .work__media {
  aspect-ratio: 3 / 4;
}
```

---

## 4. Layout Composition

### What works
The hero is correctly edge-to-edge. The about body copy is pushed `margin-left: auto; max-width: 46ch` — this asymmetric alignment (lead left, body right) is a sound compositional call.

### Problems

**P8 — The hero is fully left-aligned with nothing anchoring the right margin.**
The screenshot shows "te." occupying only the bottom-left quadrant, leaving the bottom-right quadrant completely empty. At award-grade this dead space should either be compositional intent (with a counter-element) or avoided by aligning the headline differently.

The most direct fix is to add a positioned metadata element in the right gutter — e.g., a vertical text label or a small rotating badge. In pure CSS without new HTML, the `hero__meta` row already lives at the bottom of the hero and spans edge-to-edge. The current "Scorri per scoprire" lives right-aligned in that row — this is the correct anchor but it is too small relative to the blank field above it.

Consider adding a right-rail element (small, rotated vertical text reading "© 2026 — Studio" or similar) via absolute positioning within the hero. This costs two HTML elements and three lines of CSS, but eliminates the dead zone.

**P9 — All sections are identically full-width with identical left-aligned section indices.**
There is no compositional variation across scroll. The pattern: "orange label / large heading / content" repeats identically for Chi sono, Cosa faccio, Showroom, and Contatti. Award-grade sites vary the starting position, introduce bleed elements, or offset headings.

The easiest single intervention: offset the about heading. Currently `.about__lead` has `max-width: 18ch` and sits left-flush. Add `margin-left: clamp(0rem, 8vw, 6rem)` to nudge it off the left edge, introducing asymmetry without breaking the grid logic.

**P10 — Contact section is centered (sections.css:308: `text-align: center`).**
Full-bleed centered display text for a contact CTA is a common pattern and it is not wrong — but it reads as the most generic editorial call possible. Given the display type is already aggressive in the hero, centering it here creates symmetry that dilutes both instances.

Alternative: Left-align the contact title, drop `text-align: center`, and right-align only the email link. This mirrors the about asymmetry and creates an end-of-page composition that feels like a deliberate bookend rather than a centered credits page.

---

## 5. Micro-interactions

### Section dividers (1px `border-top: 1px solid var(--line)`)
The dividers are correct in weight and color. `--line: oklch(32% 0.012 60)` against `--bg: oklch(15% 0.012 60)` produces a subtle, warm-toned rule — not a harsh separator. This is appropriate. No change needed.

### Service row hover: `padding-left` shift
The transition `transition: padding-left var(--dur-mid) var(--ease-out-expo)` (sections.css:206) is structurally a good idea — a horizontal crawl on hover is characteristic of editorial list design. Two problems:

**P11 — Padding-left shift causes layout shift (CLS).**
Shifting `padding-left` on hover reflows the grid columns. In a two-column grid (`grid-template-columns: 5rem 1fr`) the number column stays fixed but the entire row shifts right, causing the right column content to reflowed. This creates jank on slower devices. Replace with `translate` on a wrapper:

```css
/* sections.css — replace padding-left transition with transform */
.service {
  /* remove transition: padding-left */
  transition: none;
}
.service__name,
.service__desc {
  transition: transform var(--dur-mid) var(--ease-out-expo);
}
.service:hover .service__name,
.service:hover .service__desc {
  transform: translateX(clamp(0.5rem, 2vw, 2rem));
}
```

This achieves the same rightward crawl on the text content without touching the layout box.

### Work tile hover: `scale(0.97)`
Scale-down on hover is counterintuitive. The conventional signal for "this is clickable / explore me" is scale-up, not scale-down. Scale-down reads as depression (a press state) or as the element retreating. At 0.97 the change is also barely perceptible — it lands in the worst zone: noticeable enough to feel like a bug, not strong enough to feel intentional.

**P12 — Invert the work tile hover scale or replace with a better treatment.**
Option A: `scale(1.02)` — simple hover growth, conventional signal.
Option B: Remove scale entirely. Instead, on hover, animate a fine inset border using an `::after` pseudo-element with `outline` or `box-shadow: inset 0 0 0 1px var(--accent)`. This is more unusual and matches the dark-luxury direction better than a scale bounce.

```css
/* sections.css — replace work hover scale */
.work__media {
  /* keep existing, add: */
  box-shadow: inset 0 0 0 0px var(--accent);
  transition: box-shadow var(--dur-mid) var(--ease-out-expo);
}
.work:hover .work__media {
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent) 55%, transparent);
  /* remove: transform: scale(0.97); */
}
```

---

## 6. Generic / Default Patterns

**P13 — Nav `mix-blend-mode: difference` is ubiquitous.**
The difference blend mode on the nav (sections.css:97) is a technique that has become a cliche in exactly the tier this site targets. On a uniform dark background it produces inverted text that is hard to read at small sizes (white-on-almost-black flips to near-black-on-almost-white at the edges). This is a technique used on sites with high-contrast hero imagery where the nav must work over both dark and light zones. On a uniform near-black bg it serves no functional purpose and signals "I copied this from an Awwwards tutorial."

Recommendation: Remove `mix-blend-mode: difference` from `.nav`. Use `color: var(--text)` for the brand mark and `color: var(--text-dim)` for links as direct values. Reserve blend modes for cursor only (where it is still unusual and functional — sections.css:53).

**P14 — Preloader is generic.**
The preloader shows "GL — Studio" in all-caps body font on the left and a counting number in display font on the right, with a 2px progress bar. Every single component of this is the default pattern for this loader style in 2024-2025. It is not wrong — but it is the exact same preloader as fifty other Awwwards submissions this year.

Differentiation options (low effort):
- Instead of a counting integer (0-100), count frames as the two-letter mark "GL" builds glyph by glyph using a scramble effect — just "G" then "GL" then "GL —" as the progress bar fills.
- Or flip the layout: the count sits in the bottom-left at display scale, the label sits top-right in tiny body text, and the bar is a single vertical line on the right edge rather than a full-width bar at the bottom. This is a more unusual spatial reading.

**P15 — `text-decoration: none` on all `a` with no other affordance except color change.**
The email link in contact and the "Scorri per scoprire" link in hero have no underline, no border, no visual signal except color-on-hover. For the hero scroll link this is fine (it is a secondary CTA). For the email — the primary conversion element — `border-bottom: 1px solid var(--line)` (sections.css:323) is already there, which is correct. No change needed here; just confirming it is handled.

---

## Priority Order

| Priority | ID | Section | Effort |
|----------|----|---------|--------|
| 1 | P4 | Accent overuse on section__index | 1 line |
| 2 | P12 | Work tile scale-down hover — invert or replace | 5 lines |
| 3 | P11 | Service hover padding CLS — replace with translateX | 8 lines |
| 4 | P6 | Showroom index ghost number — reposition as typographic element | 10 lines |
| 5 | P7 | Showroom tile mixed aspect ratios | 4 lines |
| 6 | P1 | Heading weight differentiation | 3 lines |
| 7 | P2 | work__name font size reduction | 1 line |
| 8 | P13 | Remove nav mix-blend-mode difference | 2 lines |
| 9 | P10 | Contact left-align | 2 lines |
| 10 | P8 | Hero dead-zone right gutter | HTML + 6 lines |
| 11 | P9 | About heading left offset for asymmetry | 1 line |
| 12 | P5 | work:hover name color from accent to text | 1 line |
| 13 | P3 | Contact padding-block-start reduction | 1 line |
| 14 | P14 | Preloader differentiation | Medium JS/CSS |

---

## Summary Verdict

The foundation is strong. The token system, fluid scale, and semantic HTML are production-quality. The hero headline is genuinely impactful — the Clash Display at near-full-viewport size with a single orange word lands exactly as intended. The about asymmetry (lead left, body right) is the most compositionally sophisticated moment in the design.

The ceiling issues are: accent used too liberally (four orange index labels dilute the one semantic accent), the showroom reads as unfinished rather than intentional (ghost numbers, identical rectangles), the service hover triggers layout shift, and the work tile hover signal is inverted. Fixing P4, P11, P12, P6, and P7 alone would push this from "solid dark template" to a credible award-submission candidate. The other items are refinements.

---

**STATUS: CHANGES REQUESTED**
