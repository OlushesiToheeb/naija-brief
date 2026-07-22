"use client";

import { useState } from "react";
import type { ChatMessage } from "@naija-brief/shared";
import { askAboutStory } from "../lib/api";

interface Entry extends ChatMessage {
  error?: boolean;
}

export function StoryChat({
  date,
  storyId,
}: {
  date: string;
  storyId: string;
}) {
  const [log, setLog] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || pending) return;
    setInput("");

    const history = [...log, { role: "user" as const, content: question }];
    setLog(history);
    setPending(true);
    try {
      const reply = await askAboutStory(
        date,
        storyId,
        history.map(({ role, content }) => ({ role, content })),
      );
      setLog([...history, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setLog([...history, { role: "assistant", content: message, error: true }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4">
      {(log.length > 0 || pending) && (
        <div className="mb-2 flex flex-col gap-2">
          {log.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[0.95rem] leading-relaxed ${
                m.role === "user"
                  ? "self-end rounded-br-sm bg-bottle text-cream"
                  : m.error
                    ? "self-start rounded-bl-sm border border-coral/40 bg-coral/[0.06] text-coral-deep"
                    : "self-start rounded-bl-sm border border-line bg-paper text-ink"
              }`}
            >
              {m.content}
            </div>
          ))}
          {pending && (
            <div className="self-start text-sm text-taupe">thinking…</div>
          )}
        </div>
      )}
      <form className="flex gap-2" onSubmit={submit}>
        <input
          className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-ink placeholder:text-taupe/60 focus-visible:border-coral"
          type="text"
          placeholder="Ask about this story…"
          aria-label="Ask about this story"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="flex-none rounded-full bg-coral px-4 font-display font-semibold text-cream transition hover:bg-coral-deep disabled:opacity-50"
          type="submit"
          disabled={pending}
        >
          Ask
        </button>
      </form>
    </div>
  );
}
