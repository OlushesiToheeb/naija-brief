"use client";

import type { BriefSection } from "@naija-brief/shared";
import { fmtTime } from "../lib/format";
import { Story } from "./Story";
import { PlayIcon } from "./icons";

export function SectionBlock({
  section,
  index,
  date,
  jumpSec,
  onJump,
}: {
  section: BriefSection;
  index: number;
  date: string;
  jumpSec: number | null;
  onJump: (sec: number) => void;
}) {
  return (
    <section className="mb-10 scroll-mt-6">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="flex-none font-display text-lg font-bold tabular-nums text-coral">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h2 className="font-display text-[1.6rem] font-semibold tracking-tight text-ink">
          {section.title}
        </h2>
        <span className="h-px flex-1 bg-line" />
        {jumpSec !== null && (
          <button
            className="inline-flex flex-none items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-taupe transition hover:border-coral hover:text-coral"
            onClick={() => onJump(jumpSec)}
          >
            <PlayIcon className="h-2.5 w-2.5" />
            {fmtTime(jumpSec)}
          </button>
        )}
      </div>

      {section.script && (
        <p className="mb-5 text-[1.05rem] leading-relaxed text-ink/80">
          {section.script}
        </p>
      )}

      <div className="divide-y divide-line">
        {section.stories.map((story) => (
          <Story key={story.id} story={story} date={date} />
        ))}
      </div>
    </section>
  );
}
