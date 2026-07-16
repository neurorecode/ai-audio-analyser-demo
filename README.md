# 🎙️ AI Audio Analyser

An AI-powered web app that turns audio conversations into **transcripts, summaries, key points, action items and ready-to-share notes**.

- **Upload** an audio file (MP3, WAV, M4A, OGG, WEBM…), or
- **Record** directly from your microphone in the browser.

Transcription is handled by **OpenAI Whisper**; summarisation and note-taking by **Anthropic Claude**.

---

## ✨ Features

- 📤 **Upload audio** — drag & drop or browse (up to 25 MB).
- 🔴 **Record live** — capture microphone audio with a live waveform + timer, preview it, then analyse.
- 📝 **Transcription** — full verbatim transcript via Whisper.
- 💡 **Smart analysis** — Claude produces:
  - a concise **summary**,
  - **key points**,
  - **action items**,
  - detailed **meeting-style notes** (Markdown).
- 📋 **Copy** any section or 📥 **download** everything as a Markdown file.
- 🎨 Clean, responsive dark UI.

---

## 🚀 Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure API keys

Copy the example env file and fill in your keys:

```bash
cp .env.example .env.local
```

```env
OPENAI_API_KEY=sk-...        # https://platform.openai.com/api-keys
ANTHROPIC_API_KEY=sk-ant-... # https://console.anthropic.com/settings/keys
```

To support files larger than ~4.5 MB (see [Large uploads](#-large-uploads)), also add a
**Vercel Blob** token:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

Optional overrides:

```env
OPENAI_TRANSCRIBE_MODEL=whisper-1
ANTHROPIC_MODEL=claude-sonnet-5
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Production build

```bash
npm run build
npm run start
```

---

## 🧱 How it works

```
Browser (upload / record)
        │  multipart audio
        ▼
/api/transcribe  ──►  OpenAI Whisper  ──►  transcript
        │
        ▼  transcript (JSON)
/api/analyze     ──►  Anthropic Claude ──►  { summary, keyPoints, actionItems, notes, title }
        │
        ▼
     Results UI  (copy / download)
```

API keys stay server-side in the Next.js route handlers — they are never exposed to the browser.

---

## 📁 Project structure

```
app/
  layout.tsx            Root layout & metadata
  page.tsx              Main UI (upload/record → analyse → results)
  globals.css           Styles
  api/
    transcribe/route.ts Whisper transcription endpoint
    analyze/route.ts    Claude analysis endpoint
components/
  AudioUploader.tsx     Drag & drop / file picker
  Recorder.tsx          Microphone recording + waveform
  Results.tsx           Transcript, summary, notes, export
lib/
  types.ts              Shared types
  markdown.ts           Minimal Markdown → HTML renderer
```

---

## ☁️ Deploy

Deploys cleanly to **Vercel** (or any Node host). Set `OPENAI_API_KEY` and
`ANTHROPIC_API_KEY` as environment variables in your hosting dashboard.

---

## 📦 Large uploads

Serverless hosts (Vercel) cap a request body sent to a function at **~4.5 MB**,
but Whisper accepts up to **25 MB**. To bridge that gap the app uses
**Vercel Blob**:

- Files **≤ 4 MB** → uploaded directly to `/api/transcribe` (works locally with
  no extra setup).
- Files **> 4 MB** → uploaded straight to Vercel Blob from the browser, then the
  server fetches the blob, transcribes it, and **deletes it immediately**.

To enable large uploads, create a Blob store in your Vercel project (Storage →
Blob). Vercel injects `BLOB_READ_WRITE_TOKEN` automatically; for local dev run
`vercel env pull .env.local`. Without the token, files over 4 MB return a clear
"not configured" message and smaller files still work.

## ⚠️ Notes & limits

- Whisper caps uploads at **25 MB** — the app validates this on both the client
  and server and returns a clear error.
- Audio is streamed to OpenAI and Anthropic for processing and is **not stored**
  by the app (temporary blobs are deleted right after transcription).
- Microphone recording requires a **secure context** (HTTPS or `localhost`) and
  browser permission.

## 🛠️ Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · OpenAI SDK · Anthropic SDK
