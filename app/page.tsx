"use client";

import { useState } from "react";
import AudioUploader from "@/components/AudioUploader";
import Recorder from "@/components/Recorder";
import Results from "@/components/Results";
import { AnalysisResult } from "@/lib/types";
import {
  readResponse,
  requestTranscription,
  transcribeChunk,
  mapWithConcurrency,
  chunkConcurrency,
} from "@/lib/transcribeClient";
import { prepareAudio } from "@/lib/audio";

type Mode = "upload" | "record";
type Stage = "idle" | "preparing" | "transcribing" | "analyzing" | "done" | "error";

export default function Home() {
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  // Progress detail for the transcription step (chunks done / total).
  const [chunkDone, setChunkDone] = useState(0);
  const [chunkTotal, setChunkTotal] = useState(0);

  const busy = stage === "preparing" || stage === "transcribing" || stage === "analyzing";

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
    setChunkDone(0);
    setChunkTotal(0);

    const MAX = 25 * 1024 * 1024;
    if (file.size > MAX) {
      setStage("error");
      setError(
        `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is 25 MB — please use a shorter or more compressed clip.`
      );
      return;
    }

    // Step 1 — compress & split into speech-optimised chunks (with fallback).
    setStage("preparing");
    let transcript = "";
    try {
      let chunks = null as Awaited<ReturnType<typeof prepareAudio>> | null;
      try {
        chunks = await prepareAudio(file);
      } catch (prepErr) {
        // Browser couldn't decode/encode this file — fall back to the raw path.
        console.warn("Audio compression unavailable, using original file:", prepErr);
        chunks = null;
      }

      // Step 2 — transcribe.
      setStage("transcribing");
      if (chunks && chunks.length > 0) {
        setChunkTotal(chunks.length);
        const parts = await mapWithConcurrency(
          chunks,
          chunkConcurrency,
          async (chunk) => {
            const text = await transcribeChunk(chunk.file);
            setChunkDone((n) => n + 1);
            return { index: chunk.index, text };
          }
        );
        transcript = parts
          .sort((a, b) => a.index - b.index)
          .map((p) => p.text)
          .join("\n")
          .trim();
      } else {
        const res = await requestTranscription(file);
        const data = await readResponse(res);
        if (!res.ok) throw new Error(data.error || "Transcription failed.");
        transcript = String(data.transcript ?? "");
      }

      if (!transcript) throw new Error("No speech could be detected in the audio.");
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Transcription failed.");
      return;
    }

    // Step 3 — analyse.
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
    setChunkDone(0);
    setChunkTotal(0);
  };

  const transcribeLabel =
    stage === "transcribing" && chunkTotal > 1
      ? `Transcribing audio (${chunkDone}/${chunkTotal} parts)`
      : "Transcribing audio";

  // Map the current stage to each step's visual state.
  const stepOrder: Stage[] = ["preparing", "transcribing", "analyzing"];
  const stepState = (s: Stage): "pending" | "active" | "done" => {
    const cur = stepOrder.indexOf(stage);
    const idx = stepOrder.indexOf(s);
    if (cur === -1) return "done"; // stage === "done": everything finished
    if (idx < cur) return "done";
    if (idx === cur) return "active";
    return "pending";
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
                <Step state={stepState("preparing")} label="Compressing audio" />
                <Step state={stepState("transcribing")} label={transcribeLabel} />
                <Step
                  state={stepState("analyzing")}
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
          Your audio is compressed in your browser, then sent to OpenAI
          (transcription) and Anthropic (analysis) for processing. It is not
          stored by this app.
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
