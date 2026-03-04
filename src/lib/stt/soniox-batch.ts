/**
 * Soniox batch REST API for transcribing audio files.
 *
 * Flow: upload file → create transcription job → poll until done → get transcript.
 * Used on mobile where we can't stream raw PCM in real-time.
 */

const SONIOX_API = "https://api.soniox.com/v1";

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_SONIOX_API_KEY;
  if (!key) throw new Error("Soniox API key not configured");
  return key;
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

/** Upload an audio file and return its file_id. */
async function uploadFile(fileUri: string, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    type: "audio/mp4",
    name: "recording.m4a",
  } as any); // React Native FormData accepts { uri, type, name }

  const res = await fetch(`${SONIOX_API}/files`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`File upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.id;
}

/** Create a transcription job and return its transcription_id. */
async function createTranscription(
  fileId: string,
  apiKey: string
): Promise<string> {
  const res = await fetch(`${SONIOX_API}/transcriptions`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_id: fileId,
      model: "stt-async-v4",
      language_hints: ["zh"],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Transcription creation failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.id;
}

/** Poll until the transcription status is "completed". */
async function pollUntilComplete(
  transcriptionId: string,
  apiKey: string,
  maxAttempts = 60,
  intervalMs = 1000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${SONIOX_API}/transcriptions/${transcriptionId}`,
      { headers: authHeaders(apiKey) }
    );

    if (!res.ok) throw new Error(`Poll failed (${res.status})`);

    const data = await res.json();

    if (data.status === "completed") return;
    if (data.status === "error" || data.status === "failed") {
      throw new Error(
        `Transcription failed: ${data.error ?? "unknown error"}`
      );
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Transcription timed out");
}

/** Fetch the transcript text from a completed transcription. */
async function getTranscript(
  transcriptionId: string,
  apiKey: string
): Promise<string> {
  const res = await fetch(
    `${SONIOX_API}/transcriptions/${transcriptionId}/transcript`,
    { headers: authHeaders(apiKey) }
  );

  if (!res.ok) throw new Error(`Get transcript failed (${res.status})`);

  const data = await res.json();
  return (data.tokens ?? [])
    .map((t: { text: string }) => t.text)
    .join("");
}

/**
 * Transcribe an audio file using the Soniox batch API.
 * Returns the full transcript text.
 */
export async function transcribeAudioFile(fileUri: string): Promise<string> {
  const apiKey = getApiKey();

  const fileId = await uploadFile(fileUri, apiKey);
  const transcriptionId = await createTranscription(fileId, apiKey);
  await pollUntilComplete(transcriptionId, apiKey);
  return getTranscript(transcriptionId, apiKey);
}
