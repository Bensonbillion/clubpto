import PageWrapper from "@/components/layout/PageWrapper";
import Hero from "@/components/home/Hero";
import Manifesto from "@/components/home/Manifesto";
import ExperienceArc from "@/components/home/ExperienceArc";
import MembershipTeaser from "@/components/home/MembershipTeaser";
import WhatsOn from "@/components/home/WhatsOn";
import CommunityProof from "@/components/home/CommunityProof";
import EmailCapture from "@/components/home/EmailCapture";
import FinalCTA from "@/components/home/FinalCTA";

const Index = () => {
  return (
    <PageWrapper>
      <Hero />
      <Manifesto />
      <ExperienceArc />
      <MembershipTeaser />
      <WhatsOn />
      <CommunityProof />
      <EmailCapture />
      <FinalCTA />
    </PageWrapper>
  );
};

export default Index;
