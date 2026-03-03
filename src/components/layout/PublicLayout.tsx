import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";

const PublicLayout = () => {
  useSmoothScroll();

  return (
    <div className="min-h-screen bg-dark text-cream font-body font-light">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
