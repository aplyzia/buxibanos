/**
 * AI-powered message rewriting for STT transcriptions.
 *
 * Uses Claude Haiku via backend ai-proxy edge function to transform
 * raw speech-to-text into professional, empathetic responses.
 */

import { supabase } from "@/lib/supabase";

export async function polishTranscription(rawText: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-proxy", {
      body: { action: "polish_text", content: rawText },
    });

    if (error || data?.error) {
      console.warn("Text polishing failed:", data?.error ?? error?.message);
      return rawText;
    }

    const polished = data.result?.trim();
    return polished || rawText;
  } catch (err) {
    console.warn("Text polishing failed:", err);
    return rawText;
  }
}
