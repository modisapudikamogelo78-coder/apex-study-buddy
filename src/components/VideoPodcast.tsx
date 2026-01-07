import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface VideoPodcastProps {
  uploadId: string;
  content: string;
  onSessionCreated?: (url: string) => void;
}

export function VideoPodcast({ uploadId, content, onSessionCreated }: VideoPodcastProps) {
  const [loading, setLoading] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();

  const createVideoSession = async () => {
    if (!session) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to use video features.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Truncate content to stay within the 51200 character limit
      const truncatedContent = content.length > 50000 
        ? content.substring(0, 50000) + "\n\n[Content truncated for processing...]"
        : content;

      const { data, error } = await supabase.functions.invoke("create-video-session", {
        body: { uploadId, content: truncatedContent },
      });

      if (error) throw error;

      if (data.agentUrl) {
        setSessionUrl(data.agentUrl);
        onSessionCreated?.(data.agentUrl);
        toast({
          title: "Video session ready!",
          description: "Your AI study host is ready to explain your notes.",
        });
      }
    } catch (error) {
      console.error("Error creating video session:", error);
      toast({
        title: "Failed to create session",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sessionUrl) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl overflow-hidden border border-border/50">
          <iframe
            src={sessionUrl}
            className="absolute inset-0 w-full h-full"
            allow="camera; microphone; autoplay"
            title="Video Podcast Session"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(sessionUrl, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSessionUrl(null)}
          >
            Create New Session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-12 space-y-4">
      <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
        <Video className="w-10 h-10 text-primary" />
      </div>
      <h3 className="font-display text-xl font-semibold">
        Interactive Video Podcast
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        Start a live video session with an AI host who will explain your notes
        and answer your questions in real-time.
      </p>
      <Button onClick={createVideoSession} disabled={loading} className="mt-4">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating session...
          </>
        ) : (
          <>
            <Video className="w-4 h-4 mr-2" />
            Start Video Session
          </>
        )}
      </Button>
    </div>
  );
}
