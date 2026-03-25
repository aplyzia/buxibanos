/**
 * STT Transcribe — proxies Soniox batch transcription API so the
 * API key stays server-side.
 *
 * Flow: client uploads audio file → this function uploads to Soniox,
 * polls until completion, and returns the transcript.
 *
 * Auth: Supabase JWT (staff only).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SONIOX_API_KEY = Deno.env.get("SONIOX_API_KEY")!;
const SONIOX_API = "https://api.soniox.com/v1";
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

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${SONIOX_API_KEY}` };
}

async function uploadToSoniox(audioData: ArrayBuffer, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", new Blob([audioData], { type: "audio/mp4" }), filename);

  const res = await fetch(`${SONIOX_API}/files`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Soniox file upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.id;
}

async function createTranscription(fileId: string): Promise<string> {
  const res = await fetch(`${SONIOX_API}/transcriptions`, {
    method: "POST",
    headers: {
      ...authHeaders(),
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
    throw new Error(`Soniox transcription creation failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.id;
}

async function pollUntilComplete(transcriptionId: string): Promise<void> {
  const maxAttempts = 60;
  const intervalMs = 1000;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${SONIOX_API}/transcriptions/${transcriptionId}`,
      { headers: authHeaders() }
    );

    if (!res.ok) throw new Error(`Poll failed (${res.status})`);

    const data = await res.json();
    if (data.status === "completed") return;
    if (data.status === "error" || data.status === "failed") {
      throw new Error(`Transcription failed: ${data.error ?? "unknown error"}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Transcription timed out");
}

async function getTranscript(transcriptionId: string): Promise<string> {
  const res = await fetch(
    `${SONIOX_API}/transcriptions/${transcriptionId}/transcript`,
    { headers: authHeaders() }
  );

  if (!res.ok) throw new Error(`Get transcript failed (${res.status})`);

  const data = await res.json();
  return (data.tokens ?? [])
    .map((t: { text: string }) => t.text)
    .join("");
}

// ── Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: verify JWT
    const authHeaderVal = req.headers.get("Authorization");
    if (!authHeaderVal) {
      return jsonRes({ error: "Missing authorization" }, 401);
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeaderVal } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    // Accept multipart form with audio file
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return jsonRes({ error: "file is required (multipart form)" }, 400);
    }

    const audioData = await file.arrayBuffer();
    const fileId = await uploadToSoniox(audioData, file.name || "recording.m4a");
    const transcriptionId = await createTranscription(fileId);
    await pollUntilComplete(transcriptionId);
    const transcript = await getTranscript(transcriptionId);

    return jsonRes({ transcript });
  } catch (err) {
    console.error("stt-transcribe error:", err);
    return jsonRes({ error: String(err) }, 500);
  }
});
