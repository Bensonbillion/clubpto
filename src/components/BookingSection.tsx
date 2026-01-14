import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useSessions, Session } from "@/hooks/useSessions";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BookingSection = () => {
  const { data: sessions, isLoading, error } = useSessions();
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const formatSessionDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return {
      day: format(date, "EEEE"),
      date: format(date, "MMMM d"),
      short: format(date, "MMM d"),
    };
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !name || !email) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("bookings").insert({
        session_id: selectedSession.id,
        customer_name: name,
        customer_email: email,
        payment_status: "pending", // Will be updated when Stripe is integrated
      });

      if (error) throw error;

      toast({
        title: "Booking Reserved!",
        description: "We'll send payment details to your email shortly.",
      });

      setName("");
      setEmail("");
      setSelectedSession(null);
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

  return (
    <section id="booking" className="py-24 lg:py-32 bg-primary text-primary-foreground">
      <div className="container mx-auto px-6 lg:px-12">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="text-sm font-body tracking-[0.2em] uppercase text-primary-foreground/60 mb-4 block">
            Join the Club
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold mb-4">
            Book Your Wednesday
          </h2>
          <p className="font-body text-lg text-primary-foreground/70 max-w-xl mx-auto">
            CA$15 per session • Limited spots • All levels welcome
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-foreground/50" />
            </div>
          ) : error ? (
            <p className="text-center text-primary-foreground/70">
              Unable to load sessions. Please try again later.
            </p>
          ) : (
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Session Selection */}
              <div>
                <h3 className="font-display text-2xl mb-6">Select a Date</h3>
                <div className="grid gap-3">
                  {sessions?.map((session) => {
                    const { day, date } = formatSessionDate(session.session_date);
                    const isFull = session.spots_remaining === 0;
                    const isSelected = selectedSession?.id === session.id;

                    return (
                      <button
                        key={session.id}
                        onClick={() => !isFull && setSelectedSession(session)}
                        disabled={isFull}
                        className={`
                          w-full p-4 rounded-lg border text-left transition-all duration-200
                          ${isSelected 
                            ? "bg-primary-foreground text-primary border-primary-foreground" 
                            : "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20"
                          }
                          ${isFull ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        `}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-display text-lg font-semibold">{day}</p>
                            <p className={`font-body text-sm ${isSelected ? "text-primary/70" : "text-primary-foreground/70"}`}>
                              {date}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className={`flex items-center gap-1 text-sm ${isSelected ? "text-primary/70" : "text-primary-foreground/70"}`}>
                              <Clock className="w-4 h-4" />
                              <span>8:00 PM</span>
                            </div>
                            <div className={`flex items-center gap-1 text-sm mt-1 ${isFull ? "text-accent" : isSelected ? "text-primary/70" : "text-primary-foreground/70"}`}>
                              <Users className="w-4 h-4" />
                              <span>{isFull ? "Full" : `${session.spots_remaining} spots`}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Booking Form */}
              <div>
                <h3 className="font-display text-2xl mb-6">Your Details</h3>
                <Card className="bg-primary-foreground/10 border-primary-foreground/20">
                  <CardContent className="p-6">
                    {selectedSession ? (
                      <form onSubmit={handleBooking} className="space-y-5">
                        <div className="p-3 bg-primary-foreground/10 rounded-lg mb-6">
                          <div className="flex items-center gap-2 text-primary-foreground/80">
                            <CalendarDays className="w-5 h-5" />
                            <span className="font-body">
                              {formatSessionDate(selectedSession.session_date).day}, {formatSessionDate(selectedSession.session_date).date} at 8:00 PM
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-primary-foreground">Name</Label>
                          <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your full name"
                            required
                            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-primary-foreground">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40"
                          />
                        </div>

                        <div className="pt-4">
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-body py-6 text-lg"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Reserving...
                              </>
                            ) : (
                              <>Reserve Spot — CA$15</>
                            )}
                          </Button>
                          <p className="text-center text-sm text-primary-foreground/50 mt-3">
                            Payment integration coming soon
                          </p>
                        </div>
                      </form>
                    ) : (
                      <div className="py-12 text-center text-primary-foreground/60">
                        <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="font-body">Select a session date to continue</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default BookingSection;