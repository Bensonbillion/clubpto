import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

const Hero = () => {
  const scrollToBooking = () => {
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="min-h-screen flex items-center relative overflow-hidden">
      {/* Subtle decorative elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-secondary/50 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-6 lg:px-12 relative z-10">
        <div className="max-w-3xl">
          {/* Logo/Brand mark */}
          <div className="mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <span className="text-sm font-body tracking-[0.3em] uppercase text-muted-foreground">
              Club PTO
            </span>
          </div>

          {/* Main headline */}
          <h1 
            className="font-display text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[0.9] mb-6 animate-fade-in opacity-0"
            style={{ animationDelay: "0.2s" }}
          >
            Play.<br />
            Rotate.<br />
            <span className="text-accent">Connect.</span>
          </h1>

          {/* Subheadline */}
          <p 
            className="font-body text-lg md:text-xl text-muted-foreground max-w-xl mb-10 animate-fade-in opacity-0"
            style={{ animationDelay: "0.4s" }}
          >
            Every Wednesday at 8PM, Toronto's padel community comes together. 
            CA$15 gets you matched, played, and part of the club.
          </p>

          {/* CTAs */}
          <div 
            className="flex flex-col sm:flex-row gap-4 animate-fade-in opacity-0"
            style={{ animationDelay: "0.6s" }}
          >
            <Button 
              size="lg" 
              onClick={scrollToBooking}
              className="font-body text-base px-8 py-6 bg-primary hover:bg-primary/90 transition-all duration-300"
            >
              Book Wednesday
            </Button>
            <Button 
              variant="ghost" 
              size="lg"
              onClick={scrollToHowItWorks}
              className="font-body text-base text-muted-foreground hover:text-foreground group"
            >
              How It Works
              <ArrowDown className="ml-2 h-4 w-4 group-hover:translate-y-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
          <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default Hero;