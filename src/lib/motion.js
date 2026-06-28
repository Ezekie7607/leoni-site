// Single source of truth for motion preference.
const query = window.matchMedia("(prefers-reduced-motion: reduce)");

export const prefersReducedMotion = () => query.matches;

// Touch / coarse pointer: skip cursor + magnetic, lighten WebGL.
export const isCoarsePointer = () =>
  window.matchMedia("(hover: none), (pointer: coarse)").matches;
