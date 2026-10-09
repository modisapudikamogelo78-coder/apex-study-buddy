import { useEffect, useRef, useState } from "react";
import { Clapperboard, Film, Loader2, Play, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type PodcastSegment = {
  id: string;
  segment_order: number;
  concept_title: string;
  host_dialogue: string;
  key_takeaway: string;
  status: string;
  error_message: string | null;
};

type JobState = { progress: number; videoUrl?: string; error?: string };

interface CreatePodcastProps {
  uploadId: string;
  content: string;
}

export function CreatePodcast({ uploadId, content }: CreatePodcastProps) {
  const [creatingScript, setCreatingScript] = useState(false);
  const [segments, setSegments] = useState<PodcastSegment[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const polling = useRef<Record<string, number>>({});
  const { session } = useAuth();
  const { toast } = useToast();

  useEffect(() => () => {
    Object.values(polling.current).forEach(window.clearTimeout);
  }, []);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("generate-podcast", { body });
    if (error) {
      const response = "context" in error ? error.context : null;
      const details = response instanceof Response ? await response.json().catch(() => null) as { error?: string } | null : null;
      throw new Error(details?.error ?? error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const createScript = async () => {
    if (!session) {
      toast({ title: "Please sign in", description: "Sign in to create a visual podcast.", variant: "destructive" });
      return;
    }
    setCreatingScript(true);
    try {
      const data = await invoke({ action: "create_script", uploadId, content: content.slice(0, 50_000) });
      setSegments(data.segments ?? []);
      setJobs({});
      toast({ title: "Podcast storyboard ready", description: "Generate each cinematic scene when you are ready." });
    } catch (error) {
      toast({ title: "Could not create podcast", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setCreatingScript(false);
    }
  };

  const poll = async (segmentId: string) => {
    try {
      const data = await invoke({ action: "video_status", segmentId });
      const message = data.error?.message as string | undefined;
      setJobs((current) => ({ ...current, [segmentId]: { progress: data.progress ?? current[segmentId]?.progress ?? 5, videoUrl: data.videoUrl, error: message } }));
      if (data.status === "completed" || data.status === "failed") return;
      polling.current[segmentId] = window.setTimeout(() => void poll(segmentId), 7_000);
    } catch (error) {
      setJobs((current) => ({ ...current, [segmentId]: { progress: current[segmentId]?.progress ?? 0, error: error instanceof Error ? error.message : "Generation failed" } }));
    }
  };

  const generateScene = async (segmentId: string) => {
    setJobs((current) => ({ ...current, [segmentId]: { progress: 2 } }));
    try {
      await invoke({ action: "create_video", segmentId });
      void poll(segmentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      setJobs((current) => ({ ...current, [segmentId]: { progress: 0, error: message } }));
      toast({ title: "Could not generate scene", description: message, variant: "destructive" });
    }
  };

  if (segments.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Clapperboard className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-bold">Create a visual podcast</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Turn your notes into a two-host educational conversation with a cinematic vertical scene for every key idea.
        </p>
        <div className="mx-auto mt-6 grid max-w-xl grid-cols-3 gap-3 text-left text-sm">
          <div className="rounded-lg border border-border bg-secondary/50 p-3"><Sparkles className="mb-2 h-4 w-4 text-primary" />Two-host script</div>
          <div className="rounded-lg border border-border bg-secondary/50 p-3"><Film className="mb-2 h-4 w-4 text-accent" />9:16 cinematic scenes</div>
          <div className="rounded-lg border border-border bg-secondary/50 p-3"><Volume2 className="mb-2 h-4 w-4 text-success" />Generated sound design</div>
        </div>
        <Button className="mt-7" onClick={createScript} disabled={creatingScript}>
          {creatingScript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
          {creatingScript ? "Designing episode..." : "Create Podcast"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium text-primary">Visual podcast storyboard</p>
          <h2 className="font-display text-2xl font-bold">Four cinematic learning scenes</h2>
        </div>
        <Button variant="outline" size="sm" onClick={createScript} disabled={creatingScript}>New storyboard</Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {segments.map((segment) => {
          const job = jobs[segment.id];
          const isGenerating = Boolean(job && !job.videoUrl && !job.error);
          return (
            <article key={segment.id} className="overflow-hidden rounded-lg border border-border bg-secondary/30">
              <div className="relative aspect-[9/16] max-h-[540px] bg-muted">
                {job?.videoUrl ? (
                  <video src={job.videoUrl} className="h-full w-full object-cover" controls playsInline loop />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                    {isGenerating ? <Loader2 className="h-9 w-9 animate-spin text-primary" /> : <Play className="h-9 w-9 text-muted-foreground" />}
                    <p className="mt-4 font-display text-lg font-semibold">Scene {segment.segment_order}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{isGenerating ? "Veo is creating your clip" : "Ready for cinematic generation"}</p>
                    {isGenerating && <Progress value={Math.max(5, job.progress)} className="mt-5 h-2 max-w-48" />}
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <h3 className="font-display text-lg font-bold">{segment.concept_title}</h3>
                <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{segment.host_dialogue}</p>
                <p className="border-l-2 border-primary pl-3 text-sm font-medium">{segment.key_takeaway}</p>
                {job?.error && <p className="text-sm text-destructive">{job.error}</p>}
                {!job?.videoUrl && !isGenerating && (
                  <Button className="w-full" size="sm" onClick={() => generateScene(segment.id)}>
                    <Film className="mr-2 h-4 w-4" />Generate scene
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}