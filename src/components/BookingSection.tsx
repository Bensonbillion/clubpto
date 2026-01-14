import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessions, Session } from "@/hooks/useSessions";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, Loader2, ArrowRight, Check, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BookingSection = () => {
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
      // Create booking entries for each ticket
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

  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const incrementQuantity = () => {
    if (quantity < 8) setQuantity(quantity + 1);
  };

  return (
    <section id="booking" className="relative py-32 lg:py-40">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
      
      <div className="relative container mx-auto px-6 lg:px-12">
        {/* Section header */}
        <div className="text-center mb-16 lg:mb-24">
          <span className="font-body text-sm tracking-[0.25em] uppercase text-accent mb-4 block">
            Join Us
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-8xl font-medium mb-6">
            Book Your <span className="italic text-primary">Wednesday</span>
          </h2>
          <p className="font-body text-lg text-muted-foreground max-w-xl mx-auto">
            All skill levels welcome
          </p>
        </div>

        {isSuccess ? (
          <div className="max-w-xl mx-auto text-center py-16">
            <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-primary/20 border border-primary flex items-center justify-center">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <h3 className="font-display text-3xl mb-4">You're Booked!</h3>
            <p className="font-body text-muted-foreground mb-8">
              We've sent a confirmation to your email. See you on the court.
            </p>
            <Button onClick={resetForm} variant="outline" className="rounded-none">
              Book Another Session
            </Button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-16">
                Unable to load sessions. Please try again later.
              </p>
            ) : (
              <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
                {/* Session Selection - 3 columns */}
                <div className="lg:col-span-3">
                  <h3 className="font-display text-xl mb-6 flex items-center gap-3">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    Select Date
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {sessions?.map((session) => {
                      const { day, date } = formatSessionDate(session.session_date);
                      const isSelected = selectedSession?.id === session.id;

                      return (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className={`
                            relative p-6 text-left transition-all duration-300 border overflow-hidden cursor-pointer
                            ${isSelected 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "bg-card/50 border-border hover:border-primary/50"
                            }
                          `}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3">
                              <Check className="w-5 h-5" />
                            </div>
                          )}
                          <p className="font-display text-3xl mb-1">{day}</p>
                          <p className={`font-body text-sm ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {date}
                          </p>
                          <div className="mt-4 flex items-center gap-4 text-sm">
                            <span className={`flex items-center gap-1 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              <Clock className="w-4 h-4" />
                              8PM
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Booking Form - 2 columns */}
                <div className="lg:col-span-2">
                  <h3 className="font-display text-xl mb-6">Your Details</h3>
                  
                  {selectedSession ? (
                    <form onSubmit={handleBooking} className="space-y-6">
                      <div className="p-4 bg-muted/30 border border-border mb-6">
                        <p className="font-display text-lg">
                          {formatSessionDate(selectedSession.session_date).dayFull}
                        </p>
                        <p className="font-body text-sm text-muted-foreground">
                          {formatSessionDate(selectedSession.session_date).dateFull} at 8:00 PM
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
                            className="w-12 h-12 border border-border flex items-center justify-center hover:border-primary transition-colors disabled:opacity-30"
                            disabled={quantity <= 1}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-display text-2xl w-8 text-center">{quantity}</span>
                          <button
                            type="button"
                            onClick={incrementQuantity}
                            className="w-12 h-12 border border-border flex items-center justify-center hover:border-primary transition-colors disabled:opacity-30"
                            disabled={quantity >= 8}
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
                      <p className="text-center text-xs text-muted-foreground">
                        Payment on arrival • Free cancellation
                      </p>
                    </form>
                  ) : (
                    <div className="h-full flex items-center justify-center py-16 border border-dashed border-border">
                      <div className="text-center text-muted-foreground">
                        <CalendarDays className="w-8 h-8 mx-auto mb-3 opacity-50" />
                        <p className="font-body text-sm">Select a date to continue</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default BookingSection;