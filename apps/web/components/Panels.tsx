"use client";

export function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <section className="panel">
      <h2 className="panel__title">No briefing yet today</h2>
      <p className="panel__text">
        Naija Brief gathers the morning&apos;s news from Nigerian and world
        sources, writes a spoken summary, and reads it to you.
      </p>
      <button className="button button--primary" onClick={onGenerate}>
        Generate today&apos;s brief
      </button>
    </section>
  );
}

export function GeneratingState({ step }: { step: string }) {
  return (
    <section className="panel">
      <div className="dial" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2 className="panel__title">Putting your briefing together</h2>
      <p className="panel__text panel__text--step">{step}</p>
      <p className="panel__hint">
        Fetching, summarizing and voicing takes a few minutes. You can leave this
        page open.
      </p>
    </section>
  );
}

export function ErrorState({
  text,
  onRetry,
}: {
  text: string;
  onRetry: () => void;
}) {
  return (
    <section className="panel panel--error">
      <h2 className="panel__title">The briefing didn&apos;t make it</h2>
      <p className="panel__text">{text}</p>
      <button className="button button--primary" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}
