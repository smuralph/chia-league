"use client";

import { useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? "Sorry, something went wrong." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-translucent-65)", borderColor: "var(--border)", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}
    >
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
        Ask about league history
      </h3>

      {messages.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="rounded-lg px-3 py-2 text-sm max-w-[80%]"
                style={{
                  background: m.role === "user" ? "var(--primary)" : "var(--gridline)",
                  color: m.role === "user" ? "#ffffff" : "var(--foreground)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--gridline)", color: "var(--text-muted)" }}
              >
                Thinking…
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Ask about a manager, season, or rivalry..."
          className="flex-1 rounded border px-3 py-2 text-sm"
          style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded px-4 py-2 text-sm font-medium"
          style={{ background: "var(--primary)", color: "#ffffff", opacity: loading ? 0.6 : 1 }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}
