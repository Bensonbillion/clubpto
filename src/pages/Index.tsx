import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import PhotoGallery from "@/components/PhotoGallery";
import BookingSection from "@/components/BookingSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen">
      <Hero />
      <HowItWorks />
      <PhotoGallery />
      <BookingSection />
      <Footer />
    </main>
  );
};

export default Index;