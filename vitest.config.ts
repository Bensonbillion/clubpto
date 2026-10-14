import { defineConfig, type Plugin } from "vitest/config";
import path from "path";

/**
 * Tests render pages to HTML but never encode images. An import ending in
 * ?picture (vite-imagetools in the real build) resolves here to a stub with
 * the same shape, named after the file, so <Picture> renders and alt text
 * can be checked without running sharp.
 */
const pictureStub = (): Plugin => ({
  name: "clubpto-picture-stub",
  enforce: "pre",
  resolveId(id) {
    return id.endsWith("?picture") ? `\0picture:${id}` : null;
  },
  load(id) {
    if (!id.startsWith("\0picture:")) return null;
    const name = path.basename(id.replace("\0picture:", "").replace("?picture", ""));
    return `export default ${JSON.stringify({
      img: { src: `/stub/${name}`, w: 1200, h: 1600 },
      sources: { avif: `/stub/${name}.avif 1200w`, webp: `/stub/${name}.webp 1200w` },
    })};`;
  },
});

export default defineConfig({
  plugins: [pictureStub()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/__tests__/**"],
    setupFiles: ["src/test/setup.ts"],
  },
});
