import { Mp3Encoder } from "@breezystack/lamejs";

// Speech-optimised output: mono, 16 kHz, low bitrate. This is plenty for
// accurate transcription while shrinking a typical recording ~10x.
const TARGET_RATE = 16000;
const BITRATE_KBPS = 48;
// Each chunk is transcribed by a separate request, in parallel. 5 minutes keeps
// every chunk small (~1.8 MB) — well under the direct-upload limit — and keeps
// the number of chunk boundaries (a small transcription risk) low.
const CHUNK_SECONDS = 300;
const MP3_BLOCK = 1152;

export interface PreparedChunk {
  file: File;
  index: number;
}

export interface PrepareProgress {
  phase: "decoding" | "resampling" | "encoding";
  current: number;
  total: number;
}

/** Yield to the event loop so progress can paint and the UI stays responsive. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function encodeMp3(samples: Int16Array): Blob {
  const encoder = new Mp3Encoder(1, TARGET_RATE, BITRATE_KBPS);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += MP3_BLOCK) {
    const block = samples.subarray(i, i + MP3_BLOCK);
    const buf = encoder.encodeBuffer(block);
    if (buf.length > 0) parts.push(new Uint8Array(buf));
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) parts.push(new Uint8Array(flushed));
  return new Blob(parts as BlobPart[], { type: "audio/mpeg" });
}

/**
 * Decodes any browser-supported audio file, downmixes it to mono 16 kHz, and
 * splits it into MP3 chunks ready for transcription. Throws if the file cannot
 * be decoded (the caller should then fall back to sending the original file).
 */
export async function prepareAudio(
  file: File,
  onProgress?: (p: PrepareProgress) => void
): Promise<PreparedChunk[]> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) throw new Error("Web Audio API is not available in this browser.");

  onProgress?.({ phase: "decoding", current: 0, total: 1 });

  const arrayBuffer = await file.arrayBuffer();
  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    // decodeAudioData may detach the buffer, so hand it a copy.
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    decodeCtx.close().catch(() => {});
  }

  onProgress?.({ phase: "resampling", current: 0, total: 1 });

  const frames = Math.ceil(decoded.duration * TARGET_RATE);
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const mono = floatToInt16(rendered.getChannelData(0));

  const chunkSamples = CHUNK_SECONDS * TARGET_RATE;
  const total = Math.max(1, Math.ceil(mono.length / chunkSamples));
  const chunks: PreparedChunk[] = [];

  for (let index = 0; index < total; index++) {
    onProgress?.({ phase: "encoding", current: index, total });
    await tick();
    const start = index * chunkSamples;
    const slice = mono.subarray(start, Math.min(start + chunkSamples, mono.length));
    const blob = encodeMp3(slice);
    const base = file.name.replace(/\.[^.]+$/, "") || "audio";
    const name = total > 1 ? `${base}-part${index + 1}.mp3` : `${base}.mp3`;
    chunks.push({ file: new File([blob], name, { type: "audio/mpeg" }), index });
  }

  onProgress?.({ phase: "encoding", current: total, total });
  return chunks;
}
