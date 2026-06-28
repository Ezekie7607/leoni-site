/**
 * scene.js — single WebGL entry point (Tier 2.5)
 *
 * One OGL Renderer on [data-gl-canvas].
 * Renders two layers each frame:
 *   1. Hero backdrop: full-screen fluid-noise shader
 *   2. Showroom gallery: DOM-synced textured planes with hover distortion
 *
 * Integration contract:
 *   export function initWebGL() → { start, destroy }
 *   - initWebGL() wires everything but does NOT start the RAF loop
 *   - start() begins rendering, adds .webgl + .is-ready; destroy() tears down fully
 *
 * Fallbacks:
 *   - prefersReducedMotion() → single static frame, no loop, no .webgl class
 *   - isCoarsePointer() on narrow viewport → skip entirely
 *   - WebGL context creation failure → returns no-op { start, destroy }
 */

import { Renderer, Triangle, Program, Mesh, Vec2 } from "ogl";
import { prefersReducedMotion, isCoarsePointer } from "../lib/motion.js";
import { Gallery } from "./gallery.js";

/* ---- Hero backdrop shaders ---- */
const HERO_VERT = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const HERO_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform vec2  uResolution;
  uniform float uHeroFade;
  varying vec2 vUv;

  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise(in vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i  = floor(p + (p.x + p.y) * K1);
    vec2 a  = p - i + (i.x + i.y) * K2;
    float m = step(a.y, a.x);
    vec2 o  = vec2(m, 1.0 - m);
    vec2 b  = a - o + K2;
    vec2 c  = a - 1.0 + 2.0 * K2;
    vec3 h  = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
    vec3 n  = h*h*h*h * vec3(dot(a, hash(i+0.0)), dot(b, hash(i+o)), dot(c, hash(i+1.0)));
    return dot(n, vec3(70.0));
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p  = uv * vec2(uResolution.x / uResolution.y, 1.0);
    float t = uTime * 0.06;
    vec2 q  = p * 1.5 + uMouse * 0.25;
    float n = fbm(q + fbm(q + t) * 0.6 + t);
    n = smoothstep(-0.4, 1.0, n);

    vec3 bg     = vec3(0.062, 0.056, 0.05);
    vec3 accent = vec3(0.96, 0.46, 0.2);
    vec3 col    = mix(bg, accent, pow(n, 2.0) * 0.55);

    // Top calm so hero text is readable (relaxed so a touch more warmth reaches up)
    float vig = smoothstep(0.0, 0.72, uv.y);
    col = mix(col, bg, vig * 0.42);

    // Fade toward solid bg as hero scrolls away
    col = mix(bg, col, uHeroFade);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ---- Helpers ---- */
function makeScrollTracker() {
  let lastY  = window.scrollY;
  let smoothV = 0;

  return {
    tick() {
      const y = window.scrollY;
      const raw = y - lastY;
      lastY = y;
      smoothV += (raw - smoothV) * 0.15;
    },
    // Normalised [-1, 1]
    get() { return Math.max(-1, Math.min(1, smoothV / 40)); },
  };
}

function makeHeroFade() {
  const heroEl = document.querySelector(".hero");
  return {
    get() {
      if (!heroEl) return 1;
      const rect = heroEl.getBoundingClientRect();
      return 1 - Math.max(0, Math.min(1, -rect.top / rect.height));
    },
  };
}

/* ---- Public export ---- */
export function initWebGL() {
  // Skip on very small coarse-pointer viewports
  if (isCoarsePointer() && window.innerWidth < 500) {
    return { start() {}, destroy() {} };
  }

  const canvas = document.querySelector("[data-gl-canvas]");
  if (!canvas) return { start() {}, destroy() {} };

  const dprCap = isCoarsePointer() ? 1.5 : 2;
  const getDpr  = () => Math.min(window.devicePixelRatio || 1, dprCap);

  let renderer;
  try {
    renderer = new Renderer({
      canvas,
      dpr:               getDpr(),
      alpha:             false,
      antialias:         false,
      premultipliedAlpha: false,
      autoClear:         false, // we clear manually once per frame
    });
  } catch (err) {
    return { start() {}, destroy() {} };
  }

  const gl = renderer.gl;
  gl.clearColor(0.062, 0.056, 0.05, 1.0); // matches --bg token

  /* Hero mesh */
  const heroGeo     = new Triangle(gl);
  const heroProgram = new Program(gl, {
    vertex:    HERO_VERT,
    fragment:  HERO_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime:       { value: 0 },
      uMouse:      { value: new Vec2(0, 0) },
      uResolution: { value: new Vec2(window.innerWidth, window.innerHeight) },
      uHeroFade:   { value: 1 },
    },
  });
  const heroMesh = new Mesh(gl, { geometry: heroGeo, program: heroProgram });

  /* Scroll / fade helpers */
  const scrollTracker = makeScrollTracker();
  const heroFade      = makeHeroFade();
  const scrollRef     = { velocity: 0 };

  /* Gallery */
  let gallery = null;
  try {
    gallery = new Gallery(gl, { scrollRef });
  } catch (err) {
    console.warn("[WebGL] Gallery disabled:", err);
  }

  /* Mouse */
  const mouseTarget = new Vec2(0, 0);
  function onMouseMove(e) {
    mouseTarget.set(
      (e.clientX / window.innerWidth)  *  2 - 1,
     -((e.clientY / window.innerHeight) * 2 - 1)
    );
  }
  if (!isCoarsePointer()) {
    window.addEventListener("pointermove", onMouseMove);
  }

  /* Resize */
  function resize() {
    renderer.dpr = getDpr();
    renderer.setSize(window.innerWidth, window.innerHeight);
    heroProgram.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    if (gallery) gallery.resize();
  }
  window.addEventListener("resize", resize);

  /* Context loss */
  let raf        = 0;
  let running    = false;
  let wasRunning = false;

  function onContextLost(e) {
    e.preventDefault();
    cancelAnimationFrame(raf);
    wasRunning = running;
    running = false;
    canvas.classList.remove("is-ready");
    // Drop the gallery class so the CSS gradient fallback shows while context is gone.
    document.documentElement.classList.remove("webgl");
  }
  function onContextRestored() {
    if (!wasRunning) return;
    running = true;
    canvas.classList.add("is-ready");
    if (gallery && gallery.planes.length > 0) {
      document.documentElement.classList.add("webgl");
    }
    raf = requestAnimationFrame(loop);
  }
  canvas.addEventListener("webglcontextlost",     onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  /* RAF loop */
  function loop(timestamp) {
    raf = requestAnimationFrame(loop);

    const t = timestamp * 0.001;

    scrollTracker.tick();
    scrollRef.velocity = scrollTracker.get();

    // Ease hero mouse
    const hm = heroProgram.uniforms.uMouse.value;
    hm.x += (mouseTarget.x - hm.x) * 0.07;
    hm.y += (mouseTarget.y - hm.y) * 0.07;

    heroProgram.uniforms.uTime.value     = t;
    heroProgram.uniforms.uHeroFade.value = heroFade.get();

    // Single clear per frame
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Layer 1: hero backdrop (full-screen, autoClear: false so we preserve it)
    renderer.render({ scene: heroMesh, clear: false });

    // Layer 2: gallery planes over the hero
    if (gallery) {
      gallery.update(t);
      gallery.render(renderer);
    }
  }

  /* Reduced-motion: static frame, no loop, no .webgl class */
  function renderStatic() {
    heroProgram.uniforms.uTime.value     = 0;
    heroProgram.uniforms.uHeroFade.value = 1;
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.render({ scene: heroMesh, clear: false });
    canvas.classList.add("is-ready");
  }

  /* ---- Public API ---- */
  function start() {
    resize();

    if (prefersReducedMotion()) {
      renderStatic();
      return;
    }

    if (running) return;
    running = true;

    // Only add .webgl if gallery planes were successfully built
    if (gallery && gallery.planes.length > 0) {
      document.documentElement.classList.add("webgl");
    }

    canvas.classList.add("is-ready");
    raf = requestAnimationFrame(loop);
  }

  function destroy() {
    cancelAnimationFrame(raf);
    running = false;

    window.removeEventListener("resize",      resize);
    window.removeEventListener("pointermove", onMouseMove);
    canvas.removeEventListener("webglcontextlost",     onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);

    if (gallery) gallery.destroy();

    heroProgram.remove();
    heroGeo.remove();

    document.documentElement.classList.remove("webgl");
    canvas.classList.remove("is-ready");
  }

  return { start, destroy };
}
