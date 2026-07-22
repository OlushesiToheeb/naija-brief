"use client";

import { useMemo } from "react";
import type { Brief } from "@naija-brief/shared";
import { fmtTime } from "../lib/format";
import type { AudioPlayer } from "../lib/useAudioPlayer";

function segmentTitle(brief: Brief, id: string): string {
  if (id === "intro") return "Intro";
  if (id === "outro") return "Sign-off";
  return brief.sections.find((s) => s.id === id)?.title ?? id;
}

export function OnAirBar({
  brief,
  player,
}: {
  brief: Brief;
  player: AudioPlayer;
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
    <div className="onair">
      <button
        className={`onair__play${player.isPlaying ? " is-playing" : ""}`}
        onClick={player.toggle}
        aria-label={player.isPlaying ? "Pause briefing" : "Play briefing"}
      >
        {player.isPlaying ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="onair__body">
        <div className="onair__row">
          <span className="onair__live">
            <span className="onair__dot" aria-hidden="true" />
            On air
          </span>
          <span className="onair__section">{currentTitle}</span>
          <span className="onair__time">
            {fmtTime(player.currentTime)} / {fmtTime(duration)}
          </span>
        </div>

        <div
          className="onair__track"
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
          <div className="onair__fill" style={{ width: `${pct}%` }} />
          <div className="onair__marks">
            {markers
              .filter((m) => m.startSec > 0.5)
              .map((m) => (
                <span
                  key={m.id}
                  style={{ left: `${(m.startSec / duration) * 100}%` }}
                />
              ))}
          </div>
        </div>

        <div className="onair__chips">
          {markers.map((m) => (
            <button
              key={m.id}
              className={`chip${m.id === player.currentMarkerId ? " is-current" : ""}`}
              onClick={() => player.seekToMarker(m.id)}
            >
              {segmentTitle(brief, m.id)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
