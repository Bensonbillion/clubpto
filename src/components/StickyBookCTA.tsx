import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const StickyBookCTA = () => {
  const location = useLocation();
  
  // Don't show on the booking page itself
  if (location.pathname === "/book") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-sm border-t border-border p-4 safe-area-bottom">
      <Link to="/book">
        <Button 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-body h-14 text-base rounded-none group"
        >
          Book Your Session
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </Link>
    </div>
  );
};

export default StickyBookCTA;
