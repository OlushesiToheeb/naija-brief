"use client";

import { fmtTime } from "../lib/format";

export function PlayHero({
  durationSec,
  isPlaying,
  onToggle,
}: {
  durationSec: number;
  isPlaying: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="playhero">
      <button
        className={`playhero__btn${isPlaying ? " is-playing" : ""}`}
        onClick={onToggle}
        aria-label={isPlaying ? "Pause briefing" : "Play briefing"}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="playhero__meta">
        <p className="playhero__label">Today&apos;s briefing</p>
        <p className="playhero__duration">
          {fmtTime(durationSec)} · read by Kokoro
        </p>
      </div>
    </section>
  );
}
