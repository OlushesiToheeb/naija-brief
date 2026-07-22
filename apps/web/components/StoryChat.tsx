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
    <div className="chat">
      <div className="chat__log">
        {log.map((m, i) => (
          <div
            key={i}
            className={`chat__msg chat__msg--${m.role === "user" ? "user" : "bot"}${
              m.error ? " chat__msg--error" : ""
            }`}
          >
            {m.content}
          </div>
        ))}
        {pending && (
          <div className="chat__msg chat__msg--pending">thinking…</div>
        )}
      </div>
      <form className="chat__form" onSubmit={submit}>
        <input
          className="chat__input"
          type="text"
          placeholder="Ask about this story…"
          aria-label="Ask about this story"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="chat__send" type="submit" disabled={pending}>
          Ask
        </button>
      </form>
    </div>
  );
}
