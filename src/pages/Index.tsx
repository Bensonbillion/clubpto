import PageWrapper from "@/components/layout/PageWrapper";
import Hero from "@/components/home/Hero";
import Ticker from "@/components/home/Ticker";
import Scoreboard from "@/components/home/Scoreboard";
import Manifesto from "@/components/home/Manifesto";
import Experience from "@/components/home/Experience";
import HowItWorks from "@/components/home/HowItWorks";
import SkillLab from "@/components/home/SkillLab";
import Story from "@/components/home/Story";
import NextUp from "@/components/home/NextUp";
import Wall from "@/components/home/Wall";
import FinalCTA from "@/components/home/FinalCTA";

const Index = () => {
  return (
    <PageWrapper>
      <Hero />
      <Ticker />
      <SkillLab />
      <Scoreboard />
      <Manifesto />
      <Experience />
      <HowItWorks />
      <NextUp />
      <Story />
      <Wall />
      <FinalCTA />
    </PageWrapper>
  );
};

export default Index;
