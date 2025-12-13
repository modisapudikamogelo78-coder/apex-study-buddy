import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { UploadSection } from "@/components/UploadSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <UploadSection />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
