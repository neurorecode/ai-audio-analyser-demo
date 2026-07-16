import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
// Whisper API hard limit.
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const contentType = req.headers.get("content-type") || "";

  // Blob to delete after transcription (only set on the large-file path).
  let blobUrlToClean: string | null = null;
  let file: File | null = null;

  try {
    if (contentType.includes("application/json")) {
      // Large-file path: the browser uploaded straight to Vercel Blob and sent
      // us the resulting URL. Fetch it back here and stream it to Whisper.
      const body = await req.json();
      const url = typeof body?.url === "string" ? body.url : "";
      const name = typeof body?.name === "string" ? body.name : "audio";
      const type = typeof body?.type === "string" ? body.type : "";

      if (!url) {
        return NextResponse.json({ error: "No audio URL was provided." }, { status: 400 });
      }
      blobUrlToClean = url;

      const resp = await fetch(url);
      if (!resp.ok) {
        return NextResponse.json(
          { error: "Could not retrieve the uploaded audio for processing." },
          { status: 502 }
        );
      }
      const data = await resp.blob();
      file = new File([data], name, { type: type || data.type || "audio/mpeg" });
    } else {
      // Small-file path: direct multipart upload (works locally without Blob).
      const formData = await req.formData();
      const entry = formData.get("audio");
      if (entry instanceof File) file = entry;
    }
  } catch {
    return NextResponse.json(
      { error: "Could not read the uploaded audio." },
      { status: 400 }
    );
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No audio file was provided." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    await cleanup(blobUrlToClean);
    return NextResponse.json(
      {
        error: `Audio is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum is 25 MB. Try a shorter clip or compress it.`,
      },
      { status: 413 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: TRANSCRIBE_MODEL,
      response_format: "text",
    });

    const transcript =
      typeof transcription === "string"
        ? transcription
        : (transcription as { text?: string }).text ?? "";

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "No speech could be detected in the audio." },
        { status: 422 }
      );
    }

    return NextResponse.json({ transcript: transcript.trim() });
  } catch (err) {
    console.error("Transcription failed:", err);
    const message = err instanceof Error ? err.message : "Unknown transcription error.";
    return NextResponse.json({ error: `Transcription failed: ${message}` }, { status: 502 });
  } finally {
    await cleanup(blobUrlToClean);
  }
}

async function cleanup(url: string | null) {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(url);
  } catch (err) {
    console.error("Failed to delete temporary blob:", err);
  }
}
