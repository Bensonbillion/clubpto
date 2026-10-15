// Small building blocks shared by the public pages.

import { useEffect, type CSSProperties, type ReactNode } from "react";
import Picture from "@/components/ui/Picture";
import logoWordmarkCream from "@/assets/logo-wordmark-cream.png";
import type { SitePhoto } from "@/site/photos";

/**
 * The Club PTO wordmark: script "Club", the lime pixel ball, digital "PTO".
 * The file is cream and lime, drawn for dark grounds, so it only sits on the
 * forest green header and footer. Never recolor it.
 */
export const Logo = ({ height = 30 }: { height?: number }) => (
  <img
    src={logoWordmarkCream}
    alt="Club PTO"
    width={557}
    height={101}
    className="logo"
    style={{ height, width: "auto" }}
    decoding="async"
  />
);

interface PhotoProps {
  photo: SitePhoto;
  sizes?: string;
  priority?: boolean;
  focus?: string;
}

/** A photo that fills its box (the box sets the shape). */
export const Photo = ({ photo, sizes, priority, focus }: PhotoProps) => (
  <Picture
    img={photo.img}
    alt={photo.alt}
    className="ph"
    sizes={sizes}
    priority={priority}
    style={focus || photo.focus ? { objectPosition: focus ?? photo.focus } : undefined}
  />
);

/** A taped print in a hero collage. `at` positions it inside .collage. */
export const Shot = ({
  photo,
  at,
  sizes,
  priority,
  focus,
}: PhotoProps & { at: CSSProperties }) => (
  <figure className="shot" style={at}>
    <span className="tape" />
    <Photo photo={photo} sizes={sizes} priority={priority} focus={focus} />
  </figure>
);

/** The round lime stamp that sits on a collage. */
export const Seal = ({ children, at }: { children: ReactNode; at: CSSProperties }) => (
  <div className="seal" style={at}>
    <span>{children}</span>
  </div>
);

/** Section heading: eyebrow, then a display line. */
export const Head = ({
  eyebrow,
  children,
  as: Tag = "h2",
  size = "t-l",
  className = "",
}: {
  eyebrow?: ReactNode;
  children: ReactNode;
  as?: "h1" | "h2";
  size?: string;
  className?: string;
}) => (
  <div className={`head ${className}`}>
    {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
    <Tag className={`disp ${size}`}>{children}</Tag>
  </div>
);

/** One question in a FAQ list. */
export const Qa = ({ q, children, open }: { q: string; children: ReactNode; open?: boolean }) => (
  <details className="qa" open={open}>
    <summary>
      {q}
      <span aria-hidden="true">+</span>
    </summary>
    <p className="body">{children}</p>
  </details>
);

export const Check = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0E2418"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flex: "none", marginTop: 2 }}
  >
    <path d="M4 12l5 5L20 6" />
  </svg>
);

export const Plus = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0E2418"
    strokeWidth="2.2"
    strokeLinecap="round"
    aria-hidden="true"
    style={{ flex: "none", marginTop: 2 }}
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

import { PAGE_META, SITE, type PagePath } from "@/site/pageMeta";

const setMeta = (selector: string, attr: string, value: string) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    const [tag, rest] = selector.split("[");
    el = document.createElement(tag);
    const [key, raw] = rest.replace("]", "").split("=");
    el.setAttribute(key, raw.replace(/"/g, ""));
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

/** Title, description, canonical and share tags for one page. */
export const usePageMeta = (title: string, description: string, path: string, image?: string) => {
  useEffect(() => {
    if (image) {
      setMeta('meta[property="og:image"]', "content", `${SITE}${image}`);
      setMeta('meta[name="twitter:image"]', "content", `${SITE}${image}`);
    }
    document.title = title;
    const url = `${SITE}${path}`;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('link[rel="canonical"]', "href", url);
  }, [title, description, path, image]);
};

/** The page's own entry in PAGE_META: the same tags the build writes into its HTML. */
export const usePagePreview = (path: PagePath) => {
  const m = PAGE_META[path];
  usePageMeta(m.title, m.description, path, m.image);
};
