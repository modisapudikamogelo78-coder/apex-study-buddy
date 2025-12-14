import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Gamepad2, Loader2, Trophy, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

interface QuizGameProps {
  uploadId: string;
  content: string;
}

export function QuizGame({ uploadId, content }: QuizGameProps) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [position, setPosition] = useState(1); // 0=left, 1=center, 2=right
  const { toast } = useToast();
  const { session } = useAuth();

  const currentQuestion = questions[currentIndex];

  const generateQuiz = async () => {
    if (!session) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to play the quiz.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { uploadId, content, count: 10 },
      });

      if (error) throw error;

      if (data.questions) {
        setQuestions(data.questions);
        setCurrentIndex(0);
        setScore(0);
        setGameOver(false);
        toast({
          title: "Quiz ready!",
          description: `${data.questions.length} questions generated from your notes.`,
        });
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast({
        title: "Failed to generate quiz",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (index: number) => {
    if (showResult) return;
    
    setSelectedAnswer(index);
    setShowResult(true);

    const isCorrect = index === currentQuestion.correct_answer;
    if (isCorrect) {
      setScore((s) => s + 100);
    }

    // Move to next question after delay
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((i) => i + 1);
        setSelectedAnswer(null);
        setShowResult(false);
        setPosition(1);
      } else {
        setGameOver(true);
      }
    }, 2000);
  };

  // Keyboard controls for the runner feel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentQuestion || showResult) return;

      if (e.key === "ArrowLeft" || e.key === "a") {
        setPosition((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowRight" || e.key === "d") {
        setPosition((p) => Math.min(2, p + 1));
      } else if (e.key === "1") handleAnswer(0);
      else if (e.key === "2") handleAnswer(1);
      else if (e.key === "3") handleAnswer(2);
      else if (e.key === "4") handleAnswer(3);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQuestion, showResult]);

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
          <Gamepad2 className="w-10 h-10 text-accent" />
        </div>
        <h3 className="font-display text-xl font-semibold">Runner Quiz Game</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Play an endless runner-style quiz game! Answer questions while racing
          to test your knowledge through active recall.
        </p>
        <Button
          onClick={generateQuiz}
          disabled={loading}
          variant="accent"
          className="mt-4"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating questions...
            </>
          ) : (
            <>
              <Gamepad2 className="w-4 h-4 mr-2" />
              Start Quiz Game
            </>
          )}
        </Button>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center animate-bounce-subtle">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <h3 className="font-display text-3xl font-bold">Game Over!</h3>
        <div className="text-6xl font-display font-bold text-gradient-primary">
          {score}
        </div>
        <p className="text-muted-foreground">
          You scored {score} points out of {questions.length * 100} possible!
        </p>
        <Button onClick={() => { setQuestions([]); }} variant="outline">
          Play Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score and progress */}
      <div className="flex justify-between items-center">
        <div className="font-display text-2xl font-bold text-gradient-primary">
          {score}
        </div>
        <div className="text-muted-foreground">
          {currentIndex + 1} / {questions.length}
        </div>
      </div>

      {/* Game area */}
      <div className="relative bg-gradient-to-b from-background to-muted/20 rounded-xl p-6 min-h-[400px] overflow-hidden border border-border/50">
        {/* Animated background lanes */}
        <div className="absolute inset-0 flex">
          {[0, 1, 2].map((lane) => (
            <div
              key={lane}
              className={cn(
                "flex-1 border-x border-border/20",
                position === lane && "bg-primary/5"
              )}
            />
          ))}
        </div>

        {/* Question */}
        <div className="relative z-10 text-center mb-8">
          <h3 className="font-display text-xl font-semibold mb-2">
            {currentQuestion.question}
          </h3>
        </div>

        {/* Answer options */}
        <div className="relative z-10 grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {currentQuestion.options.map((option, index) => {
            const isCorrect = index === currentQuestion.correct_answer;
            const isSelected = selectedAnswer === index;

            return (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={showResult}
                className={cn(
                  "p-4 rounded-lg text-left transition-all duration-200 border",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  showResult
                    ? isCorrect
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : isSelected
                      ? "bg-red-500/20 border-red-500 text-red-400"
                      : "bg-muted/50 border-border/50 opacity-50"
                    : "bg-card border-border/50 hover:border-primary/50 hover:bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm">{option}</span>
                  {showResult && isCorrect && (
                    <Check className="w-5 h-5 text-green-500 shrink-0 ml-auto" />
                  )}
                  {showResult && isSelected && !isCorrect && (
                    <X className="w-5 h-5 text-red-500 shrink-0 ml-auto" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showResult && (
          <div className="relative z-10 mt-6 p-4 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-sm text-muted-foreground">
              <strong>Explanation:</strong> {currentQuestion.explanation}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Use keys 1-4 to quickly select answers
      </p>
    </div>
  );
}
