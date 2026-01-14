import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What skill level is required?",
    answer: "All skill levels are welcome! Our sessions are designed to be inclusive, whether you're picking up a padel racket for the first time or you're an experienced player."
  },
  {
    question: "What should I bring?",
    answer: "Just bring yourself and comfortable athletic clothing. Padel rackets and balls are provided. We recommend indoor court shoes, but regular sneakers work fine."
  },
  {
    question: "What time do sessions start and end?",
    answer: "Sessions start at 8PM and typically run for about 1.5 to 2 hours, depending on the group size and energy level."
  },
  {
    question: "How does the booking work?",
    answer: "Simply select an upcoming Wednesday session and reserve your spot online. You can book multiple spots if you're bringing friends."
  },
  {
    question: "What's the cancellation policy?",
    answer: "Please cancel at least 24 hours in advance so we can open your spot for others. Contact us directly if you need to cancel."
  },
  {
    question: "Where is the session held?",
    answer: "Sessions are held at our partner padel facility. The exact address will be sent to you via email after booking."
  }
];

const FAQPage = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 md:py-16">
        {/* Page Header */}
        <div className="text-center mb-8 md:mb-12">
          <span className="font-body text-sm tracking-[0.25em] uppercase text-accent mb-3 block">
            Got Questions?
          </span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium mb-4">
            Frequently <span className="italic text-primary">Asked</span>
          </h1>
          <p className="font-body text-muted-foreground">
            Everything you need to know about Wednesday Padel
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-2">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="border border-border bg-card/30 px-4"
              >
                <AccordionTrigger className="text-left font-display text-base md:text-lg py-4 hover:no-underline hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="font-body text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* CTA */}
          <div className="text-center mt-12 p-8 bg-muted/30 border border-border">
            <h2 className="font-display text-xl mb-2">Ready to play?</h2>
            <p className="font-body text-sm text-muted-foreground mb-6">
              Join us this Wednesday and experience the community.
            </p>
            <Link to="/book">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-body h-12 px-8 rounded-none group">
                Book Your Session
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FAQPage;
