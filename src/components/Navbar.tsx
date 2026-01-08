import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthModal } from "@/components/AuthModal";

export const Navbar = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">Apex</span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#upload" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Upload
            </a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="/pitch" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pitch Deck
            </a>
          </div>

          {/* CTA / User menu */}
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAuthModal(true)}>
              Get Started
            </Button>
          )}
        </div>
      </nav>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  );
};
