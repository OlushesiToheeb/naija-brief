"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceAsk } from "../lib/useVoiceAsk";
import { MicIcon } from "./icons";

const chipBtn =
  "rounded-full bg-cream/10 px-3 py-1 text-xs font-medium text-cream " +
  "transition hover:bg-cream/20";

export function VoiceAsk({
  date,
  segmentId,
  segmentLabel,
  onClose,
}: {
  date: string;
  segmentId: string;
  segmentLabel: string;
  onClose: () => void;
}) {
  const va = useVoiceAsk(date, segmentId);
  const [typed, setTyped] = useState("");
  const startedRef = useRef(false);

  // Start listening as soon as the panel opens (the user tapped the mic).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (va.sttSupported) va.startListening();
  }, [va]);

  const onTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = typed.trim();
    if (!q) return;
    setTyped("");
    va.submit(q);
  };

  const listening = va.status === "listening";

  return (
    <div
      role="dialog"
      aria-label={`Ask about ${segmentLabel}`}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[46rem] animate-sheet-up rounded-t-[1.75rem] bg-bottle px-5 pb-[calc(1.1rem+env(safe-area-inset-bottom))] pt-3 text-cream shadow-[0_-14px_44px_rgba(8,74,49,0.4)]"
    >
      <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-cream/30" aria-hidden="true" />

      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="inline-flex flex-none items-center gap-1.5 font-semibold text-coral">
          <span className="h-2 w-2 animate-pulse-soft rounded-full bg-coral" />
          Call-in
        </span>
        <span className="truncate text-cream-dim">re: {segmentLabel}</span>
        <button
          className="ml-auto flex-none font-medium text-cream transition hover:text-sun"
          onClick={onClose}
          aria-label="Resume briefing"
        >
          Resume ▸
        </button>
      </div>

      <div className="flex min-h-[66px] items-center gap-4">
        <button
          className={`relative flex h-16 w-16 flex-none items-center justify-center rounded-full border-2 transition disabled:opacity-50 ${
            listening
              ? "border-coral bg-coral text-cream"
              : "border-cream/40 bg-cream/5 text-cream hover:border-coral"
          }`}
          onClick={() => (listening ? va.submit(va.transcript) : va.startListening())}
          aria-label={listening ? "Stop and send" : "Start speaking"}
          disabled={va.status === "thinking"}
        >
          {listening && (
            <span
              className="absolute inset-0 animate-ring rounded-full border-2 border-coral"
              aria-hidden="true"
            />
          )}
          <MicIcon className="h-7 w-7" />
        </button>

        <div className="min-w-0 flex-1">
          {va.status === "listening" && (
            <p className="text-[1.02rem] leading-snug text-cream">
              {va.transcript || "Listening… ask your question out loud."}
            </p>
          )}
          {va.status === "thinking" && (
            <p className="text-sm text-cream-dim">
              {va.transcript ? `“${va.transcript}”` : "Thinking…"}
            </p>
          )}
          {va.status === "answering" && (
            <p className="text-[1.02rem] leading-relaxed text-cream">{va.answer}</p>
          )}
          {va.status === "error" && (
            <p className="text-[0.98rem] text-sun">{va.error}</p>
          )}
          {va.status === "idle" && (
            <p className="text-[1.02rem] text-cream-dim">
              {va.sttSupported
                ? "Tap the mic and ask, or type below."
                : "Type your question below."}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        {va.status === "answering" && (
          <div className="mb-3 flex flex-wrap gap-2">
            {va.speaking && (
              <button className={chipBtn} onClick={va.stop}>
                ◼ Stop
              </button>
            )}
            <button className={chipBtn} onClick={va.startListening}>
              ↺ Ask again
            </button>
            <button
              className="rounded-full bg-coral px-3 py-1 text-xs font-semibold text-cream"
              onClick={onClose}
            >
              Resume ▸
            </button>
          </div>
        )}
        <form className="flex gap-2" onSubmit={onTypedSubmit}>
          <input
            className="min-w-0 flex-1 rounded-full border border-cream/20 bg-cream/10 px-4 py-2.5 text-cream placeholder:text-cream-dim focus-visible:border-coral"
            type="text"
            placeholder="or type your question…"
            aria-label="Type your question"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button
            className="flex-none rounded-full bg-coral px-4 font-display font-semibold text-cream transition hover:bg-coral-deep disabled:opacity-50"
            type="submit"
            disabled={va.status === "thinking"}
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
