// The shell for the redesigned public pages: announcement bar, header,
// the page, footer, and the newsletter pop-up. Skill Lab is the one older
// page left; it keeps PublicLayout. The other old pages were retired on
// Oct 15 2026 (src/site/retired.ts).

import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { club, thursday, todayInToronto, venue } from "@/site/content";
import { Logo } from "@/site/ui/bits";
import { NewsletterPopup } from "@/site/ui/NewsletterPopup";
import "@/site/pto.css";

export const NAV = [
  { label: "Play", to: "/play" },
  { label: "League", to: "/league" },
  { label: "Standings", to: "/league#standings" },
  { label: "Events", to: "/events" },
  { label: "Book PTO", to: "/book-pto" },
  { label: "Partners", to: "/partners" },
] as const;

/** The Thursday move is news until the end of November. */
const ANNOUNCE_UNTIL = "2026-11-30";

const Announcement = () => {
  const today = todayInToronto();
  if (today > ANNOUNCE_UNTIL) return null;
  const line =
    today < thursday.firstDate
      ? "Same club, different day. PTO meets move to Thursdays from Oct 15."
      : "Same club, different day. PTO meets are on Thursdays now.";
  return (
    <div className="announce">
      <div className="wrap">
        <span className="ann-long">{line}</span>
        <span className="ann-short">Same club, new night: Thursdays.</span>
        <Link to="/play">Grab a pass</Link>
      </div>
    </div>
  );
};

const Header = () => {
  const [open, setOpen] = useState(false);
  const { pathname, hash } = useLocation();
  const here = `${pathname}${hash}`;
  // /league and /league#standings are both links, so match the anchor too.
  const isOn = (to: string) =>
    to.includes("#") ? here === to : pathname === to && !NAV.some((n) => n.to !== to && n.to === here);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="site-header">
      <div className="wrap">
        <Link to="/" aria-label="Club PTO home" className="brand">
          <Logo />
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`navlink${isOn(n.to) ? " on" : ""}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <a className="btn btn-lime btn-sm" href={thursday.bookingUrl}>
            <span className="lbl-long">Book Thursday</span>
            <span className="lbl-short">Book</span>
          </a>
          <button
            type="button"
            className="menu-btn"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      <nav id="mobile-nav" className={`mobile-nav${open ? " open" : ""}`} aria-label="Mobile">
        <div className="wrap">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to}>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
};

const Footer = () => (
  <footer className="site-footer">
    <div className="wrap stack" style={{ gap: 48 }}>
      <div className="g4">
        <div className="stack" style={{ gap: 12 }}>
          <Logo height={34} />
          <p className="body small">Toronto's padel social club.</p>
        </div>
        <nav aria-label="Play">
          <p className="eyebrow">Play</p>
          <Link to="/play">Thursday meets</Link>
          <Link to="/league">The league</Link>
          <Link to="/events">Events</Link>
        </nav>
        <nav aria-label="Work with us">
          <p className="eyebrow">Work with us</p>
          <Link to="/book-pto">Book PTO</Link>
          <Link to="/partners">Partners</Link>
        </nav>
        <div className="find">
          <p className="eyebrow">Find us</p>
          <span>
            {venue.name}
            <br />
            {venue.address}
          </span>
          <a href={`mailto:${club.email}`}>{club.email}</a>
          <a href={club.instagramUrl}>{club.instagramHandle}</a>
        </div>
      </div>
      <div className="footer-base">
        <span>© {new Date().getFullYear()} Club PTO</span>
        <span>{club.triplet}</span>
      </div>
    </div>
  </footer>
);

/** Fade sections up as they scroll in. Content is never hidden without JS. */
const useReveal = () => {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    const scan = () => document.querySelectorAll(".pto .reveal:not(.is-in)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
};

const SiteLayout = () => {
  const { pathname, hash } = useLocation();
  useSmoothScroll();
  useReveal();

  // Paper behind the page, so overscroll never flashes the dark theme.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = "#F5EFE3";
    document.body.classList.add("pto-body");
    return () => {
      html.style.backgroundColor = prev;
      document.body.classList.remove("pto-body");
    };
  }, []);

  // New page, top of the page. With an anchor (/league#standings), wait for
  // the lazy page to mount, then scroll to it: the router does not.
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el || ++tries > 30) {
        window.clearInterval(timer);
        el?.scrollIntoView({ block: "start" });
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [pathname, hash]);

  return (
    <div className="pto">
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <Announcement />
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <NewsletterPopup />
    </div>
  );
};

export default SiteLayout;
