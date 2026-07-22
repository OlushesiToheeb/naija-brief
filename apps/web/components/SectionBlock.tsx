"use client";

import type { BriefSection } from "@naija-brief/shared";
import { fmtTime } from "../lib/format";
import { Story } from "./Story";

export function SectionBlock({
  section,
  date,
  jumpSec,
  onJump,
}: {
  section: BriefSection;
  date: string;
  jumpSec: number | null;
  onJump: (sec: number) => void;
}) {
  return (
    <section className="section">
      <div className="section__eyebrow">
        <span className="section__label">{section.title}</span>
        <span className="section__rule" />
        {jumpSec !== null && (
          <button className="section__jump" onClick={() => onJump(jumpSec)}>
            ▸ cue {fmtTime(jumpSec)}
          </button>
        )}
      </div>
      {section.script && <p className="section__script">{section.script}</p>}
      {section.stories.map((story) => (
        <Story key={story.id} story={story} date={date} />
      ))}
    </section>
  );
}
