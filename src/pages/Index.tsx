import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroCourt from "@/assets/hero-court.jpg";
import playersDuo from "@/assets/players-duo.jpg";
import courtAction from "@/assets/court-action.jpg";
import groupPhoto from "@/assets/group-photo.jpg";
import gallery1 from "@/assets/gallery-1.jpg";
import highlightVideo from "@/assets/highlight-video.mp4";

const Index = () => {
  return (
    <Layout hideFooter>
      {/* Top Banner - Club Identity */}
      <div className="bg-primary/10 border-b border-primary/20 py-2 text-center animate-fade-up">
        <span className="font-body text-[10px] md:text-xs tracking-[0.3em] uppercase text-primary/90 font-medium">
          Toronto's Weekly Padel Social
        </span>
      </div>

      {/* Hero Section - Full viewport with enhanced visuals */}
      <section className="relative min-h-[calc(100vh-4rem)] flex items-center overflow-hidden">
        {/* Background Image with enhanced overlays */}
        <div className="absolute inset-0 z-0">
          <img 
            src={heroCourt} 
            alt="Padel court at night" 
            className="w-full h-full object-cover scale-105"
          />
          {/* Multi-layer gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-12">
          <div className="max-w-2xl">
            {/* Urgency Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/20 border border-accent/40 mb-8 animate-fade-up">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="font-body text-xs tracking-wide uppercase text-accent font-medium">
                Limited spots · Wednesdays 8PM
              </span>
            </div>

            {/* Main Headline - Bigger statement */}
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-tight leading-[0.9] mb-6">
              <span className="block animate-fade-up text-foreground/90">The Wednesday</span>
              <span className="block animate-fade-up-delay-1">
                <span className="italic text-gradient">Padel</span> Night
              </span>
              <span className="block animate-fade-up-delay-2 text-foreground/90">You've Been</span>
              <span className="block animate-fade-up-delay-2">
                <span className="italic text-gradient-gold">Missing</span>
              </span>
            </h1>

            {/* Subtitle - More specific value prop */}
            <p className="font-body text-base md:text-lg text-muted-foreground max-w-md mb-8 leading-relaxed animate-fade-up-delay-2">
              2 hours of rotating matches, cold drinks after, and a crew that actually shows up. Every week.
            </p>

            {/* Single Strong CTA */}
            <div className="animate-fade-up-delay-3">
              <Link to="/book">
                <Button 
                  size="lg" 
                  className="group font-body text-base px-10 py-8 bg-accent hover:bg-accent/90 text-accent-foreground rounded-none transition-all duration-300 btn-glow relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center">
                    Grab Your Spot
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </Link>
              <p className="font-body text-xs text-muted-foreground mt-3 animate-fade-up-delay-3">
                $35/session · Equipment included
              </p>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-fade-up-delay-3">
          <div className="flex flex-col items-center gap-2">
            <div className="w-px h-10 bg-gradient-to-b from-primary/50 to-transparent animate-pulse" />
          </div>
        </div>
      </section>

      {/* Social Proof - Community Showcase */}
      <section className="py-16 md:py-20 bg-background relative">
        <div className="container mx-auto px-4 relative z-10">
          {/* Section intro */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <span className="font-body text-xs tracking-[0.25em] uppercase text-primary/70 mb-2 block">
                Every Wednesday
              </span>
              <h2 className="font-display text-2xl md:text-3xl">
                This is <span className="italic text-primary">Club PTO</span>
              </h2>
            </div>
            <a 
              href="https://www.instagram.com/club_pto/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-body text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              @club_pto →
            </a>
          </div>
          
          {/* Mobile: Horizontal scroll, Desktop: Grid with hover effects */}
          <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory scrollbar-hide">
            <div className="flex-shrink-0 w-[75vw] md:w-auto snap-center group relative overflow-hidden">
              <img 
                src={playersDuo} 
                alt="Players with padel rackets" 
                className="w-full aspect-[4/5] md:aspect-square object-cover img-hover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            <div className="flex-shrink-0 w-[75vw] md:w-auto snap-center group relative overflow-hidden">
              <img 
                src={courtAction} 
                alt="Padel match in action" 
                className="w-full aspect-[4/5] md:aspect-square object-cover img-hover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            <div className="flex-shrink-0 w-[75vw] md:w-auto snap-center group relative overflow-hidden">
              <img 
                src={groupPhoto} 
                alt="Club PTO group" 
                className="w-full aspect-[4/5] md:aspect-square object-cover img-hover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            <div className="flex-shrink-0 w-[75vw] md:w-auto snap-center group relative overflow-hidden">
              <img 
                src={gallery1} 
                alt="Wednesday night crew" 
                className="w-full aspect-[4/5] md:aspect-square object-cover img-hover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          </div>
        </div>
      </section>

      {/* Video Section - Simple, clean */}
      <section className="py-12 md:py-16 bg-card/20 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="relative aspect-[9/16] md:aspect-video max-w-4xl mx-auto overflow-hidden">
            <video 
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            >
              <source src={highlightVideo} type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* How It Works - Clear, scannable */}
      <section className="py-16 md:py-20 bg-background relative">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-2xl md:text-3xl mb-10 text-center">
              Here's the deal
            </h2>
            
            <div className="grid gap-6">
              <div className="flex gap-6 items-start">
                <div className="w-10 h-10 flex-shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="font-display text-primary text-lg">1</span>
                </div>
                <div>
                  <h3 className="font-display text-lg mb-1">Book your spot</h3>
                  <p className="font-body text-muted-foreground text-sm">
                    $35 gets you 2 hours, equipment, and a guaranteed good time.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-6 items-start">
                <div className="w-10 h-10 flex-shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="font-display text-primary text-lg">2</span>
                </div>
                <div>
                  <h3 className="font-display text-lg mb-1">Show up at 8PM Wednesday</h3>
                  <p className="font-body text-muted-foreground text-sm">
                    We'll match you with players at your level. Beginners to pros, everyone's welcome.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-6 items-start">
                <div className="w-10 h-10 flex-shrink-0 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="font-display text-accent text-lg">3</span>
                </div>
                <div>
                  <h3 className="font-display text-lg mb-1">Play, rotate, repeat</h3>
                  <p className="font-body text-muted-foreground text-sm">
                    Meet new people every match. Grab drinks after. Come back next week.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA - Urgency driven */}
      <section className="py-20 md:py-28 relative overflow-hidden bg-card/30">
        <div className="container mx-auto px-4 text-center relative z-10">
          {/* Urgency element */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="font-body text-xs tracking-wide uppercase text-accent">
              Spots fill up fast
            </span>
          </div>
          
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl mb-4">
            See you <span className="italic text-primary">Wednesday</span>?
          </h2>
          <p className="font-body text-muted-foreground mb-8 max-w-md mx-auto">
            Join 50+ players who've made this their weekly ritual.
          </p>
          <Link to="/book">
            <Button 
              size="lg" 
              className="group font-body text-base px-10 py-8 bg-accent hover:bg-accent/90 text-accent-foreground rounded-none btn-glow"
            >
              <span className="flex items-center">
                Reserve Your Spot
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
