import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Instagram } from "lucide-react";
import logo from "@/assets/logo.jpg";

const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/book", label: "Book" },
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
    { href: "/manage", label: "Court Manager" },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <img 
              src={logo} 
              alt="Club Padel Toronto" 
              className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`font-body text-sm tracking-wide transition-colors link-underline flex items-center gap-1.5 ${
                  isActive(link.href)
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a 
              href="https://www.instagram.com/club_pto/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors hover:scale-110 transform"
            >
              <Instagram className="w-5 h-5" />
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-foreground"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border/50 animate-fade-up">
            <div className="flex flex-col py-4">
              {navLinks.map((link, index) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-4 font-body text-lg transition-all flex items-center gap-2.5 ${
                    isActive(link.href)
                      ? "text-primary bg-primary/10 border-l-2 border-primary"
                      : "text-foreground hover:bg-muted/30 hover:pl-6"
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {link.label}
                </Link>
              ))}
              <a 
                href="https://www.instagram.com/club_pto/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-4 flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors"
              >
                <Instagram className="w-5 h-5" />
                <span className="font-body">@club_pto</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default MobileNav;
