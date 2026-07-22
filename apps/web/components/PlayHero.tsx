"use client";

import { fmtTime } from "../lib/format";
import { PauseIcon, PlayIcon } from "./icons";

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
    <section className="relative mb-8 overflow-hidden rounded-[1.75rem] bg-bottle p-6 text-cream">
      {/* one clean graphic accent — a danfo-yellow sun bleeding off the corner */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-sun/20"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-4">
        <button
          onClick={onToggle}
          aria-label={isPlaying ? "Pause briefing" : "Play briefing"}
          className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-coral text-cream transition hover:bg-coral-deep active:scale-95"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon className="ml-1 h-6 w-6" />}
        </button>
        <div className="min-w-0">
          <p className="font-display text-4xl font-bold leading-none">
            {fmtTime(durationSec)}
          </p>
          <p className="mt-2 text-sm text-cream-dim">
            The whole brief · read aloud
          </p>
        </div>
      </div>

      <p className="relative mt-5 flex items-center gap-2 text-sm font-medium text-cream-dim">
        {isPlaying ? (
          <>
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-coral" />
            On air now
          </>
        ) : (
          "Press play for this morning's reading"
        )}
      </p>
    </section>
  );
}
