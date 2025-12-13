import { FeatureCard } from "./FeatureCard";
import { Video, Gamepad2, FileQuestion } from "lucide-react";

export const FeaturesSection = () => {
  const features = [
    {
      icon: <Video className="w-7 h-7" />,
      title: "Video Conversations",
      description: "Watch two AI hosts naturally discuss and explain your notes, making complex topics easy to understand.",
      gradient: "primary" as const,
      features: [
        "Natural dialogue format",
        "Key concepts highlighted",
        "Downloadable MP4",
        "Perfect for visual learners",
      ],
      buttonText: "Generate Video",
    },
    {
      icon: <Gamepad2 className="w-7 h-7" />,
      title: "Runner Quiz Game",
      description: "Play an endless runner game where you answer MCQs while racing — active recall meets gaming.",
      gradient: "accent" as const,
      features: [
        "Subway Surfers style gameplay",
        "Multiple choice questions",
        "Track your high scores",
        "Spaced repetition built-in",
      ],
      buttonText: "Play Game",
    },
    {
      icon: <FileQuestion className="w-7 h-7" />,
      title: "Question Papers",
      description: "Auto-generate practice tests and exam-style papers directly from your notes.",
      gradient: "success" as const,
      features: [
        "Exam-style formatting",
        "Adjustable difficulty",
        "Answer keys included",
        "Export to PDF",
      ],
      buttonText: "Generate Paper",
    },
  ];

  return (
    <section id="features" className="py-24 relative">
      <div className="container px-4">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Three Powerful Outputs
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            One Upload, <span className="text-gradient-accent">Three Ways</span> to Learn
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your notes transform into video lessons, interactive games, and practice tests —
            everything you need to understand, test, and revise.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <FeatureCard key={i} {...feature} delay={i * 0.15} />
          ))}
        </div>
      </div>
    </section>
  );
};
