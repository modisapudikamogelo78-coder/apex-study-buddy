import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileQuestion, Loader2, Download, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface PaperSection {
  name: string;
  description?: string;
  questions: {
    number: number;
    type: "mcq" | "short" | "long";
    question: string;
    marks: number;
    options?: string[];
    answer: string;
  }[];
}

interface Paper {
  id: string;
  title: string;
  content: {
    title: string;
    totalMarks: number;
    duration: string;
    instructions?: string[];
    sections: PaperSection[];
  };
  difficulty: string;
}

interface QuestionPaperProps {
  uploadId: string;
  content: string;
}

export function QuestionPaper({ uploadId, content }: QuestionPaperProps) {
  const [loading, setLoading] = useState(false);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [showAnswers, setShowAnswers] = useState(false);
  const { toast } = useToast();
  const { session } = useAuth();

  const generatePaper = async () => {
    if (!session) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to generate papers.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-paper", {
        body: { uploadId, content, difficulty },
      });

      if (error) throw error;

      if (data.paper) {
        setPaper(data.paper);
        toast({
          title: "Paper generated!",
          description: `${data.paper.content.title} is ready.`,
        });
      }
    } catch (error) {
      console.error("Error generating paper:", error);
      toast({
        title: "Failed to generate paper",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!paper) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
          <FileQuestion className="w-10 h-10 text-green-500" />
        </div>
        <h3 className="font-display text-xl font-semibold">Question Paper Generator</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Generate exam-style question papers with answer keys from your notes.
          Perfect for revision and practice.
        </p>
        
        <div className="flex items-center justify-center gap-3 mt-4">
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={generatePaper} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileQuestion className="w-4 h-4 mr-2" />
                Generate Paper
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  const paperContent = paper.content;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAnswers(!showAnswers)}
        >
          {showAnswers ? (
            <>
              <EyeOff className="w-4 h-4 mr-2" />
              Hide Answers
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Show Answers
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPaper(null)}>
          Generate New Paper
        </Button>
      </div>

      {/* Paper */}
      <div className="bg-card border border-border/50 rounded-xl p-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 pb-6 border-b border-border/50">
          <h2 className="font-display text-2xl font-bold">{paperContent.title}</h2>
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <span>Total Marks: {paperContent.totalMarks}</span>
            <span>Duration: {paperContent.duration}</span>
          </div>
        </div>

        {/* Instructions */}
        {paperContent.instructions && paperContent.instructions.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Instructions:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {paperContent.instructions.map((instruction, i) => (
                <li key={i}>{instruction}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Sections */}
        {paperContent.sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-4">
            <div className="border-b border-border/50 pb-2">
              <h3 className="font-display text-lg font-semibold">{section.name}</h3>
              {section.description && (
                <p className="text-sm text-muted-foreground">{section.description}</p>
              )}
            </div>

            <div className="space-y-6">
              {section.questions.map((q) => (
                <div key={q.number} className="space-y-2">
                  <div className="flex gap-3">
                    <span className="font-semibold text-primary">{q.number}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <p>{q.question}</p>
                        <span className="text-sm text-muted-foreground shrink-0 ml-4">
                          [{q.marks} marks]
                        </span>
                      </div>

                      {/* MCQ Options */}
                      {q.type === "mcq" && q.options && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {q.options.map((option, i) => (
                            <div
                              key={i}
                              className="text-sm text-muted-foreground flex gap-2"
                            >
                              <span>({String.fromCharCode(65 + i)})</span>
                              <span>{option}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Answer space indicator */}
                      {q.type === "short" && !showAnswers && (
                        <div className="mt-2 h-16 border border-dashed border-border/50 rounded" />
                      )}
                      {q.type === "long" && !showAnswers && (
                        <div className="mt-2 h-32 border border-dashed border-border/50 rounded" />
                      )}

                      {/* Answer */}
                      {showAnswers && (
                        <div className={cn(
                          "mt-2 p-3 rounded-lg text-sm",
                          "bg-green-500/10 border border-green-500/30"
                        )}>
                          <span className="font-semibold text-green-500">Answer: </span>
                          <span className="text-green-400">{q.answer}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
