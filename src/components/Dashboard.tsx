import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Video, Gamepad2, FileQuestion, LogOut, ArrowLeft, Clapperboard } from "lucide-react";
import { VideoPodcast } from "@/components/VideoPodcast";
import { QuizGame } from "@/components/QuizGame";
import { QuestionPaper } from "@/components/QuestionPaper";
import { CreatePodcast } from "@/components/CreatePodcast";
import { useAuth } from "@/hooks/useAuth";

interface Upload {
  id: string;
  file_name: string;
  content: string;
}

interface DashboardProps {
  upload: Upload;
  onBack: () => void;
}

export function Dashboard({ upload, onBack }: DashboardProps) {
  const [activeTab, setActiveTab] = useState("podcast");
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="font-display font-semibold">{upload.file_name}</h1>
              <p className="text-xs text-muted-foreground">
                {upload.content.length} characters
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 h-14">
            <TabsTrigger value="podcast" className="flex gap-2 data-[state=active]:bg-primary/20">
              <Clapperboard className="w-4 h-4" />
              <span className="hidden sm:inline">Podcast</span>
            </TabsTrigger>
            <TabsTrigger value="video" className="flex gap-2 data-[state=active]:bg-primary/20">
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">Conversation</span>
            </TabsTrigger>
            <TabsTrigger value="quiz" className="flex gap-2 data-[state=active]:bg-accent/20">
              <Gamepad2 className="w-4 h-4" />
              <span className="hidden sm:inline">Quiz</span>
            </TabsTrigger>
            <TabsTrigger value="paper" className="flex gap-2 data-[state=active]:bg-green-500/20">
              <FileQuestion className="w-4 h-4" />
              <span className="hidden sm:inline">Paper</span>
            </TabsTrigger>
          </TabsList>

          <div className="max-w-4xl mx-auto">
            <TabsContent value="podcast" className="mt-0">
              <div className="bg-card border border-border/50 rounded-xl p-6">
                <CreatePodcast uploadId={upload.id} content={upload.content} />
              </div>
            </TabsContent>

            <TabsContent value="video" className="mt-0">
              <div className="bg-card border border-border/50 rounded-xl p-6">
                <VideoPodcast uploadId={upload.id} content={upload.content} />
              </div>
            </TabsContent>

            <TabsContent value="quiz" className="mt-0">
              <div className="bg-card border border-border/50 rounded-xl p-6">
                <QuizGame uploadId={upload.id} content={upload.content} />
              </div>
            </TabsContent>

            <TabsContent value="paper" className="mt-0">
              <div className="bg-card border border-border/50 rounded-xl p-6">
                <QuestionPaper uploadId={upload.id} content={upload.content} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
