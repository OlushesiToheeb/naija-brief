// Shared, type-only contracts between the NestJS API and the Next.js web app.
// Everything here is erased at compile time — no runtime code lives in this
// package, so consumers use `import type { ... } from "@naija-brief/shared"`.

export type SectionId =
  | "politics"
  | "tech"
  | "business"
  | "markets"
  | "sports"
  | "world";

export interface BriefStory {
  id: string;
  headline: string;
  summary: string;
  source: string;
  link: string;
  publishedAt: string | null;
  /** Full article text, used to ground the drill-down chat. */
  content: string;
}

export interface BriefSection {
  id: SectionId | string;
  title: string;
  /** Spoken-word script for this section. */
  script: string;
  stories: BriefStory[];
}

export interface AudioMarker {
  /** Segment id: "intro", a section id, or "outro". */
  id: string;
  startSec: number;
}

export interface AudioMeta {
  durationSec: number;
  markers: AudioMarker[];
}

export interface SourceFailure {
  source: string;
  error: string;
}

export interface SectionFailure {
  section: string;
  error: string;
}

export interface Brief {
  date: string; // YYYY-MM-DD (Africa/Lagos)
  dateLabel: string;
  generatedAt: string; // ISO timestamp
  intro: string;
  outro: string;
  sections: BriefSection[];
  audio: AudioMeta | null;
  audioError: string | null;
  sourcesFailed: SourceFailure[];
  sectionsFailed: SectionFailure[];
  /** True when this brief is for today's Lagos date. */
  isToday: boolean;
}

export type JobStatus = "idle" | "running" | "done" | "error";

export interface GenerationStatus {
  status: JobStatus;
  step: string;
  error: string;
  startedAt: string | null;
}

/** The two kinds of durable background job the API runs. */
export type JobKind = "generate" | "tts";

/** Lifecycle of a persisted background job (distinct from the UI-facing JobStatus). */
export type JobRecordStatus = "queued" | "running" | "succeeded" | "failed";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  date: string;
  storyId: string;
  messages: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
}

/** A live "interrupt and ask" question about whatever segment is playing. */
export interface AskRequest {
  date: string;
  /** The playing segment: "intro", a section id, or "outro". */
  segmentId: string;
  question: string;
  messages?: ChatMessage[];
}

export interface AskResponse {
  reply: string;
}
