// Small building blocks shared by the public pages.

import { useEffect, type CSSProperties, type ReactNode } from "react";
import Picture from "@/components/ui/Picture";
import type { SitePhoto } from "@/site/photos";

/** The crossed-rackets mark. */
export const Mark = ({ size = 36 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <g fill="none" stroke="#0E2418" strokeWidth="4.5" strokeLinecap="round">
      <g transform="rotate(-38 32 34)">
        <ellipse cx="32" cy="20" rx="11" ry="13" />
        <line x1="32" y1="33" x2="32" y2="56" />
      </g>
      <g transform="rotate(38 32 34)">
        <ellipse cx="32" cy="20" rx="11" ry="13" />
        <line x1="32" y1="33" x2="32" y2="56" />
      </g>
    </g>
    <circle cx="32" cy="8" r="5" fill="#D9E270" stroke="#0E2418" strokeWidth="2" />
  </svg>
);

export const Wordmark = ({ size }: { size?: number }) => (
  <span className="wordmark" style={size ? { fontSize: size } : undefined}>
    <i>Club</i> <b>PTO</b>
  </span>
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

const SITE = "https://clubpto.com";

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
export const usePageMeta = (title: string, description: string, path: string) => {
  useEffect(() => {
    document.title = title;
    const url = `${SITE}${path}`;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('link[rel="canonical"]', "href", url);
  }, [title, description, path]);
};
