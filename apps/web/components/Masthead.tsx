"use client";

import { useEffect, useState } from "react";
import { lagosDateLine, lagosGreeting } from "../lib/format";

export function Masthead() {
  // Time-of-day text is client-only to avoid a server/client hydration gap.
  const [greeting, setGreeting] = useState("Naija Brief");
  const [dateLine, setDateLine] = useState("");

  useEffect(() => {
    setGreeting(lagosGreeting());
    setDateLine(lagosDateLine());
  }, []);

  return (
    <header className="mb-8 pt-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="min-h-[1.2em] text-sm font-medium text-coral">{greeting}</p>
        <p className="text-sm text-taupe">{dateLine || " "}</p>
      </div>
      <h1 className="mt-3 font-display text-[clamp(2.9rem,13vw,4.1rem)] font-bold leading-[0.86] tracking-tight">
        <span className="block text-bottle">Naija</span>
        <span className="block text-coral">Brief</span>
      </h1>
    </header>
  );
}
