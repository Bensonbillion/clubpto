import { Instagram, Mail, ArrowUpRight } from "lucide-react";

const Footer = () => {
  return (
    <footer className="relative border-t border-border">
      {/* Main Footer */}
      <div className="container mx-auto px-6 lg:px-12 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left: Brand */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                <span className="font-display text-primary font-bold text-xl">P</span>
              </div>
              <span className="font-display text-3xl tracking-wide">Club PTO</span>
            </div>
            <p className="font-body text-muted-foreground max-w-md leading-relaxed mb-8">
              Toronto's weekly padel ritual. Every Wednesday at 8PM, 
              we play, rotate, and connect. This is community.
            </p>
            <blockquote className="font-display text-2xl italic text-primary">
              "Not your average padel club"
            </blockquote>
          </div>

          {/* Right: Links & Contact */}
          <div className="grid sm:grid-cols-2 gap-12 lg:justify-end">
            <div>
              <h4 className="font-body text-sm tracking-[0.2em] uppercase text-muted-foreground mb-6">
                Quick Links
              </h4>
              <nav className="space-y-4">
                <a 
                  href="#how-it-works" 
                  className="group flex items-center gap-2 font-body text-foreground hover:text-primary transition-colors"
                >
                  How It Works
                  <ArrowUpRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </a>
                <a 
                  href="#booking" 
                  className="group flex items-center gap-2 font-body text-foreground hover:text-primary transition-colors"
                >
                  Book a Session
                  <ArrowUpRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </a>
              </nav>
            </div>

            <div>
              <h4 className="font-body text-sm tracking-[0.2em] uppercase text-muted-foreground mb-6">
                Connect
              </h4>
              <div className="space-y-4">
                <a 
                  href="https://www.instagram.com/club_pto/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 font-body text-foreground hover:text-primary transition-colors"
                >
                  <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary transition-colors">
                    <Instagram className="w-5 h-5" />
                  </div>
                  @club_pto
                </a>
                <a 
                  href="mailto:hello@clubpto.com"
                  className="group flex items-center gap-3 font-body text-foreground hover:text-primary transition-colors"
                >
                  <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  hello@clubpto.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="container mx-auto px-6 lg:px-12 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-body text-sm text-muted-foreground">
            © {new Date().getFullYear()} Club PTO. Toronto, Canada.
          </p>
          <p className="font-body text-sm text-muted-foreground">
            Made with ♡ for the padel community
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;