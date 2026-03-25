/**
 * AI-powered attendance detection from parent messages.
 *
 * V1: Uses Claude API (Haiku) via backend ai-proxy edge function.
 * Fallback: Keyword-based pattern matching if API is unavailable.
 */

import { supabase } from "@/lib/supabase";

export interface DetectionResult {
  detected: boolean;
  status: "absent" | "tardy" | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

const NO_MATCH: DetectionResult = {
  detected: false,
  status: null,
  confidence: "low",
  reasoning: "No attendance patterns detected",
};

/**
 * Main entry point: tries AI proxy first, falls back to keyword matching.
 */
export async function detectAttendance(
  messageContent: string
): Promise<DetectionResult> {
  try {
    return await detectWithProxy(messageContent);
  } catch (err) {
    console.warn("AI proxy detection failed, using keyword fallback:", err);
  }

  return detectWithKeywords(messageContent);
}

/**
 * AI detection via backend proxy (keeps API key server-side).
 */
async function detectWithProxy(content: string): Promise<DetectionResult> {
  const { data, error } = await supabase.functions.invoke("ai-proxy", {
    body: { action: "detect_attendance", content },
  });

  if (error || data?.error) {
    throw new Error(data?.error ?? error?.message ?? "AI proxy failed");
  }

  const text: string = data.result ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in AI response");
  }

  return JSON.parse(jsonMatch[0]) as DetectionResult;
}

/**
 * Keyword-based fallback detection for Traditional Chinese messages.
 */
function detectWithKeywords(content: string): DetectionResult {
  const text = content.trim();

  // Absent: high confidence
  const absentHigh = [
    /請假/,
    /今天不能來/,
    /今天無法來/,
    /今天沒辦法來/,
    /不能上課/,
    /無法上課/,
    /沒辦法上課/,
    /不來上課/,
    /缺席/,
    /不能到/,
    /無法到/,
  ];

  // Absent: medium confidence (illness/situation)
  const absentMedium = [
    /發燒/,
    /生病/,
    /感冒/,
    /不舒服/,
    /身體不適/,
    /拉肚子/,
    /看醫生/,
    /掛急診/,
    /住院/,
    /受傷/,
    /家裡有事/,
    /有事請假/,
    /頭痛/,
  ];

  // Tardy: high confidence
  const tardyHigh = [
    /遲到/,
    /會晚到/,
    /晚一點到/,
    /晚點到/,
    /會慢到/,
    /比較晚到/,
    /來不及/,
    /趕不上/,
    /晚一點去/,
  ];

  // Tardy: medium confidence
  const tardyMedium = [/塞車/, /在路上/, /快到了/];

  for (const p of absentHigh) {
    if (p.test(text))
      return { detected: true, status: "absent", confidence: "high", reasoning: `Keyword: ${p.source}` };
  }
  for (const p of tardyHigh) {
    if (p.test(text))
      return { detected: true, status: "tardy", confidence: "high", reasoning: `Keyword: ${p.source}` };
  }
  for (const p of absentMedium) {
    if (p.test(text))
      return { detected: true, status: "absent", confidence: "medium", reasoning: `Keyword: ${p.source}` };
  }
  for (const p of tardyMedium) {
    if (p.test(text))
      return { detected: true, status: "tardy", confidence: "medium", reasoning: `Keyword: ${p.source}` };
  }

  return NO_MATCH;
}
