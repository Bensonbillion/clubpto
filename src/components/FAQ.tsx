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

const FAQ = () => {
  return (
    <section id="faq" className="py-24 px-6 bg-muted/30">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-muted-foreground text-center mb-12">
          Everything you need to know about Wednesday Padel
        </p>
        
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQ;
