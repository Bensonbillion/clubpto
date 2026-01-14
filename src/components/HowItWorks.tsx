import { CalendarCheck, Users, Trophy } from "lucide-react";

const steps = [
  {
    icon: CalendarCheck,
    number: "01",
    title: "Book Your Spot",
    description: "Reserve your place for CA$15. Wednesday 8PM, every week."
  },
  {
    icon: Users,
    number: "02", 
    title: "Show Up & Play",
    description: "We handle the pairings. You just bring your racket and energy."
  },
  {
    icon: Trophy,
    number: "03",
    title: "Rotate & Connect",
    description: "New partners each round. Leave with games played and friends made."
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 lg:py-32 bg-secondary/30">
      <div className="container mx-auto px-6 lg:px-12">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="text-sm font-body tracking-[0.2em] uppercase text-accent mb-4 block">
            The Wednesday Ritual
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold">
            How It Works
          </h2>
        </div>

        {/* Steps grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div 
              key={step.number}
              className="relative group"
            >
              {/* Connecting line (hidden on mobile, last item) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-[1px] bg-border" />
              )}
              
              <div className="bg-card rounded-lg p-8 text-center relative z-10 border border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-lg">
                {/* Icon */}
                <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>

                {/* Number */}
                <span className="font-display text-5xl font-light text-muted-foreground/20 absolute top-4 right-6">
                  {step.number}
                </span>

                {/* Content */}
                <h3 className="font-display text-2xl font-semibold mb-3">
                  {step.title}
                </h3>
                <p className="font-body text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom tagline */}
        <p className="text-center mt-16 font-display text-xl md:text-2xl text-muted-foreground italic">
          "Not your average padel club"
        </p>
      </div>
    </section>
  );
};

export default HowItWorks;