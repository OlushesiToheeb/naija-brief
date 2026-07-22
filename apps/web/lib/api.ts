import type {
  Brief,
  ChatMessage,
  GenerationStatus,
} from "@naija-brief/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new ApiError(
      Array.isArray(message) ? message.join(", ") : String(message),
      res.status,
    );
  }
  return data as T;
}

export function audioUrl(date: string): string {
  return `${API_BASE}/api/audio/${date}`;
}

export async function fetchBrief(date?: string): Promise<Brief> {
  const url = date
    ? `${API_BASE}/api/brief?date=${encodeURIComponent(date)}`
    : `${API_BASE}/api/brief`;
  return json<Brief>(await fetch(url, { cache: "no-store" }));
}

export async function fetchStatus(): Promise<GenerationStatus> {
  return json<GenerationStatus>(
    await fetch(`${API_BASE}/api/status`, { cache: "no-store" }),
  );
}

export async function startGeneration(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/generate`, { method: "POST" });
  // 202 accepted or 400 "already running" both mean a run is in flight.
  if (!res.ok && res.status !== 400) {
    throw new ApiError(`Could not start generation (${res.status})`, res.status);
  }
}

export async function askAboutStory(
  date: string,
  storyId: string,
  messages: ChatMessage[],
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, storyId, messages }),
  });
  const data = await json<{ reply: string }>(res);
  return data.reply;
}
