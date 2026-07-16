export interface AnalysisResult {
  /** Full verbatim transcript of the audio. */
  transcript: string;
  /** A concise prose summary of the conversation. */
  summary: string;
  /** Bullet-point key takeaways. */
  keyPoints: string[];
  /** Action items / follow-ups extracted from the conversation. */
  actionItems: string[];
  /** Structured, meeting-style notes in Markdown. */
  notes: string;
  /** Detected primary topic / title for the conversation. */
  title: string;
}

export interface TranscribeResponse {
  transcript: string;
}

export interface AnalyzeResponse {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  notes: string;
  title: string;
}

export interface ApiError {
  error: string;
}
