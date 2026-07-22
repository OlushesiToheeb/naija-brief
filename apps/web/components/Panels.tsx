"use client";

const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-coral px-6 py-3 " +
  "font-display font-semibold text-cream transition hover:bg-coral-deep active:scale-[0.98]";

export function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <section className="animate-rise rounded-[1.5rem] border border-line bg-paper p-7">
      <h2 className="font-display text-2xl font-semibold text-ink">
        No briefing yet today
      </h2>
      <p className="mt-2 max-w-[46ch] text-taupe">
        Naija Brief gathers the morning&apos;s news from Nigerian and world
        sources, writes a spoken summary, and reads it to you.
      </p>
      <button className={`mt-6 ${primaryBtn}`} onClick={onGenerate}>
        Generate today&apos;s brief
      </button>
    </section>
  );
}

export function GeneratingState({ step }: { step: string }) {
  const dots = ["bg-bottle", "bg-coral", "bg-sun"];
  return (
    <section className="animate-rise rounded-[1.5rem] border border-line bg-paper p-7">
      <div className="mb-5 flex gap-2" aria-hidden="true">
        {dots.map((c, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 animate-pulse-soft rounded-full ${c}`}
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </div>
      <h2 className="font-display text-2xl font-semibold text-ink">
        Putting your briefing together
      </h2>
      <p className="mt-2 text-sm font-medium text-coral">{step}</p>
      <p className="mt-3 text-sm text-taupe">
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
    <section className="animate-rise rounded-[1.5rem] border border-coral/40 bg-coral/[0.05] p-7">
      <h2 className="font-display text-2xl font-semibold text-ink">
        The briefing didn&apos;t make it
      </h2>
      <p className="mt-2 text-taupe">{text}</p>
      <button className={`mt-6 ${primaryBtn}`} onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}
