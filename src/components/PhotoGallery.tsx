import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import gallery4 from "@/assets/gallery-4.jpg";
import playersDuo from "@/assets/players-duo.jpg";
import courtAction from "@/assets/court-action.jpg";
import groupPhoto from "@/assets/group-photo.jpg";
import { Instagram } from "lucide-react";

const galleryImages = [
  { id: 1, src: groupPhoto, alt: "Club PTO group" },
  { id: 2, src: gallery1, alt: "Club PTO members after a match" },
  { id: 3, src: playersDuo, alt: "Players with padel rackets" },
  { id: 4, src: courtAction, alt: "Padel match in action" },
  { id: 5, src: gallery2, alt: "Club PTO community vibes" },
  { id: 6, src: gallery3, alt: "Players on the padel court" },
  { id: 7, src: gallery4, alt: "Wednesday night crew" },
];

const PhotoGallery = () => {
  return (
    <section className="py-32 lg:py-40 overflow-hidden bg-card/50">
      {/* Section Header */}
      <div className="container mx-auto px-6 lg:px-12 mb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
            <span className="font-body text-sm tracking-[0.25em] uppercase text-accent mb-4 block">
              The Community
            </span>
            <h2 className="font-display text-5xl md:text-6xl lg:text-7xl font-medium">
              Wednesday<br />
              <span className="italic text-primary">Nights</span>
            </h2>
          </div>
          <a 
            href="https://www.instagram.com/club_pto/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors font-body"
          >
            <Instagram className="w-5 h-5" />
            <span>Follow the journey</span>
            <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
          </a>
        </div>
      </div>

      {/* Bento Grid Gallery */}
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          {/* Large featured image */}
          <div className="col-span-2 row-span-2 group relative overflow-hidden">
            <img 
              src={galleryImages[0].src} 
              alt={galleryImages[0].alt}
              className="w-full h-full object-cover aspect-square transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-0 left-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-4 group-hover:translate-y-0">
              <p className="font-display text-xl text-primary">The Crew</p>
            </div>
          </div>

          {/* Grid images */}
          {galleryImages.slice(1, 5).map((image) => (
            <div 
              key={image.id}
              className="group relative overflow-hidden aspect-square"
            >
              <img 
                src={image.src} 
                alt={image.alt}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ))}

          {/* Quote card */}
          <div className="col-span-1 bg-muted/30 border border-border p-6 flex flex-col justify-center">
            <blockquote className="font-display text-lg md:text-xl italic leading-relaxed">
              "Not your average padel club"
            </blockquote>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-8 h-px bg-accent" />
              <span className="font-body text-sm text-accent">Club PTO</span>
            </div>
          </div>

          {/* More images */}
          {galleryImages.slice(5).map((image) => (
            <div 
              key={image.id}
              className="group relative overflow-hidden aspect-square"
            >
              <img 
                src={image.src} 
                alt={image.alt}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PhotoGallery;
