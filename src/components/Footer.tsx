import { Sparkles } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">Apex</span>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Transform your notes into powerful learning experiences
          </p>
          
          <p className="text-sm text-muted-foreground">
            © 2024 Apex. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
