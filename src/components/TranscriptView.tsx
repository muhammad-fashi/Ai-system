"use client";
import { useMemo, useState } from "react";
import { formatDuration } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface Turn {
  role: string;
  content: string;
  ts?: number;
}

export default function TranscriptView({
  transcript,
  transcriptText,
}: {
  transcript?: Turn[] | null;
  transcriptText?: string | null;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const turns: Turn[] = useMemo(() => {
    if (Array.isArray(transcript) && transcript.length) return transcript;
    if (transcriptText) {
      return transcriptText
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const m = line.match(/^\s*(agent|user|assistant|client|ai)\s*:\s*(.*)$/i);
          if (m) return { role: m[1].toLowerCase(), content: m[2] };
          return { role: "user", content: line };
        });
    }
    return [];
  }, [transcript, transcriptText]);

  const filtered = search
    ? turns.filter((t) => t.content.toLowerCase().includes(search.toLowerCase()))
    : turns;

  const plainText = turns
    .map((t) => `${isAgent(t.role) ? "AI" : "Client"}: ${t.content}`)
    .join("\n");

  function copy() {
    navigator.clipboard.writeText(plainText);
    toast("Transcript copied", "success");
  }
  function download() {
    const blob = new Blob([plainText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (turns.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No transcript available for this call.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search transcript…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-secondary py-1.5" onClick={copy}>
          📋 Copy
        </button>
        <button className="btn-secondary py-1.5" onClick={download}>
          ⬇ Download
        </button>
        <button className="btn-secondary py-1.5" onClick={() => window.print()}>
          🖨 Print
        </button>
      </div>
      <div className="space-y-3">
        {filtered.map((t, i) => {
          const agent = isAgent(t.role);
          return (
            <div key={i} className={`flex ${agent ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  agent
                    ? "rounded-tl-sm bg-slate-100 text-slate-800"
                    : "rounded-tr-sm bg-brand-600 text-white"
                }`}
              >
                <div className="mb-0.5 flex items-center gap-2 text-[11px] opacity-70">
                  <span className="font-semibold">{agent ? "🤖 AI Agent" : "🧑 Client"}</span>
                  {typeof t.ts === "number" && <span>[{formatDuration(t.ts)}]</span>}
                </div>
                {t.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isAgent(role: string) {
  return ["agent", "assistant", "ai"].includes(role.toLowerCase());
}
