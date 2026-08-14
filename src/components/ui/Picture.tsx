// <Picture> — the one way images reach the page.
//
// Import with the ?picture suffix and vite-imagetools emits AVIF + WebP +
// the original, plus the real pixel dimensions:
//
//   import wall from "@/assets/wall/night.jpg?picture";
//   <Picture img={wall} alt="" />
//
// The browser takes the first format it understands, so modern phones get
// AVIF (typically a fraction of the JPEG) and everything else still works.
// Width and height always reach the DOM so the box is reserved before the
// bytes arrive — no layout shift, which is half of a good mobile score.

export interface PictureSource {
  img: { src: string; w: number; h: number };
  sources: Record<string, string>;
}

/** Order matters: smallest format first, JPEG last as the fallback. */
const FORMAT_ORDER = ["avif", "webp"] as const;

const MIME: Record<string, string> = {
  avif: "image/avif",
  webp: "image/webp",
};

export interface PictureProps {
  img: PictureSource;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * The hero, and only the hero, should load eagerly at high priority —
   * it is the largest contentful paint. Everything else waits.
   */
  priority?: boolean;
  /**
   * How wide this image renders, so the browser can pick the right width
   * from the srcset. Getting this wrong only costs bytes, never correctness.
   */
  sizes?: string;
  draggable?: boolean;
}

/** Roughly "most of the screen on a phone, about half of it on a desktop". */
const DEFAULT_SIZES = "(max-width: 900px) 90vw, 45vw";

export default function Picture({
  img,
  alt,
  className,
  style,
  priority = false,
  sizes = DEFAULT_SIZES,
  draggable,
}: PictureProps) {
  return (
    <picture>
      {FORMAT_ORDER.filter((f) => img.sources[f]).map((f) => (
        <source key={f} type={MIME[f]} srcSet={img.sources[f]} sizes={sizes} />
      ))}
      <img
        src={img.img.src}
        alt={alt}
        width={img.img.w}
        height={img.img.h}
        className={className}
        style={style}
        draggable={draggable}
        loading={priority ? "eager" : "lazy"}
        // Always async. `decoding="sync"` blocks on the decode and, with
        // AVIF, was observed never completing at all — it also delays the
        // very paint it is supposed to help. Priority is expressed by
        // fetchpriority + eager loading, which is what actually matters.
        decoding="async"
        // React 18 does not know this attribute yet; the DOM does.
        {...({ fetchpriority: priority ? "high" : undefined } as Record<string, string | undefined>)}
      />
    </picture>
  );
}
