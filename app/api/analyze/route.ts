import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const analysisTool: Anthropic.Tool = {
  name: "save_analysis",
  description:
    "Save the structured analysis of the transcribed conversation. Always call this exactly once with all fields filled in.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "A short, descriptive title for the conversation (max ~8 words).",
      },
      summary: {
        type: "string",
        description:
          "A concise 2-4 sentence prose summary capturing the essence of the conversation.",
      },
      keyPoints: {
        type: "array",
        items: { type: "string" },
        description: "The most important takeaways, as short standalone bullet points.",
      },
      actionItems: {
        type: "array",
        items: { type: "string" },
        description:
          "Concrete action items, follow-ups, tasks or decisions. Empty array if none were discussed.",
      },
      notes: {
        type: "string",
        description:
          "Well-structured, meeting-style notes in Markdown. Use headings, bullet lists and bold text. Organise by topic. This should be detailed enough to stand alone as a written record.",
      },
    },
    required: ["title", "summary", "keyPoints", "actionItems", "notes"],
  },
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let transcript = "";
  try {
    const body = await req.json();
    transcript = typeof body?.transcript === "string" ? body.transcript : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!transcript.trim()) {
    return NextResponse.json({ error: "No transcript text was provided." }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [analysisTool],
      tool_choice: { type: "tool", name: "save_analysis" },
      messages: [
        {
          role: "user",
          content: `You are an expert meeting assistant. Analyse the following transcribed audio conversation and produce a summary, key points, action items and detailed notes.

Be faithful to what was actually said — do not invent facts. If speaker labels are absent, infer turns from context where reasonable.

Transcript:
"""
${transcript}
"""`,
        },
      ],
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolUse) {
      return NextResponse.json(
        { error: "The model did not return a structured analysis." },
        { status: 502 }
      );
    }

    const input = toolUse.input as {
      title?: string;
      summary?: string;
      keyPoints?: string[];
      actionItems?: string[];
      notes?: string;
    };

    return NextResponse.json({
      title: input.title || "Untitled conversation",
      summary: input.summary || "",
      keyPoints: Array.isArray(input.keyPoints) ? input.keyPoints : [],
      actionItems: Array.isArray(input.actionItems) ? input.actionItems : [],
      notes: input.notes || "",
    });
  } catch (err) {
    console.error("Analysis failed:", err);
    const message = err instanceof Error ? err.message : "Unknown analysis error.";
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 502 });
  }
}
