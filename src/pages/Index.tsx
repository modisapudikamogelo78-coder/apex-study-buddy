import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { UploadSection } from "@/components/UploadSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { Footer } from "@/components/Footer";
import { Dashboard } from "@/components/Dashboard";

interface Upload {
  id: string;
  file_name: string;
  content: string;
}

const Index = () => {
  const [currentUpload, setCurrentUpload] = useState<Upload | null>(null);

  if (currentUpload) {
    return (
      <Dashboard 
        upload={currentUpload} 
        onBack={() => setCurrentUpload(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <UploadSection onUploadComplete={setCurrentUpload} />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
