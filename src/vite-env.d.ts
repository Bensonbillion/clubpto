/// <reference types="vite/client" />

/**
 * Images imported with `?picture` come back as an AVIF/WebP/JPEG set plus
 * the real pixel dimensions (see vite.config.ts and components/ui/Picture).
 */
declare module "*?picture" {
  const out: {
    img: { src: string; w: number; h: number };
    sources: Record<string, string>;
  };
  export default out;
}
