# Gabriele Leoni — sito personale

Sito personale in stile creative-studio (riferimento: dversostudio.io).
Personal brand + showroom. Costruito a mano, vanilla JS + Vite.

## Stack

- **Vite** (vanilla JS, ES modules)
- **GSAP 3.15** + ScrollTrigger + SplitText — reveal a righe, skew, parallax
- **Lenis** — smooth scroll (inertia), sincronizzato col ticker GSAP
- **OGL** — un solo canvas WebGL: backdrop hero a shader + galleria showroom

Build tier 2.5: set completo di animazioni dverso, compositor-only, content
visibile senza JS, rispetta `prefers-reduced-motion`.

## Animazioni (set completo)

- Preloader con contatore + sipario
- Smooth scroll Lenis
- Hero: campo di rumore fluido WebGL reattivo al mouse + parallax del titolo
- Reveal a righe (SplitText mask-up) su tutti i titoli
- Skew sulla velocità di scroll (`[data-skew]`)
- **Galleria showroom WebGL**: piani sincronizzati alle tile, distorsione +
  RGB shift all'hover (la firma dverso), drift sulla velocità di scroll
- Cursore custom (dot + ring) con stato espanso "Presto" sulle tile
- Bottoni magnetici

## Comandi

```bash
npm install      # una volta
npm run dev      # sviluppo (http://localhost:5173)
npm run build    # build produzione in dist/
npm run preview  # serve la build (http://localhost:4173)
```

Dev flag: `?nointro` salta il preloader (es. http://localhost:5173/?nointro).

## Struttura

```
index.html               # markup semantico + hook animazioni (data-split, data-reveal,
                         #   data-skew, data-hero-parallax, data-webgl-plane, data-cursor-view)
src/
  main.js                # orchestrazione (intro -> scroll/cursor/reveal/scrollfx/webgl)
  styles/
    tokens.css           # design token (palette oklch, type scale, motion)
    base.css             # reset, focus, skip-link, gl-canvas, reveal-gating, reduced-motion
    sections.css         # stile per sezione + cursore
  lib/
    smoothScroll.js      # Lenis + GSAP ticker + anchor offset → { lenis, destroy }
    preloader.js         # contatore + sipario (inert sulle regioni)
    cursor.js            # cursore custom + magnetic + stato "Presto"
    motion.js            # helper reduced-motion / coarse pointer
  animations/
    reveals.js           # SplitText reveal a righe + re-split al resize
    scrollfx.js          # skew su velocità + hero parallax
  webgl/
    scene.js             # entry WebGL: initWebGL() → { start, destroy }
    gallery.js           # piani showroom DOM-synced + distorsione hover
public/
  favicon.svg
  works/                 # (vuota) immagini dei lavori, quando ci saranno
```

## Da fare per il lancio

1. **Immagini reali dei lavori**: oggi i piani showroom usano texture procedurali
   (gradiente + grana + numero). Mettere le immagini in `public/works/` (AVIF/WebP,
   dimensioni pari) e passarle a `gallery.js` come texture.
2. **Case study**: le tile sono `<article>` non cliccabili e il cursore dice
   "Presto". Quando esistono le pagine, trasformarle in `<a>` e cambiare
   `data-cursor-view="Vedi"`.
3. **Copy**: rivedere hero/about/servizi con la tua voce.
4. **Deploy**: `npm run build` poi pubblicare `dist/` (Vercel / Netlify).
5. **Font self-host** (ora Fontshare CDN) per CWV e CSP più stretta.
6. **CSP** di produzione (vedi regole web/security).

## Note

- Direzione: editorial / creative-studio dark, near-black caldo, accento arancio.
- Accento con parsimonia: solo "AI" nell'hero e CTA nav.
- Font: Clash Display (display) + General Sans (testo), via Fontshare.
- Tutto degrada con grazia: niente WebGL / reduced-motion / touch → fallback CSS,
  contenuto sempre visibile.
- Review multi-agente in `ops/agent-teams/` (round-1 v1, round-2 rebuild animato).
