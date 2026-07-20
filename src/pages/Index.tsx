import PageWrapper from "@/components/layout/PageWrapper";
import Hero from "@/components/home/Hero";
import Ticker from "@/components/home/Ticker";
import Manifesto from "@/components/home/Manifesto";
import NextUp from "@/components/home/NextUp";
import Wall from "@/components/home/Wall";
import FinalCTA from "@/components/home/FinalCTA";

const Index = () => {
  return (
    <PageWrapper>
      <Hero />
      <Ticker />
      <Manifesto />
      <NextUp />
      <Wall />
      <FinalCTA />
    </PageWrapper>
  );
};

export default Index;
