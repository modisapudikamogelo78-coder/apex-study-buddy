import { FeatureCard } from "./FeatureCard";
import { Clapperboard, Video, Gamepad2, FileQuestion } from "lucide-react";

export const FeaturesSection = () => {
  const features = [
    {
      icon: <Clapperboard className="w-7 h-7" />,
      title: "Create Podcast",
      description: "Turn your notes into a two-host visual micro-podcast with cinematic vertical scenes and synchronized sound design.",
      gradient: "primary" as const,
      features: [
        "Natural two-host dialogue",
        "Vertical cinematic scenes",
        "Key takeaway overlays",
        "Mobile-first learning feed",
      ],
      buttonText: "Create Podcast",
    },
    {
      icon: <Video className="w-7 h-7" />,
      title: "Video Conversation",
      description: "Talk live with an AI study host who explains your notes and answers questions in real time.",
      gradient: "primary" as const,
      features: [
        "Interactive video call",
        "Ask follow-up questions",
        "Personalized explanations",
        "Powered by Beyond Presence",
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
            Four Powerful Outputs
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            One Upload, <span className="text-gradient-accent">Four Ways</span> to Learn
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your notes transform into visual podcasts, live conversations, interactive games, and practice tests —
            everything you need to understand, test, and revise.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <FeatureCard key={i} {...feature} delay={i * 0.15} />
          ))}
        </div>
      </div>
    </section>
  );
};
