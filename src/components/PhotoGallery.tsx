const placeholderImages = [
  { id: 1, alt: "Players celebrating after a match" },
  { id: 2, alt: "Wednesday night padel session" },
  { id: 3, alt: "Club PTO community" },
  { id: 4, alt: "Padel court action shot" },
  { id: 5, alt: "Post-game social gathering" },
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
            href="https://instagram.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-body"
          >
            Follow @clubpto
            <span className="text-xl">→</span>
          </a>
        </div>
      </div>

      {/* Scrolling gallery */}
      <div className="flex gap-4 overflow-x-auto pb-6 px-6 lg:px-12 snap-x snap-mandatory scrollbar-hide">
        {placeholderImages.map((image) => (
          <div 
            key={image.id}
            className="flex-shrink-0 snap-start"
          >
            <div className="w-72 h-80 md:w-80 md:h-96 bg-muted rounded-lg overflow-hidden group cursor-pointer">
              {/* Placeholder - will be replaced with real images */}
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                <div className="text-center p-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-display text-2xl text-primary">{image.id}</span>
                  </div>
                  <p className="font-body text-sm text-muted-foreground">
                    {image.alt}
                  </p>
                  <p className="font-body text-xs text-muted-foreground/60 mt-2">
                    Photo placeholder
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Instagram link */}
      <div className="container mx-auto px-6 mt-6 md:hidden">
        <a 
          href="https://instagram.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-body"
        >
          Follow @clubpto on Instagram
          <span className="text-xl">→</span>
        </a>
      </div>
    </section>
  );
};

export default PhotoGallery;