import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Gamepad2, Loader2, Trophy, Zap, Heart, ChevronLeft, ChevronRight } from "lucide-react";
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

const LANES = 4;
const RUNNER_Y = 82; // % from top where the runner stands
const START_LIVES = 3;

type Phase = "idle" | "countdown" | "running" | "result" | "over";

export function QuizGame({ uploadId, content }: QuizGameProps) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [lane, setLane] = useState(1);
  const [gateY, setGateY] = useState(-10);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const laneRef = useRef(lane);
  const speedRef = useRef(12); // % per second
  const rafRef = useRef<number>();
  const touchX = useRef<number | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();

  laneRef.current = lane;
  const q = questions[index];

  const generateQuiz = async () => {
    if (!session) {
      toast({ title: "Please sign in", description: "Sign in to play the quiz.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const safe = content.length > 50000 ? content.substring(0, 50000) : content;
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { uploadId, content: safe, count: 10 },
      });
      if (error) throw error;
      if (!data?.questions?.length) throw new Error("No questions were generated.");
      setQuestions(data.questions);
      startGame();
    } catch (e) {
      toast({
        title: "Couldn't make the quiz",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startGame = () => {
    setIndex(0);
    setScore(0);
    setStreak(0);
    setLives(START_LIVES);
    setCorrectCount(0);
    setLane(1);
    speedRef.current = 12;
    setGateY(-10);
    setPicked(null);
    setCountdown(3);
    setPhase("countdown");
  };

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      setPhase("running");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  const resolve = useCallback(
    (choice: number) => {
      if (!q) return;
      setPicked(choice);
      setPhase("result");
      const correct = choice === q.correct_answer;
      if (correct) {
        setScore((s) => s + 100 + streak * 20);
        setStreak((s) => s + 1);
        setCorrectCount((c) => c + 1);
        speedRef.current = Math.min(speedRef.current + 2, 30);
      } else {
        setStreak(0);
        setLives((l) => l - 1);
      }
    },
    [q, streak]
  );

  // Game loop: the answer gates run toward the player
  useEffect(() => {
    if (phase !== "running") return;
    let last = performance.now();
    let y = -10;
    setGateY(y);
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      y += speedRef.current * dt;
      setGateY(y);
      if (y >= RUNNER_Y - 6) {
        resolve(laneRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, index, resolve]);

  // After showing the result, go to the next question
  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(() => {
      const outOfLives = lives <= 0;
      const lastQuestion = index >= questions.length - 1;
      if (outOfLives || lastQuestion) {
        setPhase("over");
      } else {
        setIndex((i) => i + 1);
        setPicked(null);
        setPhase("running");
      }
    }, 2200);
    return () => clearTimeout(t);
  }, [phase, lives, index, questions.length]);

  const move = useCallback((dir: -1 | 1) => {
    setLane((l) => Math.max(0, Math.min(LANES - 1, l + dir)));
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        e.preventDefault();
        move(-1);
      } else if (["ArrowRight", "d", "D"].includes(e.key)) {
        e.preventDefault();
        move(1);
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        setLane(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, move]);

  // ---------- Screens ----------

  if (phase === "idle" || questions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
          <Gamepad2 className="w-10 h-10 text-accent" />
        </div>
        <h3 className="font-display text-xl font-semibold">Runner Quiz Game</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Answers come running at you. Switch to the lane with the right answer before you hit it.
          You have 3 lives — build streaks for bonus points!
        </p>
        <Button onClick={generateQuiz} disabled={loading} variant="accent" className="mt-4">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Making your questions...
            </>
          ) : (
            <>
              <Gamepad2 className="w-4 h-4" /> Start Running!
            </>
          )}
        </Button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center py-12 space-y-5">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
          <Trophy className="w-12 h-12 text-primary-foreground" />
        </div>
        <h3 className="font-display text-3xl font-bold">{lives <= 0 ? "Out of lives!" : "Finish line!"}</h3>
        <div className="text-6xl font-display font-bold text-gradient-primary">{score}</div>
        <p className="text-muted-foreground">
          {correctCount} of {index + 1} answered correctly
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={startGame} variant="accent">Run again</Button>
          <Button onClick={() => { setQuestions([]); setPhase("idle"); }} variant="outline">
            New questions
          </Button>
        </div>
      </div>
    );
  }

  const laneWidth = 100 / LANES;

  return (
    <div className="space-y-4 select-none">
      {/* HUD */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-bold text-gradient-primary">{score}</span>
          {streak >= 2 && (
            <span className="flex items-center gap-1 text-accent text-sm font-bold">
              <Zap className="w-4 h-4" /> x{streak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: START_LIVES }).map((_, i) => (
            <Heart
              key={i}
              className={cn("w-5 h-5", i < lives ? "text-destructive fill-destructive" : "text-muted-foreground")}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          Q{index + 1}/{questions.length}
        </span>
      </div>

      {/* Question */}
      <div className="bg-card rounded-lg p-3 border border-border">
        <h3 className="font-display text-base md:text-lg font-semibold text-center">{q.question}</h3>
      </div>

      {/* Track */}
      <div
        className="relative h-[380px] rounded-xl overflow-hidden border border-border bg-foreground/90 touch-none"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 30) move(dx > 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {/* Lanes */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: LANES }).map((_, i) => (
            <div
              key={i}
              onClick={() => phase === "running" && setLane(i)}
              className={cn(
                "flex-1 border-r border-background/10 last:border-r-0 transition-colors cursor-pointer",
                lane === i && "bg-primary/15"
              )}
            />
          ))}
        </div>

        {/* Moving road marks */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, hsl(var(--background)) 0 18px, transparent 18px 60px)",
            backgroundSize: `2px 60px`,
            backgroundRepeat: "repeat-y",
            backgroundPosition: `center ${(gateY * 8) % 60}px`,
          }}
        />

        {/* Answer gates */}
        {phase !== "countdown" && (
          <div
            className="absolute left-0 right-0 flex px-1 gap-1 pointer-events-none"
            style={{ top: `${gateY}%` }}
          >
            {q.options.slice(0, LANES).map((opt, i) => {
              const isCorrect = i === q.correct_answer;
              const isPicked = picked === i;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 min-h-[56px] rounded-lg p-2 text-center text-[11px] md:text-xs font-medium flex items-center justify-center border-2 transition-colors",
                    phase === "result"
                      ? isCorrect
                        ? "bg-success text-success-foreground border-success"
                        : isPicked
                        ? "bg-destructive text-destructive-foreground border-destructive"
                        : "bg-muted text-muted-foreground border-transparent opacity-50"
                      : "bg-card text-card-foreground border-primary/60"
                  )}
                  style={{ width: `${laneWidth}%` }}
                >
                  <span className="line-clamp-3">{opt}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Runner */}
        <div
          className="absolute -translate-x-1/2 transition-[left] duration-150 ease-out pointer-events-none"
          style={{ left: `${lane * laneWidth + laneWidth / 2}%`, top: `${RUNNER_Y}%` }}
        >
          <div
            className={cn(
              "w-10 h-14 rounded-xl bg-gradient-accent shadow-lg flex flex-col items-center pt-1.5",
              phase === "running" && "animate-bounce"
            )}
          >
            <div className="w-5 h-5 rounded-full bg-background" />
          </div>
        </div>

        {/* Countdown overlay */}
        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/60">
            <span className="font-display text-7xl font-bold text-background">
              {countdown === 0 ? "GO!" : countdown}
            </span>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="flex gap-3 md:hidden">
        <Button variant="outline" size="lg" className="flex-1" onClick={() => move(-1)}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button variant="outline" size="lg" className="flex-1" onClick={() => move(1)}>
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {phase === "result" && (
        <div className="p-3 bg-muted rounded-lg border border-border">
          <p className="text-sm">
            <strong>{picked === q.correct_answer ? "Correct! " : "Not quite. "}</strong>
            <span className="text-muted-foreground">{q.explanation}</span>
          </p>
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        ← → or A/D to switch lanes • 1–4 to jump to a lane • Swipe or tap a lane on phones
      </p>
    </div>
  );
}
