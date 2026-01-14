import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroCourt from "@/assets/hero-court.jpg";
import playersDuo from "@/assets/players-duo.jpg";
import courtAction from "@/assets/court-action.jpg";
import groupPhoto from "@/assets/group-photo.jpg";
import gallery1 from "@/assets/gallery-1.jpg";

const Index = () => {
  return (
    <Layout hideFooter>
      {/* Hero Section - Full viewport mobile-first */}
      <section className="relative min-h-[calc(100vh-3.5rem)] flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src={heroCourt} 
            alt="Padel court at night" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-transparent md:from-background md:via-background/70 md:to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-12">
          <div className="max-w-xl">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-8 bg-primary" />
              <span className="font-body text-xs md:text-sm tracking-[0.2em] uppercase text-primary">
                Toronto's Wednesday Ritual
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-tight leading-[0.85] mb-6">
              Play.<br />
              <span className="italic text-primary">Compete.</span><br />
              Connect.
            </h1>

            {/* Subtitle */}
            <p className="font-body text-base md:text-lg text-muted-foreground max-w-md mb-8 leading-relaxed">
              Every Wednesday at 8PM, we come together to play, 
              rotate partners, and be part of something special.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/book">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto group font-body text-base px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-none transition-all duration-300"
                >
                  Book This Wednesday
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/about">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="w-full sm:w-auto font-body text-base px-8 py-6 rounded-none border-border hover:border-primary hover:text-primary"
                >
                  Learn More
                </Button>
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-8 mt-12 pt-8 border-t border-border/50">
              <div>
                <p className="font-display text-3xl md:text-4xl text-primary">8PM</p>
                <p className="font-body text-xs text-muted-foreground mt-1">Every Wednesday</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Strip - Community Showcase */}
      <section className="py-8 md:py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-accent" />
            <span className="font-body text-xs tracking-[0.2em] uppercase text-accent">
              The Community
            </span>
          </div>
          
          {/* Mobile: Horizontal scroll, Desktop: Grid */}
          <div className="flex md:grid md:grid-cols-4 gap-3 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
            <div className="flex-shrink-0 w-[75vw] md:w-auto snap-center">
              <img 
                src={playersDuo} 
                alt="Players with padel rackets" 
                className="w-full aspect-[4/5] md:aspect-square object-cover"
              />
            </div>
            <div className="flex-shrink-0 w-[75vw] md:w-auto snap-center">
              <img 
                src={courtAction} 
                alt="Padel match in action" 
                className="w-full aspect-[4/5] md:aspect-square object-cover"
              />
            </div>
            <div className="flex-shrink-0 w-[75vw] md:w-auto snap-center">
              <img 
                src={groupPhoto} 
                alt="Club PTO group" 
                className="w-full aspect-[4/5] md:aspect-square object-cover"
              />
            </div>
            <div className="flex-shrink-0 w-[75vw] md:w-auto snap-center">
              <img 
                src={gallery1} 
                alt="Wednesday night crew" 
                className="w-full aspect-[4/5] md:aspect-square object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Info Cards */}
      <section className="bg-card/50 py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-6 border border-border bg-background/50">
              <h3 className="font-display text-lg mb-2">All Levels</h3>
              <p className="font-body text-sm text-muted-foreground">
                Beginners to pros, everyone's welcome.
              </p>
            </div>
            <div className="p-6 border border-border bg-background/50">
              <h3 className="font-display text-lg mb-2">Equipment Provided</h3>
              <p className="font-body text-sm text-muted-foreground">
                Rackets and balls included. Just show up.
              </p>
            </div>
            <div className="p-6 border border-border bg-background/50">
              <h3 className="font-display text-lg mb-2">Meet New Players</h3>
              <p className="font-body text-sm text-muted-foreground">
                Expand your network on the court.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-2xl md:text-3xl mb-4">
            Ready to <span className="italic text-primary">play</span>?
          </h2>
          <p className="font-body text-muted-foreground mb-6 max-w-md mx-auto">
            Spots are limited. Reserve yours now.
          </p>
          <Link to="/book">
            <Button 
              size="lg" 
              className="group font-body text-base px-10 py-6 bg-accent hover:bg-accent/90 text-accent-foreground rounded-none"
            >
              Book Your Session
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
