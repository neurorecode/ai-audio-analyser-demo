import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Audio Analyser",
  description:
    "Upload or record audio conversations and get instant transcripts, summaries and structured notes powered by AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
