import PageWrapper from "@/components/layout/PageWrapper";
import Hero from "@/components/home/Hero";
import Ticker from "@/components/home/Ticker";
import Scoreboard from "@/components/home/Scoreboard";
import Manifesto from "@/components/home/Manifesto";
import Experience from "@/components/home/Experience";
import NextUp from "@/components/home/NextUp";
import Wall from "@/components/home/Wall";
import FinalCTA from "@/components/home/FinalCTA";

const Index = () => {
  return (
    <PageWrapper>
      <Hero />
      <Ticker />
      <Scoreboard />
      <Manifesto />
      <Experience />
      <NextUp />
      <Wall />
      <FinalCTA />
    </PageWrapper>
  );
};

export default Index;
