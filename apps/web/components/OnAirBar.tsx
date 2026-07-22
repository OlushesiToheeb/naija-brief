"use client";

import { useMemo } from "react";
import type { Brief } from "@naija-brief/shared";
import { fmtTime } from "../lib/format";
import type { AudioPlayer } from "../lib/useAudioPlayer";
import { MicIcon, PauseIcon, PlayIcon } from "./icons";

function segmentTitle(brief: Brief, id: string): string {
  if (id === "intro") return "Intro";
  if (id === "outro") return "Sign-off";
  return brief.sections.find((s) => s.id === id)?.title ?? id;
}

export function OnAirBar({
  brief,
  player,
  onAsk,
}: {
  brief: Brief;
  player: AudioPlayer;
  onAsk: () => void;
}) {
  const duration = player.duration || brief.audio?.durationSec || 1;
  const markers = brief.audio?.markers ?? [];
  const pct = Math.min(100, (player.currentTime / duration) * 100);

  const currentTitle = useMemo(
    () =>
      player.currentMarkerId
        ? segmentTitle(brief, player.currentMarkerId)
        : "Intro",
    [brief, player.currentMarkerId],
  );

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    player.seekTo(Math.max(0, Math.min(1, frac)) * duration);
  };

  const onTrackKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      player.nudge(10);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      player.nudge(-10);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-bottle text-cream shadow-[0_-8px_30px_rgba(8,74,49,0.28)]">
      <div className="mx-auto flex max-w-[46rem] items-center gap-3 px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-2.5">
        <button
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-coral text-cream transition hover:bg-coral-deep active:scale-95"
          onClick={player.toggle}
          aria-label={player.isPlaying ? "Pause briefing" : "Play briefing"}
        >
          {player.isPlaying ? (
            <PauseIcon className="h-4.5 w-4.5" />
          ) : (
            <PlayIcon className="ml-0.5 h-4.5 w-4.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="truncate font-medium text-cream">
              {currentTitle}
            </span>
            <span className="ml-auto flex-none text-xs text-cream-dim tabular-nums">
              {fmtTime(player.currentTime)} / {fmtTime(duration)}
            </span>
          </div>

          <div
            className="relative mt-2 h-1.5 cursor-pointer rounded-full bg-cream/20"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-valuetext={`${fmtTime(player.currentTime)} of ${fmtTime(duration)}`}
            tabIndex={0}
            onClick={onTrackClick}
            onKeyDown={onTrackKey}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-coral"
              style={{ width: `${pct}%` }}
            />
            {markers
              .filter((m) => m.startSec > 0.5)
              .map((m) => (
                <span
                  key={m.id}
                  className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-cream/35"
                  style={{ left: `${(m.startSec / duration) * 100}%` }}
                />
              ))}
          </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {markers.map((m) => {
              const current = m.id === player.currentMarkerId;
              return (
                <button
                  key={m.id}
                  onClick={() => player.seekToMarker(m.id)}
                  className={`flex-none whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                    current
                      ? "bg-coral text-cream"
                      : "text-cream-dim hover:text-cream"
                  }`}
                >
                  {segmentTitle(brief, m.id)}
                </button>
              );
            })}
          </div>
        </div>

        <button
          className="flex flex-none flex-col items-center gap-0.5 rounded-2xl bg-cream/10 px-3 py-1.5 text-cream transition hover:bg-coral"
          onClick={onAsk}
          aria-label="Interrupt and ask a question"
          title="Ask about what's playing"
        >
          <MicIcon className="h-5 w-5" />
          <span className="text-[0.6rem] font-semibold uppercase tracking-wide">
            Ask
          </span>
        </button>
      </div>
    </div>
  );
}
