import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

/**
 * GitHub Pages serves static files and knows nothing about client-side routes,
 * so a hard refresh on /clubpto/manage4 — exactly what the run-of-show asks for
 * at T−40 — hits Pages' own 404 unless a 404.html stands in for index.html.
 * The live branch has carried one only because a past deploy copied it by hand;
 * a build that forgets loses every deep link the moment it ships. Emitting it
 * from the bundle means it cannot be forgotten again.
 */
const spaFallback = (): Plugin => ({
  name: "clubpto-gh-pages-404",
  apply: "build",
  closeBundle() {
    const dist = path.resolve(__dirname, "dist");
    const index = path.join(dist, "index.html");
    if (!fs.existsSync(index)) return;
    fs.copyFileSync(index, path.join(dist, "404.html"));
    // Pages runs Jekyll otherwise, which drops any file starting with "_".
    fs.writeFileSync(path.join(dist, ".nojekyll"), "");
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  // NO service worker. vite-plugin-pwa (registerType "autoUpdate",
  // precaching every html/js/css) was serving months-old bundles to returning
  // visitors — the "ghost" of the pre-RALLY site. A precache that owns
  // index.html means a client can pin an entire retired design indefinitely.
  // src/main.tsx carries a kill-switch that unregisters any surviving worker.
  // Re-adding offline support is a deliberate decision, not a default: see
  // VERCEL-MIGRATION.md.
  plugins: [
    react(),
    mcpPlugin(),
    spaFallback(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
