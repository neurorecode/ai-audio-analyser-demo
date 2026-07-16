import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const entry = formData.get("audio");
    if (entry instanceof File) {
      file = entry;
    }
  } catch {
    return NextResponse.json(
      { error: "Could not read the uploaded audio. Send it as multipart/form-data under the 'audio' field." },
      { status: 400 }
    );
  }

  if (!file) {
    return NextResponse.json({ error: "No audio file was provided." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "The audio file is empty." }, { status: 400 });
  }

  // Whisper API limit is 25 MB.
  const MAX_BYTES = 25 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
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

    // With response_format "text" the SDK returns a plain string.
    const transcript = typeof transcription === "string" ? transcription : (transcription as { text?: string }).text ?? "";

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
    return NextResponse.json(
      { error: `Transcription failed: ${message}` },
      { status: 502 }
    );
  }
}
