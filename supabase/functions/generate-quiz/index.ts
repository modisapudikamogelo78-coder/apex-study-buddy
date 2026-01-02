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

function validateCount(value: unknown): number {
  const num = typeof value === "number" ? value : parseInt(String(value), 10);
  if (isNaN(num) || num < 1 || num > 20) {
    throw new Error("count must be a number between 1 and 20");
  }
  return num;
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
    let count: number;
    
    try {
      uploadId = validateUUID(body.uploadId, "uploadId");
      content = validateString(body.content, "content", 1, 51200); // Max 50KB
      count = body.count !== undefined ? validateCount(body.count) : 10;
    } catch (validationError) {
      return new Response(JSON.stringify({ 
        error: validationError instanceof Error ? validationError.message : "Validation error" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
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

    console.log("Generating quiz for user:", user.id, "count:", count);

    // Generate quiz questions using AI with tool calling
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
            content: `You are an expert quiz creator. Generate multiple choice questions from study notes.
            Each question should test understanding, not just memorization.
            Include a mix of difficulty levels.`
          },
          {
            role: "user",
            content: `Generate ${count} multiple choice questions from these study notes:\n\n${content.substring(0, 10000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_quiz",
              description: "Create a set of multiple choice quiz questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 4,
                          maxItems: 4
                        },
                        correctAnswer: { 
                          type: "integer",
                          description: "Index of the correct answer (0-3)"
                        },
                        explanation: { type: "string" }
                      },
                      required: ["question", "options", "correctAnswer", "explanation"]
                    }
                  }
                },
                required: ["questions"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_quiz" } }
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
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add funds to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("Failed to generate quiz questions");
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No quiz data generated");
    }

    const quizData = JSON.parse(toolCall.function.arguments);
    const questions = quizData.questions;

    // Store questions in database
    const questionsToInsert = questions.map((q: any) => ({
      upload_id: uploadId,
      user_id: user.id,
      question: q.question,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation,
    }));

    const { data: insertedQuestions, error: insertError } = await supabase
      .from("quiz_questions")
      .insert(questionsToInsert)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save quiz questions");
    }

    return new Response(JSON.stringify({
      success: true,
      questions: insertedQuestions,
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
