import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// React is used only for mounted "islands" (e.g. the Aurora reactbits background).
// The rest of the site stays vanilla JS + OGL + GSAP.
export default defineConfig({
  plugins: [react()],
});
