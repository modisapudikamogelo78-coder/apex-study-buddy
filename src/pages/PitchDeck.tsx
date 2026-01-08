import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUp, ArrowDown, Sparkles, Upload, Brain, Video, Gamepad2, Target, Lightbulb, Globe, Rocket, Users, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const slides = [
  { id: "title", label: "Title" },
  { id: "problem", label: "Problem" },
  { id: "solution", label: "Solution" },
  { id: "how-it-works", label: "How It Works" },
  { id: "innovation", label: "Innovation" },
  { id: "vr-vision", label: "VR Vision" },
  { id: "market", label: "Market" },
  { id: "impact", label: "Impact" },
  { id: "tech", label: "Tech Stack" },
  { id: "roadmap", label: "Roadmap" },
  { id: "cta", label: "Join Us" },
];

const PitchDeck = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const scrollToSlide = useCallback((index: number) => {
    const element = document.getElementById(slides[index].id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setCurrentSlide(index);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        if (currentSlide < slides.length - 1) {
          scrollToSlide(currentSlide + 1);
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentSlide > 0) {
          scrollToSlide(currentSlide - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide, scrollToSlide]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = slides.findIndex((s) => s.id === entry.target.id);
            if (index !== -1) setCurrentSlide(index);
          }
        });
      },
      { threshold: 0.5 }
    );

    slides.forEach((slide) => {
      const element = document.getElementById(slide.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-6 left-6 z-50 bg-background/80 backdrop-blur-sm"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {/* Navigation dots */}
      <nav className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => scrollToSlide(index)}
            className={`group flex items-center gap-2 transition-all duration-300 ${
              currentSlide === index ? "opacity-100" : "opacity-50 hover:opacity-80"
            }`}
          >
            <span className={`text-xs text-right w-20 transition-opacity duration-200 ${
              currentSlide === index ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}>
              {slide.label}
            </span>
            <div
              className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                currentSlide === index
                  ? "bg-primary border-primary scale-125"
                  : "border-muted-foreground hover:border-primary"
              }`}
            />
          </button>
        ))}
      </nav>

      {/* Arrow navigation */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => currentSlide > 0 && scrollToSlide(currentSlide - 1)}
          disabled={currentSlide === 0}
          className="bg-background/80 backdrop-blur-sm"
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => currentSlide < slides.length - 1 && scrollToSlide(currentSlide + 1)}
          disabled={currentSlide === slides.length - 1}
          className="bg-background/80 backdrop-blur-sm"
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Slide 1: Title */}
      <section
        id="title"
        className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
        
        <div className="relative z-10 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-8">
            <Sparkles className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-6xl md:text-8xl font-bold mb-6 text-gradient-primary">
            Apex
          </h1>
          <p className="text-xl md:text-3xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Making VR Learning Accessible for Every African Student
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Scroll to explore</span>
            <ArrowDown className="w-4 h-4 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Slide 2: Problem */}
      <section
        id="problem"
        className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-background to-destructive/5"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-4xl md:text-6xl font-bold text-center mb-16">
            The <span className="text-destructive">Problem</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "📚",
                title: "Passive Learning",
                description: "Traditional study materials are boring and don't engage students actively in their learning journey."
              },
              {
                icon: "🥽",
                title: "VR Perception Gap",
                description: "Learners perceive VR/AR as 'too advanced' or expensive, creating a barrier to adoption."
              },
              {
                icon: "🌍",
                title: "Tech Stagnation",
                description: "South Africa's tech adoption is held back by perception, not capability. Ignorance breeds stagnation."
              }
            ].map((item, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl bg-card border border-border hover:border-destructive/50 transition-all duration-300 hover:-translate-y-2"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <span className="text-5xl mb-4 block">{item.icon}</span>
                <h3 className="font-display text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slide 3: Solution */}
      <section
        id="solution"
        className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-background to-primary/5"
      >
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-8">
            The <span className="text-gradient-primary">Solution</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-16 max-w-3xl mx-auto">
            One upload transforms into multiple interactive learning experiences
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: Upload, title: "Upload Any PDF", description: "Drop your study material and let AI handle the rest" },
              { icon: Gamepad2, title: "Interactive Quizzes", description: "Gamified assessments that make learning fun" },
              { icon: Brain, title: "AI Exam Papers", description: "Professionally generated practice exams" },
              { icon: Video, title: "VR Video Podcast", description: "Step INTO the classroom with your AI tutor" },
            ].map((item, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 hover:border-primary/50 transition-all duration-300 group"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slide 4: How It Works */}
      <section
        id="how-it-works"
        className="min-h-screen flex items-center justify-center px-6 py-20"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-4xl md:text-6xl font-bold text-center mb-16">
            How It <span className="text-gradient-accent">Works</span>
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            {[
              { step: "1", title: "Upload", description: "Drop your PDF study material" },
              { step: "2", title: "Process", description: "AI understands your content" },
              { step: "3", title: "Choose", description: "Quiz, Exam, or Video mode" },
              { step: "4", title: "Learn", description: "Engage with immersive content" },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4 md:flex-col">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center text-3xl font-bold text-primary-foreground">
                    {item.step}
                  </div>
                </div>
                <div className="md:text-center">
                  <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {index < 3 && (
                  <ChevronRight className="hidden md:block w-8 h-8 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slide 5: Innovation */}
      <section
        id="innovation"
        className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-background to-accent/10"
      >
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-16">
            The <span className="text-gradient-accent">Innovation</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-card border border-accent/30 text-left">
              <Lightbulb className="w-10 h-10 text-accent mb-4" />
              <h3 className="font-display text-2xl font-semibold mb-4">Multi-Modal Transformation</h3>
              <p className="text-muted-foreground">
                One upload becomes 4+ distinct learning experiences. Quiz games, exam papers, 
                video explanations, and immersive VR sessions—all from a single PDF.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-card border border-primary/30 text-left">
              <Users className="w-10 h-10 text-primary mb-4" />
              <h3 className="font-display text-2xl font-semibold mb-4">AI Avatar Tutoring</h3>
              <p className="text-muted-foreground">
                Beyond Presence integration creates human-like AI tutors that explain 
                concepts conversationally, adapting to each student's pace and style.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Slide 6: VR Vision */}
      <section
        id="vr-vision"
        className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-blue-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--background)_70%)]" />
        
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <span className="text-6xl mb-8 block">🥽</span>
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-8">
            The <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">VR Vision</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Learners don't just watch—they <strong className="text-foreground">sit WITH</strong> their AI tutor 
            in a virtual study space. Breaking the barrier: VR isn't "huge"—it's just a new way to learn.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "Immersive Presence", description: "Feel like you're in the same room as your tutor" },
              { title: "First-Mover Advantage", description: "Pioneering VR education in African EdTech" },
              { title: "Affordable Access", description: "Compatible with Meta Quest and mobile VR" },
            ].map((item, index) => (
              <div key={index} className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <h3 className="font-display text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slide 7: Market */}
      <section
        id="market"
        className="min-h-screen flex items-center justify-center px-6 py-20"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-4xl md:text-6xl font-bold text-center mb-16">
            Market <span className="text-gradient-primary">Opportunity</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-primary/10 border border-primary/20">
                <div className="text-4xl font-bold text-primary mb-2">$10B+</div>
                <p className="text-muted-foreground">African EdTech market by 2030</p>
              </div>
              <div className="p-6 rounded-xl bg-accent/10 border border-accent/20">
                <div className="text-4xl font-bold text-accent mb-2">400M+</div>
                <p className="text-muted-foreground">Students across Africa</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-success/10 border border-success/20">
                <div className="text-4xl font-bold text-success mb-2">50%+</div>
                <p className="text-muted-foreground">YoY growth in VR education globally</p>
              </div>
              <div className="p-6 rounded-xl bg-secondary/50 border border-border">
                <div className="text-4xl font-bold mb-2">🎯</div>
                <p className="text-muted-foreground">Target: High school & university students in SA</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Slide 8: Impact */}
      <section
        id="impact"
        className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-background to-success/5"
      >
        <div className="max-w-5xl mx-auto text-center">
          <Globe className="w-16 h-16 text-success mx-auto mb-8" />
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-8">
            Social <span className="text-success">Impact</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8 text-left">
            {[
              { title: "Democratize VR", description: "Bring immersive tech to every African learner, regardless of background" },
              { title: "Combat Tech Ignorance", description: "Show that VR isn't intimidating—it's just another tool for learning" },
              { title: "Advance SA Tech", description: "Contribute to breaking South Africa's tech stagnation cycle" },
              { title: "Create VR Natives", description: "Build a generation of learners comfortable with immersive technology" },
            ].map((item, index) => (
              <div key={index} className="p-6 rounded-xl bg-card border border-success/20 hover:border-success/50 transition-all">
                <h3 className="font-display text-xl font-semibold mb-2 flex items-center gap-2">
                  <span className="text-success">✓</span> {item.title}
                </h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slide 9: Tech Stack */}
      <section
        id="tech"
        className="min-h-screen flex items-center justify-center px-6 py-20"
      >
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-16">
            Tech <span className="text-gradient-accent">Stack</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "React", category: "Frontend" },
              { name: "TypeScript", category: "Language" },
              { name: "Lovable Cloud", category: "Backend" },
              { name: "Gemini AI", category: "Intelligence" },
              { name: "Beyond Presence", category: "Avatar" },
              { name: "WebXR", category: "VR Core" },
              { name: "Capacitor", category: "Mobile" },
              { name: "Tailwind", category: "Styling" },
            ].map((item, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all group"
              >
                <div className="text-xs text-muted-foreground mb-1">{item.category}</div>
                <div className="font-display font-semibold group-hover:text-primary transition-colors">
                  {item.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slide 10: Roadmap */}
      <section
        id="roadmap"
        className="min-h-screen flex items-center justify-center px-6 py-20"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-4xl md:text-6xl font-bold text-center mb-16">
            <span className="text-gradient-primary">Roadmap</span>
          </h2>
          <div className="relative">
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-success" />
            {[
              { phase: "Phase 1", title: "Core Platform", status: "Current", items: ["PDF upload & parsing", "AI quiz generation", "AI exam papers", "Video podcast MVP"] },
              { phase: "Phase 2", title: "VR Integration", status: "Next", items: ["WebXR implementation", "VR study environments", "Immersive tutoring sessions"] },
              { phase: "Phase 3", title: "AR Companion", status: "Future", items: ["Mobile AR features", "Study flashcards in AR", "Interactive 3D models"] },
              { phase: "Phase 4", title: "Pan-African", status: "Vision", items: ["Multi-language support", "Regional partnerships", "Offline capabilities"] },
            ].map((item, index) => (
              <div
                key={index}
                className={`relative flex items-center gap-8 mb-8 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                <div className="absolute left-8 md:left-1/2 w-4 h-4 -translate-x-1/2 rounded-full bg-primary border-4 border-background" />
                <div className={`ml-16 md:ml-0 md:w-1/2 p-6 rounded-xl bg-card border border-border ${
                  index % 2 === 0 ? "md:mr-8 md:text-right" : "md:ml-8"
                }`}>
                  <span className="text-xs text-primary font-semibold">{item.status}</span>
                  <h3 className="font-display text-xl font-semibold mt-1">{item.phase}: {item.title}</h3>
                  <ul className={`mt-3 space-y-1 text-sm text-muted-foreground ${
                    index % 2 === 0 ? "md:text-right" : ""
                  }`}>
                    {item.items.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slide 11: CTA */}
      <section
        id="cta"
        className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-primary/30 rounded-full blur-3xl animate-pulse" />
        
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <Rocket className="w-16 h-16 text-primary mx-auto mb-8" />
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-6">
            Join the Future of <span className="text-gradient-primary">African Learning</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            Be part of the movement that brings VR education to every student in South Africa and beyond.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-primary text-lg px-8" onClick={() => navigate("/")}>
              Try Apex Now
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Contact Us
            </Button>
          </div>
          <p className="mt-16 text-sm text-muted-foreground">
            Use arrow keys ↑↓ or scroll to navigate • Built with ❤️ in South Africa
          </p>
        </div>
      </section>
    </div>
  );
};

export default PitchDeck;
