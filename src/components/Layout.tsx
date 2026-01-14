import { ReactNode } from "react";
import MobileNav from "./MobileNav";
import StickyBookCTA from "./StickyBookCTA";
import Footer from "./Footer";

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
}

const Layout = ({ children, hideFooter = false }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <MobileNav />
      <main className="flex-1 pt-14 pb-20 md:pb-0">
        {children}
      </main>
      {!hideFooter && <Footer />}
      <StickyBookCTA />
    </div>
  );
};

export default Layout;
