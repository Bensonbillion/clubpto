import { Link } from "react-router-dom";
import { Instagram, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                <span className="font-display text-primary font-bold text-lg">P</span>
              </div>
              <span className="font-display text-2xl tracking-wide">Club PTO</span>
            </div>
            <p className="font-body text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
              Toronto's weekly padel ritual. Every Wednesday at 8PM, 
              we play, rotate, and connect.
            </p>
            <blockquote className="font-display text-lg italic text-primary">
              "Not your average padel club"
            </blockquote>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-body text-xs tracking-[0.15em] uppercase text-muted-foreground mb-4">
                Navigate
              </h4>
              <nav className="space-y-3">
                <Link to="/" className="block font-body text-sm text-foreground hover:text-primary transition-colors">
                  Home
                </Link>
                <Link to="/book" className="block font-body text-sm text-foreground hover:text-primary transition-colors">
                  Book a Session
                </Link>
                <Link to="/about" className="block font-body text-sm text-foreground hover:text-primary transition-colors">
                  About
                </Link>
                <Link to="/faq" className="block font-body text-sm text-foreground hover:text-primary transition-colors">
                  FAQ
                </Link>
              </nav>
            </div>

            <div>
              <h4 className="font-body text-xs tracking-[0.15em] uppercase text-muted-foreground mb-4">
                Connect
              </h4>
              <div className="space-y-3">
                <a 
                  href="https://www.instagram.com/club_pto/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-body text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                  @club_pto
                </a>
                <a 
                  href="mailto:hello@clubpto.com"
                  className="flex items-center gap-2 font-body text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  hello@clubpto.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="font-body text-xs text-muted-foreground">
            © {new Date().getFullYear()} Club PTO. Toronto, Canada.
          </p>
          <p className="font-body text-xs text-muted-foreground">
            Made with ♡ for the padel community
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;