"use client";

import { useState } from "react";
import { AnalysisResult } from "@/lib/types";
import { renderMarkdown } from "@/lib/markdown";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`btn-ghost${copied ? " copied" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? "✓ Copied" : label || "Copy"}
    </button>
  );
}

function buildMarkdownExport(r: AnalysisResult): string {
  const kp = r.keyPoints.map((p) => `- ${p}`).join("\n");
  const ai = r.actionItems.length
    ? r.actionItems.map((p) => `- [ ] ${p}`).join("\n")
    : "_None_";
  return `# ${r.title}

## Summary
${r.summary}

## Key Points
${kp}

## Action Items
${ai}

## Notes
${r.notes}

## Full Transcript
${r.transcript}
`;
}

export default function Results({ result }: { result: AnalysisResult }) {
  const download = () => {
    const blob = new Blob([buildMarkdownExport(result)], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe =
      result.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() ||
      "notes";
    a.href = url;
    a.download = `${safe}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="results">
      <div className="result-title">
        <h2>{result.title}</h2>
        <div className="actions-row">
          <CopyButton text={buildMarkdownExport(result)} label="Copy all" />
          <button className="btn-ghost" onClick={download}>
            ⭳ Download .md
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="panel">
        <div className="panel-head">
          <span className="h">
            <span className="emoji">📝</span> Summary
          </span>
          <CopyButton text={result.summary} />
        </div>
        <div className="panel-body">
          <p>{result.summary}</p>
        </div>
      </div>

      {/* Key points */}
      <div className="panel">
        <div className="panel-head">
          <span className="h">
            <span className="emoji">💡</span> Key Points
          </span>
        </div>
        <div className="panel-body">
          <ul className="list">
            {result.keyPoints.map((p, i) => (
              <li key={i}>
                <span className="marker">◆</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action items */}
      <div className="panel">
        <div className="panel-head">
          <span className="h">
            <span className="emoji">✅</span> Action Items
          </span>
        </div>
        <div className="panel-body">
          {result.actionItems.length ? (
            <ul className="list actions">
              {result.actionItems.map((p, i) => (
                <li key={i}>
                  <span className="marker">▶</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--text-faint)" }}>
              No action items were identified.
            </p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="panel">
        <div className="panel-head">
          <span className="h">
            <span className="emoji">📔</span> Notes
          </span>
          <CopyButton text={result.notes} />
        </div>
        <div className="panel-body">
          <div
            className="markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(result.notes) }}
          />
        </div>
      </div>

      {/* Transcript */}
      <div className="panel">
        <div className="panel-head">
          <span className="h">
            <span className="emoji">🎙️</span> Full Transcript
          </span>
          <CopyButton text={result.transcript} />
        </div>
        <div className="panel-body">
          <div className="transcript">{result.transcript}</div>
        </div>
      </div>
    </div>
  );
}
