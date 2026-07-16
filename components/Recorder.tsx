"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 28;

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function Recorder({
  onRecorded,
  recordedFile,
  disabled,
}: {
  onRecorded: (file: File | null) => void;
  recordedFile: File | null;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(new Array(BAR_COUNT).fill(6));
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    rafRef.current = null;
    timerRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  useEffect(() => () => cleanup(), []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const draw = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.floor(data.length / BAR_COUNT) || 1;
    const next: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const v = data[i * step] / 255;
      next.push(6 + v * 38);
    }
    setLevels(next);
    rafRef.current = requestAnimationFrame(draw);
  };

  const start = async () => {
    setError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onRecorded(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        onRecorded(file);
        cleanup();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      draw();
    } catch (err) {
      console.error(err);
      setError(
        "Could not access the microphone. Please grant permission and try again."
      );
      cleanup();
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setLevels(new Array(BAR_COUNT).fill(6));
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSeconds(0);
    onRecorded(null);
  };

  return (
    <div className="recorder">
      {recording ? (
        <div className="waveform" aria-hidden>
          {levels.map((h, i) => (
            <div className="bar" key={i} style={{ height: `${h}px` }} />
          ))}
        </div>
      ) : (
        <div className="timer">{fmt(seconds)}</div>
      )}

      {recording && <div className="timer">{fmt(seconds)}</div>}

      <div style={{ margin: "8px 0 4px" }}>
        <button
          className={`rec-btn${recording ? " recording" : ""}`}
          onClick={recording ? stop : start}
          disabled={disabled}
          aria-label={recording ? "Stop recording" : "Start recording"}
          title={recording ? "Stop" : "Record"}
        >
          {recording ? "■" : "●"}
        </button>
      </div>

      <p className="rec-hint">
        {recording
          ? "Recording… tap to stop"
          : recordedFile
          ? "Recording ready — analyse it below or re-record"
          : "Tap to start recording"}
      </p>

      {error && (
        <div className="alert" style={{ textAlign: "left" }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {previewUrl && !recording && (
        <>
          <audio controls src={previewUrl} />
          {!disabled && (
            <div style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={reset}>
                ↺ Discard & re-record
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
