/**
 * Soniox batch transcription via backend stt-transcribe edge function.
 *
 * Client uploads audio file to the edge function, which proxies it
 * to Soniox (keeping the API key server-side).
 */

import { supabase } from "@/lib/supabase";

/**
 * Transcribe an audio file using the backend STT proxy.
 * Returns the full transcript text.
 */
export async function transcribeAudioFile(fileUri: string): Promise<string> {
  // Build FormData with the audio file (React Native style)
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    type: "audio/mp4",
    name: "recording.m4a",
  } as any);

  const { data, error } = await supabase.functions.invoke("stt-transcribe", {
    body: formData,
  });

  if (error || data?.error) {
    throw new Error(data?.error ?? error?.message ?? "Transcription failed");
  }

  return data.transcript ?? "";
}
