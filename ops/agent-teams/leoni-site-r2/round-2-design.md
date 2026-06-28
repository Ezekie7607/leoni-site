# Round 2 — Visual Design Review

Reviewer: Design-Stylist agent
Scope: Hero WebGL backdrop + showroom gallery (procedural textures, palette, composition, micro-UX)
Sources read: gallery.js, scene.js, sections.css, tokens.css, index.html, hero.png, showroom-hover.png

---

## 1. Procedural Texture: Intentional or Placeholder?

**Current state**

`buildTexture()` (gallery.js:98-188) bakes three layers into a 512x512 canvas texture per tile:
- A brand-color-to-30%-dark linear gradient (vertical)
- A random noise pass (±9 per channel)
- A radial vignette (0 to 0.42 black)
- A faint number watermark (opacity 0.09) at ~72% type size
- The **project name** at opacity 0.88 in the top-left (gallery.js:156-162)
- A thin editorial separator line below the name (gallery.js:164-173)

The DOM then repeats both the index number (`.work__index`, aria-hidden) and the name (`.work__name` inside `.work__meta`) below the tile.

**Verdict: the duplication undermines the premium read**

The name painted on the texture at rgba 0.88 opacity — highly readable — combined with `.work__name` in the DOM meta below creates a "labeled twice" feeling. The texture-baked name also cannot respond to hover state, typography tokens, or animations that the DOM element can. In the screenshot, at small tile size the texture name and DOM name appear at different scales and sometimes overlap visually when the tile is partially cropped. This reads as placeholder behavior, not editorial intent.

The big number at 0.09 opacity does work: it functions as a genuine watermark, creates depth, and is not perceptible enough to read as a separate label. That pattern is correct.

**Recommended split**

Keep in the texture (pure visual atmosphere):
- Gradient + grain + vignette: all correct, keep exactly as-is
- Number watermark at opacity 0.09-0.11: correct pattern, zero change needed
- The thin horizontal line: borderline. It reads editorial at large tile sizes but disappears at small sizes and adds nothing structural. Remove it or raise opacity to 0.30 so it reads clearly at all sizes or disappears at all sizes — no in-between.

Remove from the texture:
- The project name (`ctx.fillText(name, ...)` at gallery.js:161): delete this draw call entirely.
- The separator line below it (gallery.js:165-173) follows naturally as the line was only there to punctuate the name.

The DOM `.work__name` and `.work__tag` already carry that information correctly with hover state, semantic heading level, and proper token sizing. Let the texture be atmosphere; let the DOM be communication.

Diff required in gallery.js:
- Delete lines 155-173 (the name draw block and the separator block)
- Optionally bump the number watermark to opacity 0.11 to compensate for the removed visual mass

---

## 2. Tile Palette: Cohesion vs. Mud

**Current four colors from index.html:**
- Roma Lift: `#b8431f` (warm red-orange, high chroma)
- FOR.: `#9a3412` (deep brick)
- Denny Garofano: `#a16207` (amber-yellow, diverges hue significantly)
- Visibilità AI Kit: `#c2410c` (vivid red-orange, close to Roma Lift)

**Assessment**

The site token `--accent` is `oklch(70% 0.19 45)` — a warm orange-amber at hue 45. The tile colors are all in the same warm quadrant (red-orange to amber), which creates family coherence. However there are two specific problems:

1. `#a16207` (Denny Garofano, hue ~37 in sRGB, perceived as distinctly golden-amber) shifts the hue enough from the other three (which are red-dominant) that the four-tile row does not read as a single palette family. The amber tile jumps as an outlier.

2. `#b8431f` and `#c2410c` are too close in both hue and lightness to be meaningfully distinct. In the screenshot the Roma Lift and Visibilità AI Kit tiles are nearly indistinguishable. If the goal is variety, these two should be further apart.

**Recommendation: tonal variation, not hue drift**

Define a single accent hue family anchored to the token hue (oklch hue ~45). Vary only lightness and chroma:

```
01 Roma Lift:        oklch(44% 0.19 40)   -- deep saturated brick
02 FOR.:             oklch(36% 0.16 38)   -- darkest, near burgundy
03 Denny Garofano:   oklch(52% 0.20 48)   -- mid-warm, amber lean but still family
04 Visibilita Kit:   oklch(58% 0.17 44)   -- lightest tile, warm terracotta
```

This keeps the gradient-to-dark formula intact (each color still generates a readable vertical gradient), stays within the brand red-orange family, and creates a visible tonal step across the four tiles rather than a muddy near-repeat.

Do not introduce hues outside the 35-55 range without a deliberate reason. The amber outlier breaks the palette without earning it.

---

## 3. Hero: WebGL Fluid Field

**Shader analysis (scene.js:66-86)**

The hero uses 5-octave FBM with a simplex-style noise hash. Key lines:
- `vec3 col = mix(bg, accent, pow(n, 2.0) * 0.55)` — the accent bleeds in at max ~55% weight, quadratically attenuated
- `float vig = smoothstep(0.0, 0.72, uv.y)` then `col = mix(col, bg, vig * 0.55)` — a downward vignette suppresses accent in the upper 72% of the screen, blending 55% toward solid bg at the top

**What the screenshot confirms**

The hero title is fully legible. The fluid field sits in the lower-center and lower-right quadrant as a warm smolder — the upper-left (where the headline lives) is dark and clean. The effect is atmospheric rather than distracting. This is correctly tuned.

**Suggested refinements (small, not urgent)**

The downward vignette (vig) currently attenuates from y=0 (top) toward y=0.72. This is correct directionally but the `0.55` mix factor may be slightly conservative — the top-left in the screenshot looks almost uniformly dark, losing the sense that the fluid field extends across the whole canvas. Consider:

```glsl
// Current:
col = mix(col, bg, vig * 0.55);
// Suggestion: reduce attenuation slightly so warmth bleeds into upper corners
col = mix(col, bg, vig * 0.42);
```

This would let ~8-10% more of the accent glow reach the upper corners without touching readability over the text, since the text sits upper-left and the accent peaks toward center-right in the FBM output.

The mouse-parallax easing (`hm.x += (mouseTarget.x - hm.x) * 0.05`, scene.js:226-227) at 0.05 lag produces a heavy, almost sluggish response. For a more alive feel without overshooting: `0.07`. Not a visual bug, a polish note.

The time speed (`uTime * 0.06`) is appropriate. No change.

---

## 4. Composition: Award-Grade or Still Safe?

**What works**

- The right-aligned `"Lavori selezionati"` section title against the left-flushed `03 — SHOWROOM` index creates genuine diagonal tension. This is a conscious compositional choice and reads as editorial.
- The alternating aspect-ratio grid (4:3, 3:4, 3:4, 4:3 via sections.css:312-313) breaks the uniform card-grid template pattern.
- The large `.work__index` ghost number (`clamp(6rem, 18vw, 14rem)`) with 7% text opacity bleeds off the bottom edge of the tile. This creates vertical overlap and visual depth that pushes past generic template territory.
- The `--radius: 4px` on tiles is correctly tight — not zero, not rounded-xl, sits in the Swiss editorial register.

**What needs work**

1. The showroom grid gap (`clamp(1.5rem, 4vw, 4rem)`) creates symmetrical uniform spacing between all four tiles. The alternating portrait/landscape tiles already create vertical misalignment, but the gap never changes. An editorial push would vary the column gap vs. row gap, or set negative top margin on the portrait tiles to create an intentional stagger/offset rather than a clean grid. Example: add `margin-top: -4rem` on `.work:nth-child(2)` to let the tall tile overlap the rhythm.

2. The `.showroom__title` uses `--text-xl` (`clamp(2.2rem, 1.4rem + 3.6vw, 4.5rem)`). In the screenshot it sits at approximately 3.5rem viewport — readable but not large enough to feel like a counter-weight to the tile grid mass. The title is the only thing in the right column at that moment. Consider stepping it to `--text-display` or a custom `clamp(3rem, 2rem + 5vw, 6rem)` so the right-column type mass balances the left-column imagery.

3. The `border-top: 1px solid var(--line)` on all `main > section` is noted in sections.css:206. Combined with `--space-section: clamp(5rem, 3rem + 9vw, 12rem)` this creates readable section breathing room. No issue here.

---

## 5. Micro: Cursor + Distortion

**"Vedi" cursor**

The cursor system (sections.css:47-111) uses `mix-blend-mode: difference` on the `.cursor` wrapper. This is functional and distinctive on the dark background. The "view" state (`.cursor.is-view`) expands to 88px with `rgba(255,255,255,0.16)` fill and hides the dot — that is the circle visible in the screenshot labeled "Vedi."

The "Vedi" label sits at 11px (sections.css:86) with `letter-spacing: 0.04em`. At the 88px ring diameter, 11px feels undersized — the label occupies roughly 12% of the circle diameter and will look small on HiDPI screens. Increase to `13px` or `0.8rem`, and open tracking to `0.08em` to match the ring's open, airy feel.

The 60px `.is-hover` ring (sections.css:79) transition shares the same `var(--dur-fast)` (0.25s) as the 88px `.is-view` expansion. The jump from 60px to 88px at 0.25s ease is fast enough to feel snappy. This is fine.

**Hover distortion**

From the fragment shader (gallery.js:57-63):
- Ripple strength: `h * 0.032` (max ~3.2% UV displacement)
- RGB shift: `h * 0.012` (max ~1.2% UV, ~6px at 512 texture width)
- Brightness lift: `h * 0.07`

These numbers are tasteful. At full `uHover=1` the displacement is visible but not cartoonish. The ripple uses `sin(dist * 18.0 - t * 4.0) * exp(-dist * 6.0)` which is a tight attenuated wave from the mouse position — it dies off quickly with distance. The result in the screenshot looks like a subtle liquid surface rather than a gimmick.

One note: the vignette baked into the fragment shader (gallery.js:89-91) darkens tile edges by up to 22% (`mix(0.78, 1.0, vign)`). This is always-on, meaning unhovered tiles also have edge darkening. At the current values this reads as a natural light-falloff and does not look like a bug. But if the tile background is already dark (FOR. at `#9a3412` darkened further 30% to `rgb(46,15,5)`) the compound darkening at the corners may push to near-black invisibly. Worth checking on the darkest tile.

---

## Priority Order

1. **Remove project name from texture** (gallery.js lines 155-173): highest visual impact, fixes duplication immediately, no risk.
2. **Align tile palette** to a single oklch hue family: fixes the amber outlier and the near-identical red pair.
3. **Showroom title size**: step `.showroom__title` up one level for compositional balance.
4. **Vedi cursor label**: `11px` to `13px` / tracking `0.08em`.
5. **Hero vignette**: `vig * 0.55` to `vig * 0.42` to let warmth reach upper frame edges.
6. **Portfolio grid stagger**: optional, adds editorial depth, higher effort.

---

## Files to Modify

| File | Change |
|---|---|
| `/Users/leoni/leoni-site/src/webgl/gallery.js` | Delete name draw block (lines 155-173). Optionally bump number watermark to opacity 0.11. |
| `/Users/leoni/leoni-site/index.html` | Update four `data-color` values to oklch-mapped hex equivalents. |
| `/Users/leoni/leoni-site/src/styles/sections.css` | `.showroom__title` font-size; `.cursor__label` font-size and letter-spacing. |
| `/Users/leoni/leoni-site/src/webgl/scene.js` | `vig * 0.55` to `vig * 0.42` (HERO_FRAG line ~80). Mouse easing 0.05 to 0.07 (line ~226-227). |
