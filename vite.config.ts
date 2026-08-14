import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { imagetools } from "vite-imagetools";

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

/**
 * The hero photo is the largest contentful paint, but it lives inside a React
 * component, so the browser cannot even discover it until the bundle has
 * parsed and rendered — measured at ~1.1s of pure discovery delay on a
 * throttled phone. Its filename is content-hashed, so the preload cannot be
 * hand-written in index.html; this injects it at build time from the actual
 * emitted assets. Keep the srcset and sizes identical to the <Picture> that
 * renders it, or the browser preloads a candidate it then declines to use.
 */
const HERO_BASENAME = "hero-grid-style";
const HERO_SIZES = "(max-width: 900px) 55vw, 32vw";

const preloadHero = (): Plugin => {
  // Read the real base rather than assuming /clubpto/: this repo builds for
  // GitHub Pages under a subpath today and vercel.json points at a root
  // deploy tomorrow. A hard-coded prefix would silently preload 404s there.
  let base = "/";
  return {
  name: "clubpto-preload-hero",
  apply: "build",
  configResolved(config) {
    base = config.base || "/";
  },
  transformIndexHtml: {
    order: "post",
    async handler(html, ctx) {
      const bundle = ctx.bundle ?? {};
      const files = Object.keys(bundle).filter(
        (f) => f.includes(HERO_BASENAME) && f.endsWith(".avif")
      );
      if (files.length === 0) return html;

      // The emitted names are content-hashed, not width-stamped, so the
      // widths are read from the encoded bytes. A srcset without correct
      // `w` descriptors is worse than none: the browser would preload an
      // arbitrary candidate and then fetch a different one to display.
      const { default: sharp } = await import("sharp");
      const measured = await Promise.all(
        files.map(async (f) => {
          const asset = bundle[f] as { source?: Uint8Array | string };
          const source = asset?.source;
          if (!source || typeof source === "string") return null;
          try {
            const { width } = await sharp(Buffer.from(source)).metadata();
            return width ? { f, width } : null;
          } catch {
            return null;
          }
        })
      );

      const usable = measured.filter((m): m is { f: string; width: number } => m !== null);
      if (usable.length === 0) return html;

      const prefix = base.endsWith("/") ? base : `${base}/`;
      const srcset = usable
        .sort((a, b) => a.width - b.width)
        .map(({ f, width }) => `${prefix}${f} ${width}w`)
        .join(", ");
      const tag =
        `<link rel="preload" as="image" type="image/avif" ` +
        `imagesrcset="${srcset}" imagesizes="${HERO_SIZES}" fetchpriority="high">`;
      return html.replace("</head>", `    ${tag}\n  </head>`);
    },
  },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
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
    spaFallback(),
    // Images are the heaviest part of the mobile experience. An import
    // ending in ?picture is emitted as AVIF + WebP + the original format,
    // with real pixel dimensions attached so <Picture> can reserve space
    // and never shift the layout. See src/components/ui/Picture.tsx.
    imagetools({
      defaultDirectives: (url) =>
        url.searchParams.has("picture")
          ? new URLSearchParams({
              // Three widths so a phone downloads a phone-sized image
              // instead of the full 1000px master.
              w: "480;800;1200",
              format: "avif;webp;jpg",
              as: "picture",
            })
          : new URLSearchParams(),
    }),
    preloadHero(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
