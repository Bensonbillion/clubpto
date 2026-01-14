import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import gallery4 from "@/assets/gallery-4.jpg";

const galleryImages = [
  { id: 1, src: gallery1, alt: "Club PTO members after a match" },
  { id: 2, src: gallery2, alt: "Club PTO community vibes" },
  { id: 3, src: gallery3, alt: "Players on the padel court" },
  { id: 4, src: gallery4, alt: "Wednesday night crew" },
];

const PhotoGallery = () => {
  return (
    <section className="py-24 lg:py-32 overflow-hidden">
      <div className="container mx-auto px-6 lg:px-12 mb-12">
        <div className="flex justify-between items-end">
          <div>
            <span className="text-sm font-body tracking-[0.2em] uppercase text-accent mb-4 block">
              The Community
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold">
              Wednesdays in Action
            </h2>
          </div>
          <a 
            href="https://www.instagram.com/club_pto/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-body"
          >
            Follow @club_pto
            <span className="text-xl">→</span>
          </a>
        </div>
      </div>

      {/* Scrolling gallery */}
      <div className="flex gap-4 overflow-x-auto pb-6 px-6 lg:px-12 snap-x snap-mandatory scrollbar-hide">
        {galleryImages.map((image) => (
          <div 
            key={image.id}
            className="flex-shrink-0 snap-start"
          >
            <div className="w-72 h-80 md:w-80 md:h-96 rounded-lg overflow-hidden group cursor-pointer">
              <img 
                src={image.src} 
                alt={image.alt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Instagram link */}
      <div className="container mx-auto px-6 mt-6 md:hidden">
        <a 
          href="https://www.instagram.com/club_pto/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-body"
        >
          Follow @club_pto on Instagram
          <span className="text-xl">→</span>
        </a>
      </div>
    </section>
  );
};

export default PhotoGallery;