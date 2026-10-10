import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const SCRIPT_MODEL = "openai/gpt-6-astra";
const VIDEO_MODEL = "google/veo-3.1-fast";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PodcastSegment = {
  segment_id: number;
  concept_title: string;
  host_dialogue: string;
  veo_cinematic_prompt: string;
  key_takeaway: string;
};

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

serve(async (request) => {
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

      const prompt = `You are an expert AI Video Producer and Curriculum Designer for Apex, a learning platform that turns study material into high-retention educational micro-podcasts.

Analyze the supplied notes and return exactly 4 bite-sized visual podcast segments. Every segment must contain:
- a short, punchy concept title;
- a natural two-host dialogue where Host A is a curious student and Host B is an expert tutor using clear analogies;
- one production-grade Veo prompt following this exact order: Camera Movement + Subject and 3D Motion Graphics + Lighting and Atmospheric Mood + Environment Details + Synchronized Audio Cues;
- one-sentence key takeaway.

Every Veo prompt must explicitly say vertical 9:16, mobile-first composition. Use professional filmmaking and rendering language such as macro tracking shot, isometric 3D cutaway, smooth push-in, volumetric studio lighting, and clean minimalist UI motion design. Describe textures, physics, and lighting precisely. End with synchronized audio cues. Keep one visual moment per segment, maintain a consistent clean modern educational-documentary identity across the full episode, and avoid cartoonish visuals, logos, captions, subtitles, and visible text.

Study material:\n${content.trim()}`;

      const schema = {
        name: "apex_podcast_segments",
        strict: true,
        schema: {
          type: "object",
          properties: {
            segments: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  segment_id: { type: "integer" },
                  concept_title: { type: "string" },
                  host_dialogue: { type: "string" },
                  veo_cinematic_prompt: { type: "string" },
                  key_takeaway: { type: "string" },
                },
                required: ["segment_id", "concept_title", "host_dialogue", "veo_cinematic_prompt", "key_takeaway"],
                additionalProperties: false,
              },
            },
          },
          required: ["segments"],
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
      const parsed = JSON.parse(raw) as { segments?: PodcastSegment[] };
      if (!Array.isArray(parsed.segments) || parsed.segments.length !== 4) return jsonResponse({ error: "The podcast script was incomplete" }, 502);

      const { data: episode, error: episodeError } = await backend.from("podcast_episodes").insert({
        user_id: userId,
        upload_id: uploadId,
        title: `${upload.file_name} — Visual Podcast`,
        status: "script_ready",
      }).select().single();
      if (episodeError || !episode) throw new Error("Could not save the podcast episode");

      const seedBase = crypto.getRandomValues(new Uint32Array(1))[0];
      const rows = parsed.segments.map((segment, index) => ({
        episode_id: episode.id,
        user_id: userId,
        segment_order: index + 1,
        concept_title: segment.concept_title,
        host_dialogue: segment.host_dialogue,
        veo_cinematic_prompt: segment.veo_cinematic_prompt,
        key_takeaway: segment.key_takeaway,
        duration_seconds: 8,
        seed: (seedBase + index) % 4_294_967_295,
      }));
      const { data: segments, error: segmentError } = await backend.from("podcast_segments").insert(rows).select().order("segment_order");
      if (segmentError || !segments) throw new Error("Could not save the podcast scenes");
      return jsonResponse({ episode, segments });
    }

    if (action === "create_video") {
      const segmentId = body?.segmentId;
      if (typeof segmentId !== "string" || !UUID_PATTERN.test(segmentId)) return jsonResponse({ error: "Invalid podcast scene" }, 400);
      const { data: segment } = await backend.from("podcast_segments").select("*").eq("id", segmentId).eq("user_id", userId).maybeSingle();
      if (!segment) return jsonResponse({ error: "Podcast scene not found" }, 404);
      if (segment.video_job_id && ["queued", "generating"].includes(segment.status)) {
        return jsonResponse({ id: segment.video_job_id, status: segment.status });
      }

      const response = await fetch(`${GATEWAY_URL}/videos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: VIDEO_MODEL,
          instances: [{ prompt: segment.veo_cinematic_prompt }],
          parameters: {
            durationSeconds: 8,
            resolution: "1080p",
            sampleCount: 1,
            aspectRatio: "9:16",
            generateAudio: true,
            seed: segment.seed,
            negativePrompt: "cartoon style, cheap animation, logos, captions, subtitles, visible text, watermarks, landscape framing",
            personGeneration: "allow_adult",
          },
        }),
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