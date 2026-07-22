"use client";

import { useEffect, useState } from "react";
import type { Brief } from "@naija-brief/shared";
import { lagosTime } from "../lib/format";
import { useAudioPlayer } from "../lib/useAudioPlayer";
import { PlayHero } from "./PlayHero";
import { OnAirBar } from "./OnAirBar";
import { SectionBlock } from "./SectionBlock";
import { VoiceAsk } from "./VoiceAsk";

function segmentLabel(brief: Brief, id: string): string {
  if (id === "intro") return "the intro";
  if (id === "outro") return "the sign-off";
  return brief.sections.find((s) => s.id === id)?.title ?? "the briefing";
}

export function BriefView({
  brief,
  onRegenerate,
}: {
  brief: Brief;
  onRegenerate: () => void;
}) {
  const player = useAudioPlayer(brief);
  const { pause, seekTo, play } = player;

  // The live "interrupt and ask" panel — freezes the segment that was playing.
  const [asking, setAsking] = useState<string | null>(null);
  const openAsk = () => {
    pause();
    setAsking(player.currentMarkerId ?? "intro");
  };
  const closeAsk = () => {
    setAsking(null);
    play(); // resume the briefing from where it paused
  };

  // Stop playback when leaving the brief (e.g. a regenerate). pause is stable.
  useEffect(() => () => pause(), [pause]);

  const hasAudio = Boolean(brief.audio) && !player.unavailable;
  const markerFor = (id: string) =>
    brief.audio?.markers.find((m) => m.id === id)?.startSec ?? null;
  const jumpAndPlay = (sec: number) => {
    seekTo(sec);
    play();
  };

  const notes: string[] = [];
  if (brief.sourcesFailed.length) {
    notes.push(`couldn't reach: ${brief.sourcesFailed.map((f) => f.source).join(", ")}`);
  }
  if (brief.sectionsFailed.length) {
    notes.push(
      `couldn't summarize: ${brief.sectionsFailed.map((f) => f.section).join(", ")}`,
    );
  }
  const sourcesNote = notes.length
    ? `Generated ${lagosTime(brief.generatedAt)} · ${notes.join(" · ")}`
    : `Generated ${lagosTime(brief.generatedAt)} · all sources reached`;

  return (
    <div>
      {!brief.isToday && (
        <p className="mb-5 text-sm font-medium text-coral">
          Today&apos;s brief isn&apos;t ready yet — showing {brief.dateLabel}.
        </p>
      )}

      {hasAudio && brief.audio && (
        <PlayHero
          durationSec={brief.audio.durationSec}
          isPlaying={player.isPlaying}
          onToggle={player.toggle}
        />
      )}

      {!hasAudio && (
        <p className="mb-8 rounded-2xl border border-line bg-paper p-4 text-sm leading-relaxed text-taupe">
          {player.unavailable
            ? "The audio for this brief couldn't be played. The scripts below are still here."
            : brief.audioError
              ? "The voiceover couldn't be generated this time, but the briefing below is fresh."
              : "This brief was generated without audio. The scripts below are still fresh."}
        </p>
      )}

      <div>
        {brief.sections.map((section, i) => (
          <SectionBlock
            key={section.id}
            section={section}
            index={i}
            date={brief.date}
            jumpSec={hasAudio ? markerFor(section.id) : null}
            onJump={jumpAndPlay}
          />
        ))}
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-sm text-taupe">
        <p className="min-w-0">{sourcesNote}</p>
        <button
          className="flex-none rounded-full border border-line px-4 py-2 font-medium text-taupe transition hover:border-coral hover:text-coral"
          onClick={onRegenerate}
        >
          Regenerate today&apos;s brief
        </button>
      </footer>

      {hasAudio && player.started && !asking && (
        <OnAirBar brief={brief} player={player} onAsk={openAsk} />
      )}

      {asking && (
        <VoiceAsk
          date={brief.date}
          segmentId={asking}
          segmentLabel={segmentLabel(brief, asking)}
          onClose={closeAsk}
        />
      )}
    </div>
  );
}
