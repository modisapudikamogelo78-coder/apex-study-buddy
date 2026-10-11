import { useEffect, useRef, useState } from "react";
import { Clapperboard, Loader2, Mic, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type PodcastPart = {
  id: string;
  segment_order: number;
  concept_title: string;
  host_dialogue: string;
};

interface CreatePodcastProps {
  uploadId: string;
  content: string;
}

export function CreatePodcast({ uploadId, content }: CreatePodcastProps) {
  const [creatingScript, setCreatingScript] = useState(false);
  const [parts, setParts] = useState<PodcastPart[]>([]);
  const [doneParts, setDoneParts] = useState(0);
  const [partProgress, setPartProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const cancelled = useRef(false);
  const { session } = useAuth();
  const { toast } = useToast();

  useEffect(() => () => { cancelled.current = true; }, []);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("generate-podcast", { body });
    if (error) {
      const response = "context" in error ? error.context : null;
      const details = response instanceof Response ? await response.json().catch(() => null) as { error?: string } | null : null;
      throw new Error(details?.error ?? error.message);
    }
    if (data?.error && typeof data.error === "string") throw new Error(data.error);
    return data;
  };

  const createScript = async () => {
    if (!session) {
      toast({ title: "Please sign in", description: "Sign in to create a podcast.", variant: "destructive" });
      return;
    }
    setCreatingScript(true);
    try {
      const data = await invoke({ action: "create_script", uploadId, content: content.slice(0, 50_000) });
      setParts(data.segments ?? []);
      setDoneParts(0);
      setVideoUrl(undefined);
      setError(undefined);
    } catch (e) {
      toast({ title: "Could not write the podcast", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setCreatingScript(false);
    }
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // One click builds the whole video: each part extends the previous one, strictly in order.
  const generateVideo = async () => {
    setGenerating(true);
    setError(undefined);
    try {
      for (let i = doneParts; i < parts.length; i++) {
        if (cancelled.current) return;
        setPartProgress(2);
        await invoke({ action: "create_video", segmentId: parts[i].id });
        for (;;) {
          await wait(8_000);
          if (cancelled.current) return;
          const status = await invoke({ action: "video_status", segmentId: parts[i].id });
          if (status.status === "failed") throw new Error(status.error?.message ?? "Video generation failed");
          if (status.status === "completed") {
            setVideoUrl(status.videoUrl);
            setDoneParts(i + 1);
            break;
          }
          setPartProgress(status.progress ?? 5);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Video generation failed";
      setError(message);
      toast({ title: "Video paused", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (parts.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mic className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-bold">Create a video podcast</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Get one video of two hosts having a natural conversation that explains your notes.
        </p>
        <div className="mx-auto mt-6 grid max-w-xl grid-cols-3 gap-3 text-left text-sm">
          <div className="rounded-lg border border-border bg-secondary/50 p-3"><Users className="mb-2 h-4 w-4 text-primary" />Two hosts</div>
          <div className="rounded-lg border border-border bg-secondary/50 p-3"><Clapperboard className="mb-2 h-4 w-4 text-accent" />One full script</div>
          <div className="rounded-lg border border-border bg-secondary/50 p-3"><Video className="mb-2 h-4 w-4 text-success" />One video</div>
        </div>
        <Button className="mt-7" onClick={createScript} disabled={creatingScript}>
          {creatingScript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
          {creatingScript ? "Writing the conversation..." : "Create Podcast"}
        </Button>
      </div>
    );
  }

  const finished = doneParts === parts.length;
  const overall = ((doneParts + (generating ? partProgress / 100 : 0)) / parts.length) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium text-primary">Video podcast</p>
          <h2 className="font-display text-2xl font-bold">{parts[0].concept_title}</h2>
        </div>
        <Button variant="outline" size="sm" onClick={createScript} disabled={creatingScript || generating}>New script</Button>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        {videoUrl && (finished || !generating) ? (
          <video key={videoUrl} src={videoUrl} className="h-full w-full object-cover" controls playsInline />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            {generating ? <Loader2 className="h-9 w-9 animate-spin text-primary" /> : <Video className="h-9 w-9 text-muted-foreground" />}
            <p className="mt-4 font-display text-lg font-semibold">
              {generating ? `Filming your podcast… part ${doneParts + 1} of ${parts.length}` : "Your script is ready"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {generating ? "This takes a few minutes. Keep this page open." : "Generate it as one continuous video."}
            </p>
            {generating && <Progress value={Math.max(3, overall)} className="mt-5 h-2 max-w-64" />}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!finished && !generating && (
        <Button className="w-full" onClick={generateVideo}>
          <Video className="mr-2 h-4 w-4" />{doneParts > 0 ? "Continue generating video" : "Generate podcast video"}
        </Button>
      )}

      <div className="rounded-lg border border-border bg-secondary/30 p-5">
        <h3 className="mb-3 font-display text-lg font-bold">Full script</h3>
        <div className="space-y-2 text-sm">
          {parts.flatMap((p) => p.host_dialogue.split("\n")).map((line, i) => (
            <p key={i} className={line.startsWith("Host A") ? "text-muted-foreground" : ""}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
