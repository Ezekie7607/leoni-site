/**
 * gallery.js — DOM-synced showroom image-plane gallery
 *
 * Each [data-webgl-plane] figure gets a textured Plane that is repositioned
 * every frame to match the figure's getBoundingClientRect(), using an
 * orthographic pixel-space projection (clip-space computed in the vertex shader).
 *
 * Hover distortion is driven by GSAP-tweened per-plane uHover uniform.
 * Scroll velocity displaces all planes slightly for a "alive while scrolling" feel.
 */

import { Mesh, Program, Plane, Texture, Vec2 } from "ogl";
import { gsap } from "gsap";
import { isCoarsePointer } from "../lib/motion.js";

/* ---- Vertex shader (pixel-space to clip-space) ---- */
const vert = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;

  uniform vec2 uPlaneOffset;   // bottom-left in pixels (y from bottom)
  uniform vec2 uPlaneSize;     // width, height in pixels
  uniform vec2 uResolution;    // viewport in pixels
  uniform float uScrollVel;    // [-1..1] scroll velocity displacement
  uniform float uHover;        // [0..1]

  varying vec2 vUv;
  varying float vHover;

  void main() {
    vUv = uv;
    vHover = uHover;

    // Map from [0,1] local UV to pixel position, then to clip space
    vec2 pixelPos = uPlaneOffset + position.xy * uPlaneSize;

    // Subtle vertical drift from scroll velocity
    pixelPos.y += uScrollVel * uPlaneSize.y * 0.04;

    // Clip space: [-1, 1] on both axes
    vec2 clip = (pixelPos / uResolution) * 2.0 - 1.0;
    gl_Position = vec4(clip, 0.0, 1.0);
  }
`;

/* ---- Fragment shader (hover distortion + RGB shift) ---- */
const frag = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uHover;
  uniform vec2 uMouse;    // [-1..1] relative to plane centre
  uniform float uTime;

  varying vec2 vUv;
  varying float vHover;

  // Cheap ripple/wave displacement
  vec2 ripple(vec2 uv, vec2 centre, float strength, float t) {
    vec2 delta = uv - centre;
    float dist = length(delta);
    float wave = sin(dist * 18.0 - t * 4.0) * exp(-dist * 6.0);
    return uv + normalize(delta + 0.001) * wave * strength;
  }

  void main() {
    float h = vHover;

    // Mouse-space: remap uMouse [-1,1] to [0,1] UV
    vec2 mouseCentre = uMouse * 0.5 + 0.5;
    // Clamp so it doesn't go wild outside the plane
    mouseCentre = clamp(mouseCentre, 0.1, 0.9);

    // Ripple strength: 0.032 max — tasteful, not extreme
    float rippleStr = h * 0.032;
    vec2 distUv = ripple(vUv, mouseCentre, rippleStr, uTime);

    // RGB channel shift proportional to hover: max ~4px equivalent
    float shift = h * 0.012;
    float r = texture2D(uTexture, distUv + vec2(shift, 0.0)).r;
    float g = texture2D(uTexture, distUv).g;
    float b = texture2D(uTexture, distUv - vec2(shift, 0.0)).b;
    float a = texture2D(uTexture, distUv).a;

    // Slight brightness lift on hover
    vec3 col = vec3(r, g, b);
    col += h * 0.07;

    // Vignette darkening at the plane edges (always on, subtle)
    vec2 edgeDist = vUv * (1.0 - vUv) * 4.0;
    float vign = clamp(edgeDist.x * edgeDist.y * 4.0, 0.0, 1.0);
    col *= mix(0.78, 1.0, vign);

    gl_FragColor = vec4(col, a);
  }
`;

/* ---- Canvas texture generator ---- */
function buildTexture(gl, { color, label }) {
  // Even dimensions are required (odd AVIF fail, same rule applies to canvas textures)
  const W = 512, H = 512;
  const offscreen = document.createElement("canvas");
  offscreen.width = W;
  offscreen.height = H;
  const ctx = offscreen.getContext("2d");

  // Parse hex color → darker shade
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }
  const [r, g, b] = hexToRgb(color);
  const darkerColor = `rgb(${Math.floor(r * 0.3)},${Math.floor(g * 0.3)},${Math.floor(b * 0.3)})`;

  // Vertical gradient from brand color to darker shade
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, color);
  grad.addColorStop(1, darkerColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle noise overlay for texture
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 18;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  // Grain vignette
  const vigGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.2, W * 0.5, H * 0.5, W * 0.8);
  vigGrad.addColorStop(0, "rgba(0,0,0,0)");
  vigGrad.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, W, H);

  // Resolve font: General Sans if loaded, else bold system sans
  const hasGeneralSans = [...document.fonts].some((f) => f.family.includes("General Sans") && f.status === "loaded");
  const fontStack = hasGeneralSans ? '"General Sans", system-ui, sans-serif' : 'system-ui, sans-serif';

  // Big number — faint watermark only. The DOM .work__meta carries the
  // project name + tag, so we don't bake text into the texture (no duplication).
  ctx.save();
  ctx.font = `700 ${Math.floor(W * 0.72)}px ${fontStack}`;
  ctx.fillStyle = "rgba(255,255,255,0.11)";
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(label);
  ctx.fillText(label, -metrics.width * 0.04, H * 0.92);
  ctx.restore();

  // Upload to GPU
  const tex = new Texture(gl, {
    image: offscreen,
    width: W,
    height: H,
    generateMipmaps: true,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    magFilter: gl.LINEAR,
  });

  return tex;
}

/* ---- Gallery class ---- */
export class Gallery {
  constructor(gl, { scrollRef }) {
    this.gl = gl;
    this.scrollRef = scrollRef; // { velocity: 0 } updated by scene each frame
    this.planes = [];
    this._observers = [];
    this._time = 0;

    this._build();
  }

  _build() {
    const gl = this.gl;
    const figures = [...document.querySelectorAll("[data-webgl-plane]")];
    if (!figures.length) return;

    this._geo = new Plane(gl, { width: 1, height: 1 });

    figures.forEach((fig) => {
      const article = fig.closest("article") || fig.parentElement;
      const { color = "#333333", label = "00" } = fig.dataset;

      const tex = buildTexture(gl, { color, label });

      const uniforms = {
        uTexture:     { value: tex },
        uPlaneOffset: { value: new Vec2(0, 0) },
        uPlaneSize:   { value: new Vec2(1, 1) },
        uResolution:  { value: new Vec2(window.innerWidth, window.innerHeight) },
        uScrollVel:   { value: 0 },
        uHover:       { value: 0 },
        uMouse:       { value: new Vec2(0, 0) },
        uTime:        { value: 0 },
      };

      const program = new Program(gl, {
        vertex: vert,
        fragment: frag,
        uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });

      const mesh = new Mesh(gl, { geometry: this._geo, program });

      // Per-plane state
      const plane = {
        fig,
        article,
        mesh,
        program,
        tex,
        uniforms,
        hover: 0,
        hoverTween: null,
        mouseTarget: new Vec2(0, 0),
        inViewport: false,
      };

      this.planes.push(plane);

      // Hover enter/leave — on the article (pointer target). Fine pointers only:
      // no hover semantics on touch/coarse devices, so skip the listeners + GPU work.
      if (!isCoarsePointer()) {
        const onEnter = (e) => this._onHoverEnter(plane, e);
        const onLeave = () => this._onHoverLeave(plane);
        const onMove  = (e) => this._onMouseMove(plane, e);
        article.addEventListener("pointerenter", onEnter);
        article.addEventListener("pointerleave", onLeave);
        article.addEventListener("pointermove",  onMove, { passive: true });
        plane._onEnter = onEnter;
        plane._onLeave = onLeave;
        plane._onMove  = onMove;
      }

      // IntersectionObserver to skip rendering off-screen planes
      const io = new IntersectionObserver(
        ([entry]) => { plane.inViewport = entry.isIntersecting; },
        { rootMargin: "100px" }
      );
      io.observe(fig);
      this._observers.push(io);
    });
  }

  _onHoverEnter(plane, e) {
    if (plane.hoverTween) plane.hoverTween.kill();
    plane.hoverTween = gsap.to(plane.uniforms.uHover, {
      value: 1,
      duration: 0.55,
      ease: "power2.out",
    });
    this._onMouseMove(plane, e);
  }

  _onHoverLeave(plane) {
    if (plane.hoverTween) plane.hoverTween.kill();
    plane.hoverTween = gsap.to(plane.uniforms.uHover, {
      value: 0,
      duration: 0.7,
      ease: "power3.out",
    });
  }

  _onMouseMove(plane, e) {
    // Reuse the rect measured in update() to avoid an extra layout read.
    const rect = plane._rect || plane.fig.getBoundingClientRect();
    // Convert mouse to [-1,1] relative to plane centre
    const nx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const ny = ((e.clientY - rect.top)  / rect.height) * 2 - 1;
    plane.mouseTarget.set(nx, -ny);
  }

  // Called each frame from scene loop
  update(time) {
    this._time = time;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const vel = this.scrollRef.velocity;

    for (const plane of this.planes) {
      if (!plane.inViewport) continue;

      const rect = plane.fig.getBoundingClientRect();
      plane._rect = rect; // cached for pointermove handler
      // OGL default NDC: y+ is up, so we need to flip.
      // Convert CSS rect (y from top) to pixel-space with y from bottom.
      const x = rect.left;
      const y = vh - rect.bottom; // bottom-left corner, y from bottom

      plane.uniforms.uPlaneOffset.value.set(x, y);
      plane.uniforms.uPlaneSize.value.set(rect.width, rect.height);
      plane.uniforms.uResolution.value.set(vw, vh);
      plane.uniforms.uScrollVel.value = vel;
      plane.uniforms.uTime.value = time;

      // Ease mouse
      const m = plane.uniforms.uMouse.value;
      m.x += (plane.mouseTarget.x - m.x) * 0.08;
      m.y += (plane.mouseTarget.y - m.y) * 0.08;
    }
  }

  // Render all visible planes. clear:false preserves the hero backdrop beneath.
  render(renderer) {
    for (const plane of this.planes) {
      if (!plane.inViewport) continue;
      renderer.render({ scene: plane.mesh, clear: false });
    }
  }

  resize() {
    // BoundingClientRect values are read every frame so no explicit resize needed.
    // But update resolution uniforms at next update call — they read from window.inner*.
  }

  destroy() {
    for (const io of this._observers) io.disconnect();
    this._observers = [];

    for (const plane of this.planes) {
      if (plane.hoverTween) plane.hoverTween.kill();
      plane.article.removeEventListener("pointerenter", plane._onEnter);
      plane.article.removeEventListener("pointerleave", plane._onLeave);
      plane.article.removeEventListener("pointermove",  plane._onMove);
      plane.program.remove();
      // OGL Texture has no remove() in 1.0.11 — delete the GPU texture directly
      if (plane.tex && plane.tex.texture) {
        this.gl.deleteTexture(plane.tex.texture);
      }
    }
    this.planes = [];
    // Free the shared plane geometry (VAO + VBOs).
    if (this._geo) {
      this._geo.remove();
      this._geo = null;
    }
  }
}
