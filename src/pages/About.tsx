import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Instagram } from "lucide-react";
import padelDetail from "@/assets/padel-detail.jpg";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import gallery4 from "@/assets/gallery-4.jpg";

const steps = [
  {
    number: "01",
    title: "Book",
    description: "Reserve your spot online. Quick and easy."
  },
  {
    number: "02", 
    title: "Show Up",
    description: "Wednesday, 8PM. Bring your racket and energy."
  },
  {
    number: "03",
    title: "Play & Connect",
    description: "Compete, meet new players, have fun."
  }
];

const galleryImages = [
  { id: 1, src: gallery1, alt: "Club PTO members after a match" },
  { id: 2, src: gallery2, alt: "Club PTO community vibes" },
  { id: 3, src: gallery3, alt: "Players on the padel court" },
  { id: 4, src: gallery4, alt: "Wednesday night crew" },
];

const About = () => {
  return (
    <Layout>
      {/* How It Works */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          {/* Section Header */}
          <div className="text-center mb-10 md:mb-16">
            <span className="font-body text-sm tracking-[0.25em] uppercase text-accent mb-3 block">
              How It Works
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium leading-tight">
              Simple.<br className="md:hidden" />
              <span className="italic text-primary"> Social.</span><br className="md:hidden" />
              <span> Addictive.</span>
            </h1>
          </div>

          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center max-w-5xl mx-auto">
            {/* Image */}
            <div className="relative order-2 md:order-1">
              <div className="aspect-square relative">
                <img 
                  src={padelDetail} 
                  alt="Padel equipment" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute -top-3 -left-3 w-16 h-16 border-l-2 border-t-2 border-primary" />
                <div className="absolute -bottom-3 -right-3 w-16 h-16 border-r-2 border-b-2 border-accent" />
              </div>
              
              <div className="absolute -bottom-4 right-4 md:-right-8 bg-card border border-border p-4 shadow-2xl">
                <p className="font-display text-3xl text-gradient">Wed</p>
                <p className="font-body text-xs text-muted-foreground mt-1">8:00 PM</p>
              </div>
            </div>

            {/* Steps */}
            <div className="order-1 md:order-2 space-y-6">
              {steps.map((step) => (
                <div 
                  key={step.number}
                  className="group flex gap-4 items-start p-4 border-l-2 border-border hover:border-primary transition-colors duration-300"
                >
                  <span className="font-display text-3xl text-muted-foreground/30 group-hover:text-primary/50 transition-colors">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="font-display text-xl mb-1 group-hover:text-primary transition-colors">
                      {step.title}
                    </h3>
                    <p className="font-body text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}

              <div className="pt-4">
                <Link to="/book">
                  <Button className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-body h-12 px-8 rounded-none group">
                    Book Now
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-12 md:py-20 bg-card/50">
        <div className="container mx-auto px-4">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
            <div>
              <span className="font-body text-sm tracking-[0.25em] uppercase text-accent mb-3 block">
                The Community
              </span>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-medium">
                Wednesday <span className="italic text-primary">Nights</span>
              </h2>
            </div>
            <a 
              href="https://www.instagram.com/club_pto/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-body text-sm"
            >
              <Instagram className="w-4 h-4" />
              <span>Follow the journey</span>
              <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </div>

          {/* Responsive Gallery Grid */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {/* Featured Image */}
            <div className="col-span-2 md:col-span-1 md:row-span-2 group relative overflow-hidden aspect-square">
              <img 
                src={galleryImages[0].src} 
                alt={galleryImages[0].alt}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>

            {/* Other Images */}
            {galleryImages.slice(1).map((image) => (
              <div 
                key={image.id}
                className="group relative overflow-hidden aspect-square"
              >
                <img 
                  src={image.src} 
                  alt={image.alt}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            ))}

            {/* Quote Card */}
            <div className="col-span-2 md:col-span-1 bg-muted/30 border border-border p-6 flex flex-col justify-center">
              <blockquote className="font-display text-xl md:text-2xl italic leading-relaxed">
                "Not your average padel club"
              </blockquote>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-6 h-px bg-accent" />
                <span className="font-body text-sm text-accent">Club PTO</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
