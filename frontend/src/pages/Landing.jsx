import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import WatchItWork from "@/components/landing/WatchItWork";
import HowItWorks from "@/components/landing/HowItWorks";
import Capabilities from "@/components/landing/Capabilities";
import Connectors from "@/components/landing/Connectors";
import Trust from "@/components/landing/Trust";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-[#0A0E1A]" data-testid="landing-page">
      <Navbar />
      <Hero />
      <WatchItWork />
      <HowItWorks />
      <Capabilities />
      <Connectors />
      <Trust />
      <FinalCTA />
      <Footer />
    </div>
  );
}
