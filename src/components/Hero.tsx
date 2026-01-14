import { Button } from "@/components/ui/button";
import { ArrowRight, Instagram } from "lucide-react";
import heroCourt from "@/assets/hero-court.jpg";

const Hero = () => {
  const scrollToBooking = () => {
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroCourt} 
          alt="Padel court at night" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-20 p-6 lg:p-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <span className="font-display text-primary font-bold text-lg">P</span>
            </div>
            <span className="font-display text-xl tracking-wide">Club PTO</span>
          </div>
          <a 
            href="https://www.instagram.com/club_pto/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <Instagram className="w-5 h-5" />
            <span className="hidden sm:inline font-body text-sm">@club_pto</span>
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 lg:px-12 pt-24">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div 
            className="flex items-center gap-3 mb-8 opacity-0 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="h-px w-12 bg-primary" />
            <span className="font-body text-sm tracking-[0.25em] uppercase text-primary">
              Toronto's Wednesday Ritual
            </span>
          </div>

          {/* Main Headline */}
          <h1 
            className="font-display text-6xl md:text-7xl lg:text-9xl font-medium tracking-tight leading-[0.85] mb-8 opacity-0 animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            Play.<br />
            <span className="italic text-primary">Rotate.</span><br />
            Connect.
          </h1>

          {/* Subtitle */}
          <p 
            className="font-body text-lg md:text-xl text-muted-foreground max-w-lg mb-12 leading-relaxed opacity-0 animate-fade-up"
            style={{ animationDelay: "0.6s" }}
          >
            Every Wednesday at 8PM, we come together. CA$15 gets you matched, 
            played, and part of something special.
          </p>

          {/* CTA */}
          <div 
            className="flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-up"
            style={{ animationDelay: "0.8s" }}
          >
            <Button 
              size="lg" 
              onClick={scrollToBooking}
              className="group font-body text-base px-8 py-7 bg-primary hover:bg-primary/90 text-primary-foreground rounded-none transition-all duration-300 animate-pulse-glow"
            >
              Book This Wednesday
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Stats */}
          <div 
            className="flex gap-12 mt-16 pt-8 border-t border-border/50 opacity-0 animate-fade-up"
            style={{ animationDelay: "1s" }}
          >
            <div>
              <p className="font-display text-4xl md:text-5xl text-primary">8PM</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Every Wednesday</p>
            </div>
            <div>
              <p className="font-display text-4xl md:text-5xl text-primary">$15</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Per Session</p>
            </div>
            <div>
              <p className="font-display text-4xl md:text-5xl text-primary">16</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Players Max</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <span className="font-body text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-primary to-transparent" />
        </div>
      </div>
    </section>
  );
};

export default Hero;