import { Instagram, Mail, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="py-16 lg:py-20 border-t border-border">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid md:grid-cols-3 gap-12 lg:gap-16">
          {/* Brand */}
          <div>
            <h3 className="font-display text-2xl font-semibold mb-4">Club PTO</h3>
            <p className="font-body text-muted-foreground leading-relaxed mb-6">
              Toronto's weekly padel ritual. Play, rotate, connect — every Wednesday at 8PM.
            </p>
            <p className="font-display text-lg italic text-muted-foreground/70">
              "Not your average padel club"
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4">Quick Links</h4>
            <nav className="space-y-3">
              <a 
                href="#how-it-works" 
                className="block font-body text-muted-foreground hover:text-foreground transition-colors"
              >
                How It Works
              </a>
              <a 
                href="#booking" 
                className="block font-body text-muted-foreground hover:text-foreground transition-colors"
              >
                Book a Session
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="block font-body text-muted-foreground hover:text-foreground transition-colors"
              >
                Follow Us
              </a>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4">Connect</h4>
            <div className="space-y-4">
              <a 
                href="https://instagram.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 font-body text-muted-foreground hover:text-foreground transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Instagram className="w-5 h-5" />
                </div>
                @clubpto
              </a>
              <a 
                href="mailto:hello@clubpto.com"
                className="flex items-center gap-3 font-body text-muted-foreground hover:text-foreground transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                hello@clubpto.com
              </a>
              <div className="flex items-center gap-3 font-body text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                Toronto, Canada
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-body text-sm text-muted-foreground">
            © {new Date().getFullYear()} Club PTO. All rights reserved.
          </p>
          <p className="font-body text-sm text-muted-foreground">
            Made with ♡ for the Toronto padel community
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;