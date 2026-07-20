import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { navItems, courtsideII, weeklyMeets, isCourtsideUpcoming } from "@/lib/constants";
import logoWordmark from "@/assets/logo-wordmark.png";
import { staggerContainer, fadeIn } from "@/lib/animations";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Hide on scroll down, reveal on scroll up
  const handleScroll = useCallback(() => {
    const currentY = window.scrollY;
    setScrolled(currentY > 40);
    setHidden(currentY > 120 && currentY > (handleScroll as any)._lastY);
    (handleScroll as any)._lastY = currentY;
  }, []);

  useEffect(() => {
    (handleScroll as any)._lastY = 0;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Disable body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const isActive = (href: string) => location.pathname === href;

  // The homepage hero is cream, so the header can start transparent there.
  // Inner pages sit on teal, where the teal wordmark needs the cream bar.
  const solid = scrolled || location.pathname !== "/";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
        style={{
          background: solid ? "rgba(240, 230, 211, 0.93)" : "transparent",
          backdropFilter: solid ? "blur(12px)" : undefined,
          borderBottom: solid ? "1px solid rgba(11, 58, 56, 0.15)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <img src={logoWordmark} alt="Club PTO" className="h-7 md:h-8 w-auto" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`rly-navlink ${isActive(item.href) ? "is-active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* State-aware CTA, desktop */}
            {isCourtsideUpcoming() ? (
              <a
                href={courtsideII.ticketsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rly-pill rly-pill--nav hidden lg:inline-flex"
              >
                Tickets ↗
              </a>
            ) : (
              <a
                href={weeklyMeets.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rly-pill rly-pill--nav hidden lg:inline-flex"
              >
                Book a spot ↗
              </a>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden relative w-8 h-8 flex flex-col items-center justify-center gap-[5px]"
              aria-label="Toggle menu"
              aria-expanded={isOpen}
            >
              <span
                className={`block w-6 h-px transition-all duration-300 ${
                  isOpen ? "rotate-45 translate-y-[3px]" : ""
                }`}
                style={{ background: "var(--ink)" }}
              />
              <span
                className={`block w-6 h-px transition-all duration-300 ${
                  isOpen ? "opacity-0" : ""
                }`}
                style={{ background: "var(--ink)" }}
              />
              <span
                className={`block w-6 h-px transition-all duration-300 ${
                  isOpen ? "-rotate-45 -translate-y-[3px]" : ""
                }`}
                style={{ background: "var(--ink)" }}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ background: "var(--chalk)" }}
          >
            <motion.nav
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-col items-center gap-7"
            >
              {navItems.map((item) => (
                <motion.div key={item.href} variants={fadeIn}>
                  <Link
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`rly-mobilelink ${isActive(item.href) ? "is-active" : ""}`}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div variants={fadeIn}>
                {isCourtsideUpcoming() ? (
                  <a
                    href={courtsideII.ticketsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rly-pill mt-4"
                    onClick={() => setIsOpen(false)}
                  >
                    Courtside II · Tickets ↗
                  </a>
                ) : (
                  <a
                    href={weeklyMeets.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rly-pill mt-4"
                    onClick={() => setIsOpen(false)}
                  >
                    Book a weekly spot ↗
                  </a>
                )}
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
