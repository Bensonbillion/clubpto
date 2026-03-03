import { useState } from "react";
import { Link } from "react-router-dom";
import { navItems, socialLinks, clubInfo } from "@/lib/constants";

const Footer = () => {
  const [email, setEmail] = useState("");

  return (
    <footer className="bg-dark-surface border-t border-white/5">
      {/* Top section */}
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Col 1: Brand */}
          <div>
            <p className="font-display text-cream text-lg tracking-[0.3em] uppercase mb-3">
              Club PTO
            </p>
            <p className="font-body text-muted text-sm font-light italic leading-relaxed">
              {clubInfo.tagline}
            </p>
          </div>

          {/* Col 2: Navigate */}
          <div>
            <h4 className="font-body text-xs uppercase tracking-[0.15em] text-muted mb-6">
              Navigate
            </h4>
            <nav className="flex flex-col gap-3">
              <Link
                to="/"
                className="font-body text-sm text-muted hover:text-cream transition-colors duration-300"
              >
                Home
              </Link>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="font-body text-sm text-muted hover:text-cream transition-colors duration-300"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Col 3: Connect */}
          <div>
            <h4 className="font-body text-xs uppercase tracking-[0.15em] text-muted mb-6">
              Connect
            </h4>
            <div className="flex flex-col gap-3">
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-sm text-muted hover:text-cream transition-colors duration-300"
              >
                Instagram
              </a>
              <a
                href={`mailto:${clubInfo.email}`}
                className="font-body text-sm text-muted hover:text-cream transition-colors duration-300"
              >
                {clubInfo.email}
              </a>
              <p className="font-body text-sm text-muted">
                {clubInfo.address}
              </p>
            </div>
          </div>

          {/* Col 4: Stay in the loop */}
          <div>
            <h4 className="font-body text-xs uppercase tracking-[0.15em] text-muted mb-6">
              Stay in the loop
            </h4>
            <form
              onSubmit={(e) => { e.preventDefault(); setEmail(""); }}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border-b border-cream/20 text-cream placeholder-muted/50 py-2 px-0 text-sm font-body focus:border-gold focus:outline-none transition-colors"
              />
              <button
                type="submit"
                className="self-start border border-gold text-gold px-6 py-2 text-xs uppercase tracking-[0.15em] font-body hover:bg-gold hover:text-dark transition-all duration-300"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-6 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="font-body text-xs text-muted">
            &copy; {new Date().getFullYear()} Club PTO
          </p>
          <div className="flex gap-4">
            <span className="font-body text-xs text-muted hover:text-cream transition-colors duration-300 cursor-pointer">
              Privacy
            </span>
            <span className="font-body text-xs text-muted hover:text-cream transition-colors duration-300 cursor-pointer">
              Terms
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
