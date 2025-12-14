import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { uploadId, content, difficulty = "medium" } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Generating question paper for user:", user.id, "difficulty:", difficulty);

    // Generate question paper using AI
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
            content: `You are an expert exam paper creator. Create professional exam-style question papers.
            Include a variety of question types: multiple choice, short answer, and long answer questions.
            Format the paper with clear sections and point allocations.
            Difficulty level: ${difficulty}`
          },
          {
            role: "user",
            content: `Create an exam paper from these study notes:\n\n${content.substring(0, 10000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_paper",
              description: "Create a structured exam paper",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  totalMarks: { type: "integer" },
                  duration: { type: "string" },
                  instructions: { type: "array", items: { type: "string" } },
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        questions: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              number: { type: "integer" },
                              type: { type: "string", enum: ["mcq", "short", "long"] },
                              question: { type: "string" },
                              marks: { type: "integer" },
                              options: { type: "array", items: { type: "string" } },
                              answer: { type: "string" }
                            },
                            required: ["number", "type", "question", "marks", "answer"]
                          }
                        }
                      },
                      required: ["name", "questions"]
                    }
                  }
                },
                required: ["title", "totalMarks", "duration", "sections"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_paper" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI generation failed:", errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("Failed to generate question paper");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No paper data generated");
    }

    const paperContent = JSON.parse(toolCall.function.arguments);

    // Store paper in database
    const { data: paper, error: insertError } = await supabase
      .from("question_papers")
      .insert({
        upload_id: uploadId,
        user_id: user.id,
        title: paperContent.title,
        content: paperContent,
        difficulty,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save question paper");
    }

    return new Response(JSON.stringify({
      success: true,
      paper,
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
