"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Brief } from "@naija-brief/shared";
import { ApiError, fetchBrief, fetchStatus, startGeneration } from "./api";

export type View = "loading" | "empty" | "generating" | "error" | "brief";

const UNREACHABLE =
  "Couldn't reach the server. Check that the API is running, then try again.";

export interface BriefState {
  view: View;
  brief: Brief | null;
  errorText: string;
  genStep: string;
  generate: () => void;
}

export function useBrief(): BriefState {
  const [view, setView] = useState<View>("loading");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [errorText, setErrorText] = useState("");
  const [genStep, setGenStep] = useState("Starting…");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopAudioPoll = useCallback(() => {
    if (audioPollRef.current) {
      clearInterval(audioPollRef.current);
      audioPollRef.current = null;
    }
  }, []);

  const loadBrief = useCallback(async () => {
    try {
      const b = await fetchBrief();
      setBrief(b);
      setView("brief");
      // The text brief lands before the voice finishes rendering (they're
      // separate jobs). If audio isn't attached yet, poll for it and swap it in
      // when it arrives — so the player appears without a manual reload.
      stopAudioPoll();
      if (b && !b.audio && !b.audioError && b.isToday) {
        let tries = 0;
        audioPollRef.current = setInterval(() => {
          if (++tries > 45) {
            stopAudioPoll(); // ~7.5 min ceiling
            return;
          }
          void (async () => {
            try {
              const fresh = await fetchBrief();
              if (
                fresh.generatedAt === b.generatedAt &&
                (fresh.audio || fresh.audioError)
              ) {
                stopAudioPoll();
                setBrief(fresh);
              }
            } catch {
              // transient — keep polling
            }
          })();
        }, 10_000);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setView("empty");
        return;
      }
      setErrorText(e instanceof ApiError ? e.message : UNREACHABLE);
      setView("error");
    }
  }, [stopAudioPoll]);

  const poll = useCallback(() => {
    stopPoll();
    let ticks = 0;
    let consecutiveErrors = 0;
    pollRef.current = setInterval(async () => {
      // Give up after ~10 min so a wedged run can't spin forever.
      if (++ticks > 300) {
        stopPoll();
        setErrorText(
          "The briefing is taking longer than expected. It may still finish — reload to check.",
        );
        setView("error");
        return;
      }
      try {
        const job = await fetchStatus();
        consecutiveErrors = 0;
        if (job.status === "running") {
          setGenStep((job.step || "Working") + "…");
        } else if (job.status === "error") {
          stopPoll();
          setErrorText(job.error || "The briefing failed to generate.");
          setView("error");
        } else {
          // "done", "idle", or unknown: the job is over (or its in-memory
          // state was lost on restart) — show whatever is stored.
          stopPoll();
          await loadBrief();
        }
      } catch {
        if (++consecutiveErrors >= 5) {
          stopPoll();
          setErrorText(
            "Lost contact with the server while generating. Check that it's running, then try again.",
          );
          setView("error");
        }
      }
    }, 2000);
  }, [loadBrief, stopPoll]);

  const generate = useCallback(() => {
    stopAudioPoll();
    setView("generating");
    setGenStep("Starting…");
    void (async () => {
      try {
        await startGeneration();
      } catch {
        setErrorText(UNREACHABLE);
        setView("error");
        return;
      }
      poll();
    })();
  }, [poll, stopAudioPoll]);

  useEffect(() => {
    void (async () => {
      try {
        const job = await fetchStatus();
        if (job.status === "running") {
          setView("generating");
          poll();
          return;
        }
        if (job.status === "error") {
          setErrorText(
            `This morning's briefing didn't make it: ${job.error || "unknown error"}`,
          );
          setView("error");
          return;
        }
      } catch {
        // Status unavailable; fall through to loading any stored brief.
      }
      await loadBrief();
    })();
    return () => {
      stopPoll();
      stopAudioPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { view, brief, errorText, genStep, generate };
}
