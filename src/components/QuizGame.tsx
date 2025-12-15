import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Gamepad2, Loader2, Trophy, X, Check, Zap } from "lucide-react";
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
  const [streak, setStreak] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [runnerLane, setRunnerLane] = useState(1); // 0, 1, 2 for left, center, right
  const [obstacleOffset, setObstacleOffset] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const animationRef = useRef<number>();
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
        setStreak(0);
        setGameOver(false);
        setIsRunning(true);
        setSpeed(2);
        toast({
          title: "🏃 GO!",
          description: "Use arrow keys or A/D to move, collect the correct answer!",
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

  // Animation loop for the running effect
  useEffect(() => {
    if (!isRunning || showResult) return;

    const animate = () => {
      setObstacleOffset((prev) => {
        const newOffset = prev + speed;
        return newOffset > 100 ? 0 : newOffset;
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, showResult, speed]);

  const handleLaneCollision = useCallback((lane: number) => {
    if (showResult || !currentQuestion) return;

    // Check which answer option is in this lane
    const optionIndex = lane; // Lane 0 = option 0/1, lane 1 = option 1/2, lane 2 = option 2/3
    // Map 3 lanes to 4 options: left = 0, center-left = 1, center-right = 2, right = 3
    // Simplified: just use first 3 options for 3 lanes
    const mappedIndex = lane;

    if (mappedIndex < currentQuestion.options.length) {
      setSelectedAnswer(mappedIndex);
      setShowResult(true);

      const isCorrect = mappedIndex === currentQuestion.correct_answer;
      if (isCorrect) {
        const bonus = streak >= 3 ? 50 : 0;
        setScore((s) => s + 100 + bonus);
        setStreak((s) => s + 1);
        setSpeed((s) => Math.min(s + 0.2, 5));
      } else {
        setStreak(0);
        setSpeed((s) => Math.max(s - 0.3, 1.5));
      }

      setTimeout(() => {
        if (currentIndex < questions.length - 1) {
          setCurrentIndex((i) => i + 1);
          setSelectedAnswer(null);
          setShowResult(false);
          setObstacleOffset(0);
        } else {
          setGameOver(true);
          setIsRunning(false);
        }
      }, 1500);
    }
  }, [showResult, currentQuestion, currentIndex, questions.length, streak]);

  // Keyboard controls
  useEffect(() => {
    if (!isRunning) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        setRunnerLane((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        setRunnerLane((p) => Math.min(2, p + 1));
      } else if (e.key === " " || e.key === "Enter") {
        // Collect answer in current lane
        handleLaneCollision(runnerLane);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, runnerLane, handleLaneCollision]);

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 flex items-center justify-center animate-pulse">
          <Gamepad2 className="w-10 h-10 text-accent" />
        </div>
        <h3 className="font-display text-xl font-semibold">Runner Quiz Game</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Race through questions! Use arrow keys to switch lanes and collect the
          correct answers. Build streaks for bonus points!
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
              Start Running!
            </>
          )}
        </Button>
      </div>
    );
  }

  if (gameOver) {
    const percentage = Math.round((score / (questions.length * 100)) * 100);
    return (
      <div className="text-center py-12 space-y-6">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center animate-bounce">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <h3 className="font-display text-3xl font-bold">Finish Line!</h3>
        <div className="text-6xl font-display font-bold text-gradient-primary">
          {score}
        </div>
        <p className="text-muted-foreground">
          {percentage >= 80 ? "🔥 Amazing run!" : percentage >= 50 ? "👍 Good effort!" : "💪 Keep practicing!"}
        </p>
        <p className="text-sm text-muted-foreground">
          {score} points out of {questions.length * 100} possible
        </p>
        <Button onClick={() => { setQuestions([]); }} variant="outline">
          Run Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HUD */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-4">
          <div className="font-display text-2xl font-bold text-gradient-primary">
            {score}
          </div>
          {streak >= 2 && (
            <div className="flex items-center gap-1 text-accent animate-pulse">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-bold">x{streak}</span>
            </div>
          )}
        </div>
        <div className="text-muted-foreground text-sm">
          Q{currentIndex + 1}/{questions.length}
        </div>
      </div>

      {/* Question */}
      <div className="bg-card/80 backdrop-blur rounded-lg p-3 border border-border/50">
        <h3 className="font-display text-lg font-semibold text-center">
          {currentQuestion.question}
        </h3>
      </div>

      {/* Game Track */}
      <div className="relative h-[320px] rounded-xl overflow-hidden border border-border/50 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        {/* Road lines animation */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute left-1/2 w-2 h-8 bg-yellow-500/60 rounded"
              style={{
                transform: `translateX(-50%)`,
                top: `${((i * 50 + obstacleOffset * 4) % 400) - 50}px`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>

        {/* Lane dividers */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 border-r border-white/10" />
          <div className="flex-1 border-r border-white/10" />
          <div className="flex-1" />
        </div>

        {/* Answer obstacles coming toward player */}
        <div 
          className="absolute left-0 right-0 flex gap-2 px-2 transition-all duration-100"
          style={{ 
            top: `${Math.min(obstacleOffset * 2.5, 180)}px`,
            opacity: obstacleOffset > 10 ? 1 : 0,
          }}
        >
          {currentQuestion.options.slice(0, 3).map((option, index) => {
            const isCorrect = index === currentQuestion.correct_answer;
            const isSelected = selectedAnswer === index;

            return (
              <div
                key={index}
                onClick={() => handleLaneCollision(index)}
                className={cn(
                  "flex-1 p-3 rounded-lg cursor-pointer transition-all text-center",
                  "transform hover:scale-105",
                  showResult
                    ? isCorrect
                      ? "bg-green-500/90 text-white ring-2 ring-green-400"
                      : isSelected
                      ? "bg-red-500/90 text-white ring-2 ring-red-400"
                      : "bg-slate-700/80 text-slate-400"
                    : "bg-primary/80 hover:bg-primary text-primary-foreground"
                )}
              >
                <span className="text-xs font-medium line-clamp-2">{option}</span>
                {showResult && isCorrect && <Check className="w-4 h-4 mx-auto mt-1" />}
                {showResult && isSelected && !isCorrect && <X className="w-4 h-4 mx-auto mt-1" />}
              </div>
            );
          })}
        </div>

        {/* Runner character */}
        <div
          className="absolute bottom-8 transition-all duration-150 ease-out"
          style={{
            left: `${runnerLane * 33.33 + 16.66}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className={cn(
            "w-12 h-16 rounded-lg flex flex-col items-center justify-center",
            "bg-gradient-to-b from-accent to-accent/80 shadow-lg shadow-accent/40",
            isRunning && !showResult && "animate-bounce"
          )}>
            <div className="w-6 h-6 rounded-full bg-white/90 mb-1" />
            <div className="w-8 h-6 rounded-t-lg bg-white/20" />
          </div>
          {/* Speed trail */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i} 
                className="w-1 bg-accent/40 rounded animate-pulse"
                style={{ height: `${12 - i * 3}px`, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Fourth option at bottom if exists */}
        {currentQuestion.options.length > 3 && (
          <div 
            className="absolute bottom-24 left-1/2 -translate-x-1/2"
            style={{ 
              opacity: obstacleOffset > 30 ? 1 : 0,
            }}
          >
            <div
              onClick={() => {
                setRunnerLane(1);
                setTimeout(() => handleLaneCollision(3), 100);
              }}
              className={cn(
                "px-4 py-2 rounded-lg cursor-pointer transition-all text-center",
                showResult
                  ? currentQuestion.correct_answer === 3
                    ? "bg-green-500/90 text-white"
                    : selectedAnswer === 3
                    ? "bg-red-500/90 text-white"
                    : "bg-slate-700/80 text-slate-400"
                  : "bg-secondary/80 hover:bg-secondary text-secondary-foreground"
              )}
            >
              <span className="text-xs font-medium">{currentQuestion.options[3]}</span>
            </div>
          </div>
        )}
      </div>

      {/* Explanation */}
      {showResult && (
        <div className="p-3 bg-muted/50 rounded-lg border border-border/50 animate-in fade-in slide-in-from-bottom-2">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">💡</strong> {currentQuestion.explanation}
          </p>
        </div>
      )}

      {/* Controls hint */}
      <p className="text-xs text-center text-muted-foreground">
        ← → or A/D to move • Space/Enter to collect • Click answers directly
      </p>
    </div>
  );
}
