import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Users, Trophy } from "lucide-react";
import heroCourt from "@/assets/hero-court.jpg";
import playersDuo from "@/assets/players-duo.jpg";
import courtAction from "@/assets/court-action.jpg";
import groupPhoto from "@/assets/group-photo.jpg";
import gallery1 from "@/assets/gallery-1.jpg";
import highlightVideo from "@/assets/highlight-video.mp4";

const Index = () => {
  return (
    <Layout hideFooter>
      {/* Hero Section - Full viewport with enhanced visuals */}
      <section className="relative min-h-[calc(100vh-3.5rem)] flex items-center overflow-hidden">
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
          {/* Subtle radial glow */}
          <div className="absolute inset-0 bg-gradient-radial opacity-50" />
          <div className="absolute inset-0 bg-gradient-radial-accent" />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-12">
          <div className="max-w-2xl">
            {/* Eyebrow with enhanced styling */}
            <div className="flex items-center gap-3 mb-8 animate-fade-up">
              <div className="h-px w-12 bg-gradient-to-r from-primary to-transparent" />
              <span className="font-body text-xs md:text-sm tracking-[0.25em] uppercase text-primary font-medium">
                Toronto's Wednesday Ritual
              </span>
            </div>

            {/* Main Headline with staggered animation */}
            <h1 className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-medium tracking-tight leading-[0.85] mb-8">
              <span className="block animate-fade-up">Play.</span>
              <span className="block italic text-gradient animate-fade-up-delay-1">Compete.</span>
              <span className="block animate-fade-up-delay-2">Connect.</span>
            </h1>

            {/* Subtitle */}
            <p className="font-body text-lg md:text-xl text-muted-foreground max-w-md mb-10 leading-relaxed animate-fade-up-delay-2">
              Every Wednesday at 8PM, we come together to play, 
              meet new players, and be part of something special.
            </p>

            {/* CTAs with enhanced styling */}
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up-delay-3">
              <Link to="/book">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto group font-body text-base px-8 py-7 bg-primary hover:bg-primary/90 text-primary-foreground rounded-none transition-all duration-300 btn-glow relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center">
                    Book This Wednesday
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </Link>
              <Link to="/about">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="w-full sm:w-auto font-body text-base px-8 py-7 rounded-none border-border/50 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-300"
                >
                  Learn More
                </Button>
              </Link>
            </div>

            {/* Quick Stats with glow effect */}
            <div className="flex gap-12 mt-16 pt-8 border-t border-border/30">
              <div className="animate-fade-up-delay-3">
                <p className="font-display text-4xl md:text-5xl text-gradient">8PM</p>
                <p className="font-body text-sm text-muted-foreground mt-2">Every Wednesday</p>
              </div>
              <div className="animate-fade-up-delay-3">
                <p className="font-display text-4xl md:text-5xl text-gradient-gold">2hrs</p>
                <p className="font-body text-sm text-muted-foreground mt-2">Of Pure Play</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-8 right-8 hidden lg:block animate-float">
          <div className="w-24 h-24 rounded-full bg-primary/10 blur-2xl" />
        </div>
      </section>

      {/* Photo Strip - Community Showcase with enhanced styling */}
      <section className="py-16 md:py-24 bg-background relative">
        {/* Subtle top gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-card/30 to-transparent" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-px w-12 bg-gradient-to-r from-accent to-transparent" />
            <span className="font-body text-sm tracking-[0.25em] uppercase text-accent font-medium">
              The Community
            </span>
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

      {/* Video Highlight Section with enhanced framing */}
      <section className="py-16 md:py-24 bg-card/30 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-px w-12 bg-gradient-to-r from-primary to-transparent" />
            <span className="font-body text-sm tracking-[0.25em] uppercase text-primary font-medium">
              See It In Action
            </span>
          </div>
          
          <div className="relative aspect-[9/16] md:aspect-video max-w-5xl mx-auto overflow-hidden">
            {/* Glow border effect */}
            <div className="absolute -inset-px bg-gradient-to-r from-primary/50 via-accent/30 to-primary/50 rounded-sm opacity-50" />
            <div className="absolute inset-0 bg-background rounded-sm m-px">
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
        </div>
      </section>

      {/* Quick Info Cards with enhanced styling */}
      <section className="py-16 md:py-24 bg-background relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl mb-4">
              Why <span className="italic text-primary">Club PTO</span>?
            </h2>
            <p className="font-body text-muted-foreground max-w-md mx-auto">
              More than just a game. It's a community.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-8 border border-border/50 bg-card/30 card-hover group">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl mb-3">All Levels</h3>
              <p className="font-body text-muted-foreground leading-relaxed">
                Beginners to pros, everyone's welcome. We match you with players at your level.
              </p>
            </div>
            <div className="p-8 border border-border/50 bg-card/30 card-hover group">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-6 group-hover:bg-accent/20 transition-colors">
                <Trophy className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-display text-xl mb-3">Equipment Provided</h3>
              <p className="font-body text-muted-foreground leading-relaxed">
                Rackets and balls included. Just show up ready to play.
              </p>
            </div>
            <div className="p-8 border border-border/50 bg-card/30 card-hover group">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-6 group-hover:bg-secondary/20 transition-colors">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-display text-xl mb-3">Meet New Players</h3>
              <p className="font-body text-muted-foreground leading-relaxed">
                Expand your network on the court. Make friends who share your passion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA with dramatic styling */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/50 to-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl mb-6">
            Ready to <span className="italic text-gradient">play</span>?
          </h2>
          <p className="font-body text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
            Spots are limited. Reserve yours now and join Toronto's fastest-growing padel community.
          </p>
          <Link to="/book">
            <Button 
              size="lg" 
              className="group font-body text-lg px-12 py-8 bg-accent hover:bg-accent/90 text-accent-foreground rounded-none btn-glow relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center">
                Book Your Session
                <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
