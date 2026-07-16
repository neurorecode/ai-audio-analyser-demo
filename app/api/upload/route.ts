import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Issues short-lived client upload tokens so the browser can upload large audio
 * files directly to Vercel Blob storage, bypassing the ~4.5 MB limit on request
 * bodies sent to serverless functions.
 */
export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Large-file uploads are not configured. Connect a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.",
      },
      { status: 500 }
    );
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "audio/*",
          "video/mp4",
          "video/webm",
          "application/octet-stream",
        ],
        maximumSizeInBytes: 25 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      // Nothing to persist server-side; the transcribe route deletes the blob
      // as soon as it has been transcribed.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
