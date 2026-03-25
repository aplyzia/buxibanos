/**
 * AI Proxy — routes Anthropic API calls through the backend so the
 * API key never reaches the client bundle.
 *
 * Supported actions:
 *   - detect_attendance: analyze a parent message for absence/tardiness
 *   - polish_text: rewrite raw STT transcription for professional tone
 *
 * Auth: Supabase JWT (staff only).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ALLOWED_ORIGIN = Deno.env.get("CORS_ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Prompts ────────────────────────────────────────────────────────────

const DETECT_ATTENDANCE_PROMPT = (content: string) =>
  `You are an attendance detection system for a Taiwan cram school (buxiban/補習班). Analyze the following parent message and determine if it indicates a student will be ABSENT or TARDY today.

Message: "${content}"

Respond ONLY with valid JSON in this exact format:
{"detected": true/false, "status": "absent" or "tardy" or null, "confidence": "high" or "medium" or "low", "reasoning": "brief explanation in English"}

Rules:
- "absent" = student won't come at all (請假, 不能來, 缺席, illness, etc.)
- "tardy" = student will be late (遲到, 會晚到, 來不及, etc.)
- Only detect if the message is about TODAY's attendance
- Messages asking about past absences or general questions are NOT attendance notifications
- Be conservative: if unsure, set detected=false`;

const POLISH_TEXT_PROMPT = (rawText: string) =>
  `You are a communication assistant for a Taiwan cram school (補習班). A staff member just dictated a reply to a parent using voice input. Rewrite the message to be:

1. Human and natural — write like a real person, not a corporate template. Keep it conversational and genuine.
2. Professional and warm — suitable for a school staff member writing to a parent, but never stiff or robotic
3. Empathetic — acknowledge the parent's concern before addressing it
4. Clear and actionable — if the message involves next steps, make them concrete
5. Properly punctuated with correct grammar
6. Same language as the original (usually Traditional Chinese or English)
7. Similar length — don't make it significantly longer

Do NOT add greetings like "您好" or sign-offs unless the original had them. Do NOT add information the staff member didn't mention. Just improve how the message reads.

Return ONLY the rewritten message, nothing else.

Staff member's raw dictation: "${rawText}"`;

// ── Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ error: "Missing authorization" }, 401);
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const { action, content } = await req.json() as {
      action: string;
      content: string;
    };

    if (!action || !content) {
      return jsonRes({ error: "action and content are required" }, 400);
    }

    let prompt: string;
    let maxTokens: number;

    switch (action) {
      case "detect_attendance":
        prompt = DETECT_ATTENDANCE_PROMPT(content);
        maxTokens = 200;
        break;
      case "polish_text":
        prompt = POLISH_TEXT_PROMPT(content);
        maxTokens = 400;
        break;
      default:
        return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return jsonRes({ error: "AI service unavailable" }, 502);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    return jsonRes({ result: text });
  } catch (err) {
    console.error("ai-proxy error:", err);
    return jsonRes({ error: String(err) }, 500);
  }
});
