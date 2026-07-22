import { TIMEZONE } from "../config/sections";

/** YYYY-MM-DD for the given moment in Africa/Lagos (en-CA yields ISO date). */
export function todayKey(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** Human date label, e.g. "Wednesday, 22 July 2026". */
export function formatDateLabel(date = new Date()): string {
  return date.toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  });
}
