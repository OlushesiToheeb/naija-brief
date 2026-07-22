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
    <header className="masthead">
      <p className="masthead__greeting">{greeting}</p>
      <h1 className="masthead__title">Naija Brief</h1>
      <p className="masthead__date">{dateLine || " "}</p>
    </header>
  );
}
