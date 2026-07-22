"use client";

import { useState } from "react";
import type { BriefStory } from "@naija-brief/shared";
import { safeUrl } from "../lib/format";
import { StoryChat } from "./StoryChat";
import { ChatIcon } from "./icons";

export function Story({ story, date }: { story: BriefStory; date: string }) {
  const [open, setOpen] = useState(false);
  const href = safeUrl(story.link);

  return (
    <article>
      <button
        className="group flex w-full items-start gap-3 py-3.5 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="min-w-0 flex-1">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-taupe">
            {story.source}
          </span>
          <p
            className={`mt-1 font-display text-[1.05rem] font-medium leading-snug ${
              open ? "text-coral" : "text-ink"
            }`}
          >
            {story.headline}
          </p>
        </div>
        <span
          className={`mt-0.5 inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            open
              ? "bg-coral text-cream"
              : "border border-line text-taupe group-hover:border-coral group-hover:text-coral"
          }`}
        >
          <ChatIcon className="h-3 w-3" />
          {open ? "Close" : "Ask"}
        </span>
      </button>

      {/* Rendered even when collapsed (hidden via CSS) so StoryChat stays
          mounted and its conversation survives collapsing and re-expanding. */}
      <div className="pb-4" hidden={!open}>
        {story.summary && (
          <p className="mb-3 max-w-[60ch] leading-relaxed text-taupe">
            {story.summary}
          </p>
        )}
        {href && (
          <a
            className="text-sm font-medium text-coral underline decoration-coral/40 underline-offset-4 transition hover:decoration-coral"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read at {story.source} ↗
          </a>
        )}
        <StoryChat date={date} storyId={story.id} />
      </div>
    </article>
  );
}
