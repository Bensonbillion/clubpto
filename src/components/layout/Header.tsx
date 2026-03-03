import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { navItems } from "@/lib/constants";
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

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          hidden ? "-translate-y-full" : "translate-y-0"
        } ${scrolled ? "bg-dark/90 backdrop-blur-md" : "bg-transparent"}`}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link
              to="/"
              className="font-display text-cream text-lg tracking-[0.3em] uppercase hover:text-gold transition-colors duration-300"
            >
              Club PTO
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`relative font-body text-xs uppercase tracking-[0.15em] transition-colors duration-300 group ${
                    isActive(item.href) ? "text-cream" : "text-muted hover:text-cream"
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-px bg-gold transition-all duration-300 ${
                      isActive(item.href) ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              ))}
            </nav>

            {/* Join Us CTA — desktop */}
            <Link
              to="/membership"
              className="hidden lg:block border border-gold text-gold px-6 py-2 text-xs uppercase tracking-[0.15em] font-body hover:bg-gold hover:text-dark transition-all duration-300"
            >
              Join Us
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden relative w-8 h-8 flex flex-col items-center justify-center gap-[5px]"
              aria-label="Toggle menu"
              aria-expanded={isOpen}
            >
              <span
                className={`block w-6 h-px bg-cream transition-all duration-300 ${
                  isOpen ? "rotate-45 translate-y-[3px]" : ""
                }`}
              />
              <span
                className={`block w-6 h-px bg-cream transition-all duration-300 ${
                  isOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`block w-6 h-px bg-cream transition-all duration-300 ${
                  isOpen ? "-rotate-45 -translate-y-[3px]" : ""
                }`}
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
            className="fixed inset-0 z-40 bg-dark flex items-center justify-center"
          >
            <motion.nav
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-col items-center gap-8"
            >
              {navItems.map((item) => (
                <motion.div key={item.href} variants={fadeIn}>
                  <Link
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`font-display text-2xl tracking-wide transition-colors duration-300 ${
                      isActive(item.href) ? "text-gold" : "text-cream hover:text-gold"
                    }`}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div variants={fadeIn}>
                <Link
                  to="/membership"
                  onClick={() => setIsOpen(false)}
                  className="border border-gold text-gold px-8 py-3 text-xs uppercase tracking-[0.15em] font-body hover:bg-gold hover:text-dark transition-all duration-300 mt-4 inline-block"
                >
                  Join Us
                </Link>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
