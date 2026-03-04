/**
 * AI-powered message rewriting for STT transcriptions.
 *
 * Uses Claude Haiku to transform raw speech-to-text into a professional,
 * empathetic response suitable for cram school staff → parent communication.
 *
 * The "Original" version shown to users is the raw transcription (cleaned up
 * by Soniox). The "AI Polished" version is a rewritten, more professional take.
 */

export async function polishTranscription(rawText: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("Anthropic API key not configured, returning raw text");
    return rawText;
  }

  try {
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
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `You are a communication assistant for a Taiwan cram school (補習班). A staff member just dictated a reply to a parent using voice input. Rewrite the message to be:

1. Human and natural — write like a real person, not a corporate template. Keep it conversational and genuine.
2. Professional and warm — suitable for a school staff member writing to a parent, but never stiff or robotic
3. Empathetic — acknowledge the parent's concern before addressing it
4. Clear and actionable — if the message involves next steps, make them concrete
5. Properly punctuated with correct grammar
6. Same language as the original (usually Traditional Chinese or English)
7. Similar length — don't make it significantly longer

Do NOT add greetings like "您好" or sign-offs unless the original had them. Do NOT add information the staff member didn't mention. Just improve how the message reads.

Return ONLY the rewritten message, nothing else.

Staff member's raw dictation: "${rawText}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const polished = data.content?.[0]?.text?.trim();

    if (!polished) {
      return rawText;
    }

    return polished;
  } catch (err) {
    console.warn("Text polishing failed:", err);
    return rawText;
  }
}
