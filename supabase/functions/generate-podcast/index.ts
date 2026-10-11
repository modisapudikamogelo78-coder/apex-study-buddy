import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const SCRIPT_MODEL = "openai/gpt-6-astra";
const VIDEO_MODEL = "google/veo-3.1-fast";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PART_COUNT = 5;
export const RESOLUTION = "720p";

type PodcastBeat = { host_a_line: string; host_b_line: string };
type PodcastScript = { title: string; studio: string; host_a: string; host_b: string; beats: PodcastBeat[] };

export function buildBeatPrompt(script: Pick<PodcastScript, "studio" | "host_a" | "host_b">, beat: PodcastBeat, index: number) {
  const dialogue = `The host on the left says: ${beat.host_a_line} The host on the right replies: ${beat.host_b_line}`;
  if (index === 0) {
    return `Static medium two-shot of a video podcast recording, filmed like a professional YouTube podcast. ${script.studio} On the left sits ${script.host_a} On the right sits ${script.host_b} Both wear headphones and speak into studio microphones, facing each other with natural gestures and eye contact. ${dialogue} Clean studio audio of the two voices with a soft room tone.`;
  }
  return `The same podcast conversation continues in the same studio with the same two hosts, same camera framing. ${dialogue} Clean studio audio of the two voices.`;
}

type VideoJob = {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  progress?: number;
  error?: { code?: string; message?: string };
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function gatewayErrorStatus(status: number) {
  return status >= 400 && status < 600 ? status : 500;
}

async function gatewayJson(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) {
    throw Object.assign(new Error(body?.message ?? `AI request failed (${response.status})`), {
      status: gatewayErrorStatus(response.status),
    });
  }
  return body;
}

if (import.meta.main) serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const backendUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");

    if (!apiKey || !backendUrl || !serviceKey) return jsonResponse({ error: "Podcast generation is not configured" }, 500);
    if (!authorization) return jsonResponse({ error: "Please sign in to create a podcast" }, 401);

    const backend = createClient(backendUrl, serviceKey);
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await backend.auth.getUser(token);
    if (authError || !authData.user) return jsonResponse({ error: "Your session has expired. Please sign in again." }, 401);
    const userId = authData.user.id;

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const action = body?.action;

    if (action === "create_script") {
      const uploadId = body?.uploadId;
      const content = body?.content;
      if (typeof uploadId !== "string" || !UUID_PATTERN.test(uploadId)) return jsonResponse({ error: "Invalid upload" }, 400);
      if (typeof content !== "string" || content.trim().length < 20) return jsonResponse({ error: "Add more study material before creating a podcast" }, 400);
      if (content.length > 50_000) return jsonResponse({ error: "Study material must be at most 50,000 characters" }, 400);

      const { data: upload } = await backend.from("uploads").select("id, file_name").eq("id", uploadId).eq("user_id", userId).maybeSingle();
      if (!upload) return jsonResponse({ error: "Study material not found" }, 404);

      const prompt = `You are the head writer for Apex, a learning platform that turns study notes into ONE short, unified video podcast with two hosts.

Write a single continuous conversation that explains the supplied notes. Host A is a curious student who asks the questions a learner would ask. Host B is an expert tutor who answers clearly with everyday analogies. The conversation must flow naturally from a greeting, through the core ideas, to a short wrap-up — one episode, not separate scenes.

The episode is filmed as ${PART_COUNT} consecutive beats of about 7 seconds each. For every beat write exactly one short line for Host A and one short line for Host B. Each line must be at most 12 spoken words so it fits in the time. Beat 1 opens the show, the last beat wraps it up with the single most important takeaway.

Also describe, once, the podcast studio and each host's appearance and voice in vivid, specific visual terms (age range, clothing, hair, voice tone). These descriptions are reused verbatim for every beat so the hosts look the same throughout. Do not use names, logos, or any on-screen text.

Study material:\n${content.trim()}`;

      const schema = {
        name: "apex_unified_podcast",
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            studio: { type: "string" },
            host_a: { type: "string" },
            host_b: { type: "string" },
            beats: {
              type: "array",
              minItems: PART_COUNT,
              maxItems: PART_COUNT,
              items: {
                type: "object",
                properties: { host_a_line: { type: "string" }, host_b_line: { type: "string" } },
                required: ["host_a_line", "host_b_line"],
                additionalProperties: false,
              },
            },
          },
          required: ["title", "studio", "host_a", "host_b", "beats"],
          additionalProperties: false,
        },
      };

      const aiResponse = await fetch(`${GATEWAY_URL}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: SCRIPT_MODEL,
          input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
          reasoning: { effort: "low" },
          store: false,
          text: { format: { type: "json_schema", name: schema.name, strict: true, schema: schema.schema } },
        }),
      });
      const aiData = await gatewayJson(aiResponse) as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
      const raw = aiData.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
      if (!raw) return jsonResponse({ error: "The podcast script could not be created" }, 502);
      const script = JSON.parse(raw) as PodcastScript;
      if (!Array.isArray(script.beats) || script.beats.length !== PART_COUNT) return jsonResponse({ error: "The podcast script was incomplete" }, 502);

      const { data: episode, error: episodeError } = await backend.from("podcast_episodes").insert({
        user_id: userId,
        upload_id: uploadId,
        title: script.title,
        status: "script_ready",
      }).select().single();
      if (episodeError || !episode) throw new Error("Could not save the podcast episode");

      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const rows = script.beats.map((beat, index) => ({
        episode_id: episode.id,
        user_id: userId,
        segment_order: index + 1,
        concept_title: script.title,
        host_dialogue: `Host A: ${beat.host_a_line}\nHost B: ${beat.host_b_line}`,
        veo_cinematic_prompt: buildBeatPrompt(script, beat, index),
        key_takeaway: "",
        duration_seconds: index === 0 ? 8 : 7,
        seed,
      }));
      const { data: segments, error: segmentError } = await backend.from("podcast_segments").insert(rows).select().order("segment_order");
      if (segmentError || !segments) throw new Error("Could not save the podcast script");
      return jsonResponse({ episode, segments });
    }

    // Generates the next part of the single video: part 1 is a fresh clip, every later part
    // extends the previous merged video so the result is one continuous MP4.
    if (action === "create_video") {
      const segmentId = body?.segmentId;
      if (typeof segmentId !== "string" || !UUID_PATTERN.test(segmentId)) return jsonResponse({ error: "Invalid podcast part" }, 400);
      const { data: segment } = await backend.from("podcast_segments").select("*").eq("id", segmentId).eq("user_id", userId).maybeSingle();
      if (!segment) return jsonResponse({ error: "Podcast part not found" }, 404);
      if (segment.video_job_id && ["queued", "generating"].includes(segment.status)) {
        return jsonResponse({ id: segment.video_job_id, status: segment.status });
      }

      const instance: Record<string, unknown> = { prompt: segment.veo_cinematic_prompt };
      const parameters: Record<string, unknown> = {
        durationSeconds: 8,
        resolution: RESOLUTION,
        sampleCount: 1,
        generateAudio: true,
        seed: segment.seed,
        negativePrompt: "cartoon style, captions, subtitles, visible text, logos, watermarks, background music, extra people",
        personGeneration: "allow_adult",
      };

      if (segment.segment_order === 1) {
        parameters.aspectRatio = "16:9";
      } else {
        const { data: previous } = await backend.from("podcast_segments").select("video_path")
          .eq("episode_id", segment.episode_id).eq("user_id", userId).eq("segment_order", segment.segment_order - 1).maybeSingle();
        if (!previous?.video_path) return jsonResponse({ error: "The previous part of the podcast is not finished yet" }, 409);
        const { data: file, error: downloadError } = await backend.storage.from("podcast-videos").download(previous.video_path);
        if (downloadError || !file) throw new Error("Could not load the podcast so far");
        instance.video = { bytesBase64Encoded: encodeBase64(new Uint8Array(await file.arrayBuffer())), mimeType: "video/mp4" };
        parameters.durationSeconds = 7;
      }

      const response = await fetch(`${GATEWAY_URL}/videos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: VIDEO_MODEL, instances: [instance], parameters }),
      });
      const job = await gatewayJson(response) as VideoJob;
      await backend.from("podcast_segments").update({ video_job_id: job.id, status: "generating", error_message: null }).eq("id", segmentId);
      return jsonResponse(job);
    }

    if (action === "video_status") {
      const segmentId = body?.segmentId;
      if (typeof segmentId !== "string" || !UUID_PATTERN.test(segmentId)) return jsonResponse({ error: "Invalid podcast scene" }, 400);
      const { data: segment } = await backend.from("podcast_segments").select("*").eq("id", segmentId).eq("user_id", userId).maybeSingle();
      if (!segment?.video_job_id) return jsonResponse({ error: "This scene has not started generating" }, 400);

      if (segment.video_path) {
        const { data: signed } = await backend.storage.from("podcast-videos").createSignedUrl(segment.video_path, 3600);
        return jsonResponse({ id: segment.video_job_id, status: "completed", progress: 100, videoUrl: signed?.signedUrl });
      }

      const statusResponse = await fetch(`${GATEWAY_URL}/videos/${encodeURIComponent(segment.video_job_id)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const job = await gatewayJson(statusResponse) as VideoJob;
      if (job.status === "failed") {
        const message = job.error?.message ?? "Video generation failed";
        await backend.from("podcast_segments").update({ status: "failed", error_message: message }).eq("id", segmentId);
        return jsonResponse({ ...job, error: { ...job.error, message } });
      }
      if (job.status !== "completed") return jsonResponse(job);

      const contentResponse = await fetch(`${GATEWAY_URL}/videos/${encodeURIComponent(job.id)}/content`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!contentResponse.ok) return jsonResponse({ error: `Video download failed (${contentResponse.status})` }, 502);
      const bytes = await contentResponse.arrayBuffer();
      const path = `${userId}/${segment.episode_id}/${segment.id}.mp4`;
      const { error: uploadError } = await backend.storage.from("podcast-videos").upload(path, bytes, {
        contentType: "video/mp4",
        upsert: true,
      });
      if (uploadError) throw new Error("The finished video could not be saved");
      await backend.from("podcast_segments").update({ video_path: path, status: "completed", error_message: null }).eq("id", segmentId);
      const { data: signed } = await backend.storage.from("podcast-videos").createSignedUrl(path, 3600);
      return jsonResponse({ ...job, videoUrl: signed?.signedUrl });
    }

    return jsonResponse({ error: "Unknown podcast action" }, 400);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : "Podcast generation failed";
    console.error("generate-podcast:", message);
    return jsonResponse({ error: message }, status);
  }
});