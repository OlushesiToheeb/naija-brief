"use client";

import { Masthead } from "../components/Masthead";
import { EmptyState, ErrorState, GeneratingState } from "../components/Panels";
import { BriefView } from "../components/BriefView";
import { useBrief } from "../lib/useBrief";

export default function Home() {
  const { view, brief, errorText, genStep, generate } = useBrief();

  return (
    <div className="mx-auto max-w-[46rem] px-5 pb-40 pt-8 sm:px-7">
      <Masthead />
      <main>
        {view === "loading" && (
          <p className="text-sm font-medium text-taupe">Tuning in…</p>
        )}
        {view === "empty" && <EmptyState onGenerate={generate} />}
        {view === "generating" && <GeneratingState step={genStep} />}
        {view === "error" && <ErrorState text={errorText} onRetry={generate} />}
        {view === "brief" && brief && (
          // Keyed by generatedAt so a fresh brief remounts — clearing story
          // chats and resetting the player instead of leaking stale state.
          <BriefView
            key={brief.generatedAt}
            brief={brief}
            onRegenerate={generate}
          />
        )}
      </main>
    </div>
  );
}
