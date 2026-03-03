import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessions, Session } from "@/hooks/useSessions";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, Loader2, ArrowRight, Check, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Book = () => {
  const { data: sessions, isLoading, error } = useSessions();
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const formatSessionDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return {
      day: format(date, "EEE"),
      dayFull: format(date, "EEEE"),
      date: format(date, "MMM d"),
      dateFull: format(date, "MMMM d, yyyy"),
    };
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !name || !email) return;

    setIsSubmitting(true);
    try {
      const bookings = Array.from({ length: quantity }, () => ({
        session_id: selectedSession.id,
        customer_name: name,
        customer_email: email,
        payment_status: "pending",
      }));

      const { error } = await supabase.from("bookings").insert(bookings);

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "You're in! 🎾",
        description: `${quantity} spot${quantity > 1 ? 's' : ''} reserved. Check your email for confirmation.`,
      });
    } catch (err) {
      toast({
        title: "Booking Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setSelectedSession(null);
    setQuantity(1);
    setIsSuccess(false);
  };

  const maxAvailable = selectedSession ? Math.min(selectedSession.spots_remaining, 8) : 8;

  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const incrementQuantity = () => {
    if (quantity < maxAvailable) setQuantity(quantity + 1);
  };

  const handleSessionSelect = (session: Session) => {
    setSelectedSession(session);
    if (quantity > session.spots_remaining) {
      setQuantity(Math.max(1, session.spots_remaining));
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8 md:py-16 relative">
        {/* Background glow */}
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Page Header */}
        <div className="text-center mb-12 md:mb-16 relative z-10">
          <span className="font-body text-sm tracking-[0.25em] uppercase text-accent mb-4 block animate-fade-up">
            Reserve Your Spot
          </span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium mb-6 animate-fade-up-delay-1">
            Book Your <span className="italic text-gradient">Wednesday</span>
          </h1>
          <p className="font-body text-lg text-muted-foreground max-w-md mx-auto animate-fade-up-delay-2">
            All skill levels welcome. Reserve now, pay later.
          </p>
        </div>

        {isSuccess ? (
          <div className="max-w-md mx-auto text-center py-12 relative z-10">
            <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center animate-fade-in-scale glow-primary">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <h2 className="font-display text-3xl mb-4">You're Booked!</h2>
            <p className="font-body text-muted-foreground mb-8 text-lg">
              We've sent a confirmation to your email. See you on the court.
            </p>
            <Button onClick={resetForm} variant="outline" className="rounded-none px-8 py-6 hover:border-primary hover:text-primary">
              Book Another Session
            </Button>
          </div>
        ) : (
          <>
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-16">
                Unable to load sessions. Please try again later.
              </p>
            ) : (
              <div className="max-w-lg mx-auto space-y-8">
                {/* Step 1: Select Date */}
                <div>
                  <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">1</span>
                    Select Date
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {sessions?.map((session) => {
                      const { day, date } = formatSessionDate(session.session_date);
                      const isSelected = selectedSession?.id === session.id;
                      const isSoldOut = session.spots_remaining <= 0;

                      return (
                        <button
                          key={session.id}
                          onClick={() => !isSoldOut && handleSessionSelect(session)}
                          disabled={isSoldOut}
                          className={`
                            relative p-4 text-left transition-all duration-300 border overflow-hidden
                            ${isSoldOut
                              ? "bg-muted/30 border-border opacity-60 cursor-not-allowed"
                              : isSelected 
                                ? "bg-primary text-primary-foreground border-primary" 
                                : "bg-card/50 border-border hover:border-primary/50 active:scale-[0.98]"
                            }
                          `}
                        >
                          {isSoldOut && (
                            <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground px-2 py-0.5 text-xs font-body uppercase tracking-wider">
                              Sold Out
                            </div>
                          )}
                          {isSelected && !isSoldOut && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                          <p className={`font-display text-2xl mb-0.5 ${isSoldOut ? "text-muted-foreground" : ""}`}>{day}</p>
                          <p className={`font-body text-sm ${isSoldOut ? "text-muted-foreground" : isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {date}
                          </p>
                          <div className="mt-2 flex items-center gap-1 text-xs">
                            <Clock className="w-3 h-3" />
                            <span className={isSoldOut ? "text-muted-foreground" : isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}>8PM</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Your Details */}
                {selectedSession && (
                  <form onSubmit={handleBooking} className="space-y-6 animate-fade-up">
                    <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">2</span>
                      Your Details
                    </h2>

                    <div className="p-4 bg-muted/30 border border-border">
                      <p className="font-display text-lg">
                        {formatSessionDate(selectedSession.session_date).dayFull}
                      </p>
                      <p className="font-body text-sm text-muted-foreground">
                        {formatSessionDate(selectedSession.session_date).dateFull} at 8:00 PM
                      </p>
                      <p className="font-body text-xs text-primary mt-2">
                        {selectedSession.spots_remaining} spots remaining
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name" className="font-body text-sm">Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        required
                        className="bg-muted/30 border-border rounded-none h-12 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-body text-sm">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="bg-muted/30 border-border rounded-none h-12 focus:border-primary"
                      />
                    </div>

                    {/* Quantity Selector */}
                    <div className="space-y-2">
                      <Label className="font-body text-sm">Number of Spots</Label>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={decrementQuantity}
                          className="w-12 h-12 border border-border flex items-center justify-center hover:border-primary transition-colors disabled:opacity-30 active:scale-95"
                          disabled={quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-display text-2xl w-8 text-center">{quantity}</span>
                        <button
                          type="button"
                          onClick={incrementQuantity}
                          className="w-12 h-12 border border-border flex items-center justify-center hover:border-primary transition-colors disabled:opacity-30 active:scale-95"
                          disabled={quantity >= maxAvailable}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="font-body text-sm text-muted-foreground">
                          {quantity === 1 ? "spot" : "spots"}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-body h-14 text-base rounded-none group"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Reserving...
                        </>
                      ) : (
                        <>
                          Reserve {quantity} {quantity === 1 ? "Spot" : "Spots"}
                          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Book;
