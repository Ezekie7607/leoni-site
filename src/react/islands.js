/**
 * Lazy React-island bootstrapping.
 *
 * Keeps React out of the initial bundle: the Aurora renderer (react-dom +
 * the reactbits component) is code-split and only fetched when the Contact
 * section approaches the viewport. The second WebGL context lives only while
 * the section is on screen. Honours prefers-reduced-motion (static CSS glow).
 *
 * @returns {{ destroy: () => void }}
 */
export function mountIslands() {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const cleanups = [];

  document.querySelectorAll("[data-aurora]").forEach((el) => {
    if (reduceMotion) {
      el.classList.add("aurora-layer--static");
      return;
    }

    let cleanup = null;
    let loading = false;

    const mount = async () => {
      if (cleanup || loading) return;
      loading = true;
      try {
        const { renderAurora } = await import("./auroraRoot.js");
        // Guard against a race where it left the viewport while loading.
        if (loading) {
          cleanup = renderAurora(el);
          el.classList.add("is-live");
        }
      } catch (err) {
        console.warn("Aurora island failed to load:", err);
      } finally {
        loading = false;
      }
    };

    const unmount = () => {
      loading = false;
      if (cleanup) {
        cleanup();
        cleanup = null;
        el.classList.remove("is-live");
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) mount();
          else unmount();
        }
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);

    cleanups.push(() => {
      io.disconnect();
      unmount();
    });
  });

  return {
    destroy() {
      cleanups.forEach((fn) => fn());
    },
  };
}
