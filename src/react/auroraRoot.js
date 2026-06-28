import { createRoot } from "react-dom/client";
import { createElement } from "react";
import Aurora from "./Aurora.jsx";

/**
 * Renders the Aurora island into `el`. Lives in its own module so React and
 * the component are code-split into a lazy chunk (loaded on demand).
 *
 * @param {HTMLElement} el
 * @returns {() => void} cleanup that unmounts the React root
 */
export function renderAurora(el) {
  const root = createRoot(el);
  root.render(createElement(Aurora));
  return () => root.unmount();
}
