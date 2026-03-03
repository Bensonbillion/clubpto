import PageWrapper from "@/components/layout/PageWrapper";
import StorySection from "@/components/about/StorySection";
import FounderStory from "@/components/about/FounderStory";
import WhatIsPadel from "@/components/about/WhatIsPadel";
import Values from "@/components/about/Values";

const About = () => {
  return (
    <PageWrapper>
      <StorySection />
      <FounderStory />
      <WhatIsPadel />
      <Values />
    </PageWrapper>
  );
};

export default About;
