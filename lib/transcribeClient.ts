import { upload } from "@vercel/blob/client";

// Stay comfortably under the hosting platform's ~4.5 MB function body limit.
const DIRECT_LIMIT = 4 * 1024 * 1024;
// How many chunks to transcribe at once. Keeps long recordings fast without
// hammering the transcription API with dozens of simultaneous requests.
const MAX_CONCURRENCY = 4;

/**
 * Reads a fetch Response, tolerating non-JSON bodies. Some errors (notably the
 * platform's request-body size limit) come back as plain text rather than JSON,
 * which would otherwise throw a cryptic "Unexpected token" error.
 */
export async function readResponse(
  res: Response
): Promise<{ error?: string; [k: string]: unknown }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as { error?: string };
  } catch {
    if (res.status === 413) {
      return {
        error:
          "This file is too large to upload to the server. Please use a shorter or more compressed clip.",
      };
    }
    return {
      error: text.slice(0, 200).trim() || `Request failed with status ${res.status}.`,
    };
  }
}

/** Transcribes a single (already small) audio file via a direct multipart POST. */
export async function transcribeChunk(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("audio", file);
  const res = await fetch("/api/transcribe", { method: "POST", body: fd });
  const data = await readResponse(res);
  if (!res.ok) throw new Error(data.error || "Transcription failed.");
  return String(data.transcript ?? "");
}

/**
 * Runs an async mapper over items with a bounded concurrency, preserving input
 * order in the returned array.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export const chunkConcurrency = MAX_CONCURRENCY;

/**
 * Fallback transcription for when in-browser compression is unavailable (e.g. a
 * format the browser can't decode). Sends the original file directly if small,
 * otherwise via Vercel Blob to bypass the function body cap.
 */
export async function requestTranscription(file: File): Promise<Response> {
  if (file.size <= DIRECT_LIMIT) {
    const fd = new FormData();
    fd.append("audio", file);
    return fetch("/api/transcribe", { method: "POST", body: fd });
  }

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
    throw new Error(`Could not upload the audio for processing. ${message}`.trim());
  }

  return fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: blobUrl, name: file.name, type: file.type }),
  });
}
