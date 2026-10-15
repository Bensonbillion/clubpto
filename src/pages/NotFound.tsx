// The 404 page, in the redesigned site's layout (SiteLayout wraps it), so a
// mistyped or very old link still lands on something that looks like PTO and
// has a way back in.

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { thursday } from "@/site/content";
import { usePageMeta } from "@/site/ui/bits";

const NotFound = () => {
  const { pathname } = useLocation();
  usePageMeta("Page not found · Club PTO", "That page isn't here. Head back to Club PTO.", pathname);

  // Keep search engines from indexing whatever URL was mistyped.
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex";
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);

  return (
    <section className="sec-hero" style={{ minHeight: "60vh" }}>
      <div className="wrap stack" style={{ gap: 24, maxWidth: 720 }}>
        <p className="eyebrow eyebrow-leaf">404</p>
        <h1 className="disp t-xl">
          Out of bounds. <span className="it">That page isn't here.</span>
        </h1>
        <p className="lede measure">
          The link might be old, or a letter went astray. Here's where to go instead.
        </p>
        <div className="cta-row">
          <Link className="btn btn-dark" to="/">
            Back to home
          </Link>
          <a className="btn btn-line" href={thursday.bookingUrl}>
            Grab a Thursday pass
          </a>
        </div>
      </div>
    </section>
  );
};

export default NotFound;
