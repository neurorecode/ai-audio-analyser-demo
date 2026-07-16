"use client";

import { useState } from "react";
import AudioUploader from "@/components/AudioUploader";
import Recorder from "@/components/Recorder";
import Results from "@/components/Results";
import { AnalysisResult } from "@/lib/types";
import { requestTranscription } from "@/lib/transcribeClient";

type Mode = "upload" | "record";
type Stage = "idle" | "transcribing" | "analyzing" | "done" | "error";

/**
 * Reads a fetch Response, tolerating non-JSON bodies. Some errors (notably
 * the platform's request-body size limit) come back as plain text rather than
 * JSON, which would otherwise throw a cryptic "Unexpected token" error.
 */
async function readResponse(res: Response): Promise<{ error?: string; [k: string]: unknown }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as { error?: string };
  } catch {
    if (res.status === 413) {
      return {
        error:
          "This file is too large to upload to the server (the hosting platform caps uploads at ~4.5 MB). Please use a shorter or more compressed clip.",
      };
    }
    return {
      error:
        text.slice(0, 200).trim() ||
        `Request failed with status ${res.status}.`,
    };
  }
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const busy = stage === "transcribing" || stage === "analyzing";

  const resetForMode = (m: Mode) => {
    if (busy) return;
    setMode(m);
    setFile(null);
    setStage("idle");
    setError(null);
    setResult(null);
  };

  const analyse = async () => {
    if (!file) return;
    setError(null);
    setResult(null);

    const MAX = 25 * 1024 * 1024;
    if (file.size > MAX) {
      setStage("error");
      setError(
        `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is 25 MB — please use a shorter or more compressed clip.`
      );
      return;
    }

    // Step 1 — transcribe
    setStage("transcribing");
    let transcript = "";
    try {
      const res = await requestTranscription(file);
      const data = await readResponse(res);
      if (!res.ok) throw new Error(data.error || "Transcription failed.");
      transcript = String(data.transcript ?? "");
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Transcription failed.");
      return;
    }

    // Step 2 — analyse
    setStage("analyzing");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await readResponse(res);
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setResult({ transcript, ...(data as Omit<AnalysisResult, "transcript">) });
      setStage("done");
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Analysis failed.");
    }
  };

  const startOver = () => {
    setFile(null);
    setStage("idle");
    setError(null);
    setResult(null);
  };

  return (
    <div className="container">
      <header className="hero">
        <div className="badge">
          <span className="dot" /> Powered by Whisper + Claude
        </div>
        <h1>AI Audio Analyser</h1>
        <p>
          Upload or record a conversation and get an instant transcript, a crisp
          summary, key points, action items and ready-to-share notes.
        </p>
      </header>

      {!result && (
        <>
          <div className="tabs">
            <button
              className={`tab${mode === "upload" ? " active" : ""}`}
              onClick={() => resetForMode("upload")}
              disabled={busy}
            >
              ⭱ Upload
            </button>
            <button
              className={`tab${mode === "record" ? " active" : ""}`}
              onClick={() => resetForMode("record")}
              disabled={busy}
            >
              ● Record
            </button>
          </div>

          <div className="card">
            {mode === "upload" ? (
              <AudioUploader file={file} onFile={setFile} disabled={busy} />
            ) : (
              <Recorder
                recordedFile={file}
                onRecorded={setFile}
                disabled={busy}
              />
            )}

            <button
              className="btn btn-primary"
              onClick={analyse}
              disabled={!file || busy}
            >
              {busy ? (
                <>
                  <span className="spinner" /> Working…
                </>
              ) : (
                <>✨ Analyse audio</>
              )}
            </button>

            {busy && (
              <div className="status">
                <Step
                  state={stage === "transcribing" ? "active" : "done"}
                  label="Transcribing audio"
                />
                <Step
                  state={
                    stage === "analyzing"
                      ? "active"
                      : stage === "transcribing"
                      ? "pending"
                      : "done"
                  }
                  label="Summarising & taking notes"
                />
              </div>
            )}

            {error && (
              <div className="alert">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        </>
      )}

      {result && (
        <>
          <div style={{ textAlign: "center" }}>
            <button className="btn-ghost" onClick={startOver}>
              ← Analyse another
            </button>
          </div>
          <Results result={result} />
        </>
      )}

      <footer className="footer">
        <p>
          Your audio is sent to OpenAI (transcription) and Anthropic (analysis)
          for processing and is not stored by this app.
        </p>
      </footer>
    </div>
  );
}

function Step({
  state,
  label,
}: {
  state: "pending" | "active" | "done";
  label: string;
}) {
  return (
    <div className={`step ${state}`}>
      <span className="ico">
        {state === "active" ? (
          <span className="spinner" />
        ) : state === "done" ? (
          "✓"
        ) : (
          "○"
        )}
      </span>
      <span className="label">{label}</span>
    </div>
  );
}
