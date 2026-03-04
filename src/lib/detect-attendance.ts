/**
 * AI-powered attendance detection from parent messages.
 *
 * V1: Uses Claude API (Haiku) for smart detection of absence/tardiness
 *     from Traditional Chinese parent messages.
 * Fallback: Keyword-based pattern matching if API is unavailable.
 */

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
 * Main entry point: tries Claude API first, falls back to keyword matching.
 */
export async function detectAttendance(
  messageContent: string
): Promise<DetectionResult> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      return await detectWithClaude(messageContent, apiKey);
    } catch (err) {
      console.warn("Claude API detection failed, using keyword fallback:", err);
    }
  }

  return detectWithKeywords(messageContent);
}

/**
 * Claude API detection — uses Haiku for fast, cheap analysis.
 */
async function detectWithClaude(
  content: string,
  apiKey: string
): Promise<DetectionResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are an attendance detection system for a Taiwan cram school (buxiban/補習班). Analyze the following parent message and determine if it indicates a student will be ABSENT or TARDY today.

Message: "${content}"

Respond ONLY with valid JSON in this exact format:
{"detected": true/false, "status": "absent" or "tardy" or null, "confidence": "high" or "medium" or "low", "reasoning": "brief explanation in English"}

Rules:
- "absent" = student won't come at all (請假, 不能來, 缺席, illness, etc.)
- "tardy" = student will be late (遲到, 會晚到, 來不及, etc.)
- Only detect if the message is about TODAY's attendance
- Messages asking about past absences or general questions are NOT attendance notifications
- Be conservative: if unsure, set detected=false`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in Claude response");
  }

  const result = JSON.parse(jsonMatch[0]) as DetectionResult;
  return result;
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
