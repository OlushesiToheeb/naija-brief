"use client";

import { useState } from "react";
import type { BriefStory } from "@naija-brief/shared";
import { safeUrl } from "../lib/format";
import { StoryChat } from "./StoryChat";

export function Story({ story, date }: { story: BriefStory; date: string }) {
  const [open, setOpen] = useState(false);
  const href = safeUrl(story.link);

  return (
    <article className={`story${open ? " is-open" : ""}`}>
      <button
        className="story__toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="story__source">{story.source}</span>
        <span className="story__headline">{story.headline}</span>
        <span className="story__ask" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          </svg>
          {open ? "Close" : "Ask"}
        </span>
      </button>
      {/* Rendered even when collapsed (hidden via CSS) so StoryChat stays
          mounted and its conversation survives collapsing and re-expanding. */}
      <div className="story__detail" hidden={!open}>
        {story.summary && <p className="story__summary">{story.summary}</p>}
        {href && (
          <a
            className="story__link"
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
