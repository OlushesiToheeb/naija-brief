"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceAsk } from "../lib/useVoiceAsk";

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
    <div className="voiceask" role="dialog" aria-label={`Ask about ${segmentLabel}`}>
      <div className="voiceask__head">
        <span className="voiceask__live">
          <span className="voiceask__dot" aria-hidden="true" />
          Call-in
        </span>
        <span className="voiceask__ctx">re: {segmentLabel}</span>
        <button className="voiceask__close" onClick={onClose} aria-label="Resume briefing">
          Resume ▸
        </button>
      </div>

      <div className="voiceask__body">
        <button
          className={`voiceask__mic${listening ? " is-live" : ""}`}
          onClick={() => (listening ? va.submit(va.transcript) : va.startListening())}
          aria-label={listening ? "Stop and send" : "Start speaking"}
          disabled={va.status === "thinking"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
            <path d="M19 11a7 7 0 0 1-14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        <div className="voiceask__state">
          {va.status === "listening" && (
            <p className="voiceask__hint">
              {va.transcript || "Listening… ask your question out loud."}
            </p>
          )}
          {va.status === "thinking" && (
            <p className="voiceask__hint voiceask__hint--mono">
              {va.transcript ? `“${va.transcript}”` : "Thinking…"}
            </p>
          )}
          {va.status === "answering" && (
            <p className="voiceask__answer">{va.answer}</p>
          )}
          {va.status === "error" && (
            <p className="voiceask__hint voiceask__hint--err">{va.error}</p>
          )}
          {va.status === "idle" && (
            <p className="voiceask__hint">
              {va.sttSupported
                ? "Tap the mic and ask, or type below."
                : "Type your question below."}
            </p>
          )}
        </div>
      </div>

      <div className="voiceask__foot">
        {va.status === "answering" && (
          <div className="voiceask__actions">
            {va.speaking && (
              <button className="chip" onClick={va.stop}>
                ◼ Stop
              </button>
            )}
            <button className="chip" onClick={va.startListening}>
              ↺ Ask again
            </button>
            <button className="chip chip--go" onClick={onClose}>
              Resume ▸
            </button>
          </div>
        )}
        <form className="voiceask__form" onSubmit={onTypedSubmit}>
          <input
            className="voiceask__input"
            type="text"
            placeholder="or type your question…"
            aria-label="Type your question"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button className="voiceask__send" type="submit" disabled={va.status === "thinking"}>
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
