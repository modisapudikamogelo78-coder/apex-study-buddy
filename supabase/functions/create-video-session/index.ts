import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Validation helper functions
function validateUUID(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
  return value;
}

function validateString(value: unknown, fieldName: string, minLen: number, maxLen: number): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length < minLen) {
    throw new Error(`${fieldName} must be at least ${minLen} characters`);
  }
  if (trimmed.length > maxLen) {
    throw new Error(`${fieldName} must be at most ${maxLen} characters`);
  }
  return trimmed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Input validation
    let uploadId: string;
    let content: string;
    
    try {
      uploadId = validateUUID(body.uploadId, "uploadId");
      content = validateString(body.content, "content", 1, 51200); // Max 50KB
    } catch (validationError) {
      return new Response(JSON.stringify({ 
        error: validationError instanceof Error ? validationError.message : "Validation error" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const BEYOND_PRESENCE_API_KEY = Deno.env.get("BEYOND_PRESENCE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!BEYOND_PRESENCE_API_KEY) {
      throw new Error("BEYOND_PRESENCE_API_KEY is not configured");
    }

    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify uploadId belongs to the authenticated user
    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .select("id")
      .eq("id", uploadId)
      .eq("user_id", user.id)
      .single();

    if (uploadError || !upload) {
      return new Response(JSON.stringify({ error: "Upload not found or access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Creating video session for user:", user.id);

    // Generate a podcast-style prompt from the notes using AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at creating engaging educational podcast scripts. 
            Given study notes, create a conversational prompt that an AI video host can use to explain the content naturally.
            The prompt should be friendly, engaging, and explain concepts as if having a conversation with a student.
            Focus on the key concepts and make them easy to understand.
            Keep it concise but thorough.`
          },
          {
            role: "user",
            content: `Create a podcast host prompt from these study notes:\n\n${content.substring(0, 8000)}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI generation failed:", await aiResponse.text());
      throw new Error("Failed to generate podcast script");
    }

    const aiData = await aiResponse.json();
    const podcastPrompt = aiData.choices?.[0]?.message?.content || content;

    console.log("Generated podcast prompt, fetching available avatars...");

    // First, fetch available avatars from Beyond Presence
    const avatarsResponse = await fetch("https://api.bey.dev/v1/avatars", {
      method: "GET",
      headers: {
        "x-api-key": BEYOND_PRESENCE_API_KEY,
      },
    });

    if (!avatarsResponse.ok) {
      const errorText = await avatarsResponse.text();
      console.error("Failed to fetch avatars:", errorText);
      throw new Error("Failed to fetch available avatars");
    }

    const avatarsData = await avatarsResponse.json();
    console.log("Available avatars:", JSON.stringify(avatarsData).substring(0, 200));
    
    // Use the first available avatar
    const avatarId = avatarsData?.data?.[0]?.id || avatarsData?.[0]?.id;
    if (!avatarId) {
      throw new Error("No avatars available in your Beyond Presence account");
    }
    
    console.log("Using avatar:", avatarId);

    // Create a Beyond Presence agent with the podcast prompt
    const agentResponse = await fetch("https://api.bey.dev/v1/agents", {
      method: "POST",
      headers: {
        "x-api-key": BEYOND_PRESENCE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Apex Study Session - ${new Date().toISOString()}`,
        avatar_id: avatarId,
        system_prompt: `You are an engaging educational podcast host named Apex. You're explaining study material to a student who uploaded their notes.

${podcastPrompt}

Guidelines:
- Be friendly, warm, and encouraging
- Explain concepts clearly using simple language
- Use examples and analogies to make concepts memorable
- Encourage the student to ask questions
- Break down complex topics into digestible parts
- Be enthusiastic about learning!`,
        greeting: "Hey there! I'm Apex, your study buddy. I've gone through your notes and I'm ready to help you understand everything. What would you like to start with, or should I give you an overview?",
        language: "en",
      }),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error("Beyond Presence agent creation failed:", errorText);
      throw new Error(`Failed to create video agent: ${errorText}`);
    }

    const agentData = await agentResponse.json();
    console.log("Agent created:", agentData);

    // Create video session record
    const { data: session, error: sessionError } = await supabase
      .from("video_sessions")
      .insert({
        user_id: user.id,
        upload_id: uploadId,
        bey_agent_id: agentData.id,
        bey_session_url: `https://bey.chat/${agentData.id}`,
        status: "ready",
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      throw new Error("Failed to create session record");
    }

    return new Response(JSON.stringify({
      success: true,
      session,
      agentUrl: `https://bey.chat/${agentData.id}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
