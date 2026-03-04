import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

const BUCKET = "message-media";

function generateFilename(orgId: string, ext: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${orgId}/${timestamp}_${random}.${ext}`;
}

/**
 * Read a file and return the data suitable for Supabase upload.
 * On mobile: reads as base64 → ArrayBuffer (reliable with file:// URIs).
 * On web: uses fetch → blob (works fine on web).
 */
async function readFileForUpload(
  uri: string,
  contentType: string
): Promise<{ body: ArrayBuffer | Blob; contentType: string }> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return { body: blob, contentType };
  }

  // Mobile: use expo-file-system to read as base64, then decode to ArrayBuffer
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = decode(base64);
  return { body: arrayBuffer, contentType };
}

/**
 * Upload an image to Supabase Storage.
 * Accepts a URI (file:// or blob/data URI) and returns the public URL.
 */
export async function uploadImage(
  uri: string,
  orgId: string
): Promise<string> {
  const ext = uri.split(".").pop()?.split("?")[0] ?? "jpg";
  const filename = generateFilename(orgId, ext);
  const contentType = `image/${ext === "png" ? "png" : "jpeg"}`;

  const { body } = await readFileForUpload(uri, contentType);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, body, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Upload an audio file to Supabase Storage.
 * Accepts a URI (file:// on mobile, blob: on web) and returns the public URL.
 */
export async function uploadAudio(
  uri: string,
  orgId: string,
  mimeType = "audio/mp4"
): Promise<string> {
  const ext = mimeType.startsWith("audio/mp4") ? "m4a" : mimeType.startsWith("audio/ogg") ? "ogg" : "webm";
  const filename = generateFilename(orgId, ext);

  const { body } = await readFileForUpload(uri, mimeType);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, body, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Upload a document/file to Supabase Storage.
 * Accepts a URI and file metadata, returns the public URL.
 */
export async function uploadDocument(
  uri: string,
  orgId: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const ext = fileName.split(".").pop() ?? "bin";
  const storagePath = generateFilename(orgId, ext);
  const contentType = mimeType || "application/octet-stream";

  const { body } = await readFileForUpload(uri, contentType);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, body, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Upload a video file to Supabase Storage.
 * Accepts a URI and file metadata, returns the public URL.
 */
export async function uploadVideo(
  uri: string,
  orgId: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const ext = fileName.split(".").pop() ?? "mp4";
  const storagePath = generateFilename(orgId, ext);
  const contentType = mimeType || "video/mp4";

  const { body } = await readFileForUpload(uri, contentType);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, body, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
