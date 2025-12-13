import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  gradient: "primary" | "accent" | "success";
  features: string[];
  buttonText: string;
  delay?: number;
}

export const FeatureCard = ({
  icon,
  title,
  description,
  gradient,
  features,
  buttonText,
  delay = 0,
}: FeatureCardProps) => {
  const gradientStyles = {
    primary: {
      border: "hover:border-primary/50",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      glow: "group-hover:shadow-[0_0_60px_hsl(187_100%_50%_/_0.15)]",
    },
    accent: {
      border: "hover:border-accent/50",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
      glow: "group-hover:shadow-[0_0_60px_hsl(24_100%_55%_/_0.15)]",
    },
    success: {
      border: "hover:border-success/50",
      iconBg: "bg-success/10",
      iconColor: "text-success",
      glow: "group-hover:shadow-[0_0_60px_hsl(142_76%_45%_/_0.15)]",
    },
  };

  const style = gradientStyles[gradient];

  return (
    <div
      className={`
        group relative p-6 md:p-8 rounded-2xl bg-card border border-border transition-all duration-500
        hover:bg-card/80 hover:-translate-y-2 ${style.border} ${style.glow}
        animate-slide-up
      `}
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Icon */}
      <div className={`w-14 h-14 rounded-xl ${style.iconBg} flex items-center justify-center mb-6`}>
        <div className={style.iconColor}>{icon}</div>
      </div>

      {/* Content */}
      <h3 className="font-display text-2xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground mb-6">{description}</p>

      {/* Features list */}
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <div className={`w-1.5 h-1.5 rounded-full ${style.iconBg.replace('/10', '')}`} />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Button */}
      <Button variant="glass" className="w-full group/btn">
        {buttonText}
        <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
      </Button>

      {/* Decorative corner accent */}
      <div className={`absolute top-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}>
        <div className={`absolute top-4 right-4 w-12 h-12 rounded-full ${style.iconBg} blur-xl`} />
      </div>
    </div>
  );
};
