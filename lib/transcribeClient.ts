import { upload } from "@vercel/blob/client";

// Stay comfortably under the hosting platform's ~4.5 MB function body limit.
// Files at or below this go straight to the API; larger files are uploaded to
// Vercel Blob first and transcribed from their URL.
const DIRECT_LIMIT = 4 * 1024 * 1024;

/**
 * Sends the audio for transcription, choosing the transport based on size.
 * Returns the raw fetch Response from /api/transcribe so the caller can parse
 * and surface errors consistently.
 */
export async function requestTranscription(file: File): Promise<Response> {
  if (file.size <= DIRECT_LIMIT) {
    const fd = new FormData();
    fd.append("audio", file);
    return fetch("/api/transcribe", { method: "POST", body: fd });
  }

  // Large file: upload directly to Vercel Blob, bypassing the function body cap.
  let blobUrl: string;
  try {
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      contentType: file.type || undefined,
    });
    blobUrl = blob.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    throw new Error(
      `Could not upload the audio for processing. ${message}`.trim()
    );
  }

  return fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: blobUrl, name: file.name, type: file.type }),
  });
}
