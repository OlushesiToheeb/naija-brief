export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const LAGOS = "Africa/Lagos";

export function lagosGreeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: LAGOS,
    }).format(now),
  );
  if (hour < 12) return "Ẹ káàárọ̀ — good morning";
  if (hour < 16) return "Ẹ káàsán — good afternoon";
  return "Ẹ káalẹ́ — good evening";
}

export function lagosDateLine(now = new Date()): string {
  return now.toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: LAGOS,
  });
}

export function lagosTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: LAGOS,
  });
}

// Only absolute http(s) links from feeds are safe to render as hrefs — a
// `javascript:` URL survives text rendering and would run on click. Parsing
// without a base makes empty/relative/protocol-relative values fail closed.
export function safeUrl(url = ""): string {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
