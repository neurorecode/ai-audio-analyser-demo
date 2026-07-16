"use client";

import { useRef, useState, DragEvent } from "react";

const ACCEPTED = "audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.mp4,.mpeg,.mpga";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AudioUploader({
  file,
  onFile,
  disabled,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div>
      <div
        className={`dropzone${drag ? " drag" : ""}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <div className="icon">🎵</div>
        <h3>Drop an audio file here</h3>
        <p>
          or <span className="browse">browse</span> — MP3, WAV, M4A, OGG, WEBM · up
          to 25&nbsp;MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          hidden
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {file && (
        <div className="filepill">
          <div className="meta">
            <span style={{ fontSize: 20 }}>📄</span>
            <div style={{ minWidth: 0 }}>
              <div className="name">{file.name}</div>
              <div className="size">{formatSize(file.size)}</div>
            </div>
          </div>
          {!disabled && (
            <button
              className="btn-icon"
              onClick={() => onFile(null)}
              aria-label="Remove file"
              title="Remove"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
