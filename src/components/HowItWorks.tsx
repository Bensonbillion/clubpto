import padelDetail from "@/assets/padel-detail.jpg";

const steps = [
  {
    number: "01",
    title: "Book",
    description: "Reserve your spot online. CA$15, that's it."
  },
  {
    number: "02", 
    title: "Show Up",
    description: "Wednesday, 8PM. Bring your racket and energy."
  },
  {
    number: "03",
    title: "Play & Rotate",
    description: "New partners each round. Games guaranteed."
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="relative py-32 lg:py-40 overflow-hidden">
      {/* Background accent */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-[600px] bg-gradient-radial opacity-30" />
      
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Image */}
          <div className="relative">
            <div className="aspect-square relative">
              <img 
                src={padelDetail} 
                alt="Padel equipment" 
                className="w-full h-full object-cover"
              />
              {/* Decorative frame */}
              <div className="absolute -top-4 -left-4 w-24 h-24 border-l-2 border-t-2 border-primary" />
              <div className="absolute -bottom-4 -right-4 w-24 h-24 border-r-2 border-b-2 border-accent" />
            </div>
            
            {/* Floating badge */}
            <div className="absolute -bottom-6 -right-6 lg:bottom-12 lg:-right-12 bg-card border border-border p-6 shadow-2xl">
              <p className="font-display text-5xl text-gradient">Wed</p>
              <p className="font-body text-sm text-muted-foreground mt-1">8:00 PM</p>
            </div>
          </div>

          {/* Right: Content */}
          <div>
            <div className="mb-12">
              <span className="font-body text-sm tracking-[0.25em] uppercase text-accent mb-4 block">
                How It Works
              </span>
              <h2 className="font-display text-5xl md:text-6xl lg:text-7xl font-medium leading-[0.9]">
                Simple.<br />
                <span className="italic text-primary">Social.</span><br />
                Addictive.
              </h2>
            </div>

            {/* Steps */}
            <div className="space-y-8">
              {steps.map((step, index) => (
                <div 
                  key={step.number}
                  className="group flex gap-6 items-start p-6 border-l-2 border-border hover:border-primary transition-colors duration-300"
                >
                  <span className="font-display text-4xl text-muted-foreground/30 group-hover:text-primary/50 transition-colors">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl mb-2 group-hover:text-primary transition-colors">
                      {step.title}
                    </h3>
                    <p className="font-body text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;