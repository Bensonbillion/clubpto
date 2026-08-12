import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

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
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
