"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { askSegment } from "./api";

export type AskStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "answering"
  | "error";

// Minimal Web Speech API typings (not in the standard DOM lib).
interface SpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface VoiceAsk {
  status: AskStatus;
  transcript: string;
  answer: string;
  error: string;
  speaking: boolean;
  sttSupported: boolean;
  startListening: () => void;
  submit: (text: string) => void;
  stop: () => void;
}

export function useVoiceAsk(date: string, segmentId: string): VoiceAsk {
  const [status, setStatus] = useState<AskStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const submittedRef = useRef(false);
  const sttSupported = getRecognitionCtor() !== null;

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    // Prefer a natural English voice when the platform offers one.
    const pick =
      voices.find((v) => /en[-_]NG/i.test(v.lang)) ??
      voices.find((v) => /en[-_]GB/i.test(v.lang)) ??
      voices.find((v) => /^en/i.test(v.lang) && /natural|google|samantha/i.test(v.name)) ??
      voices.find((v) => /^en/i.test(v.lang));
    if (pick) u.voice = pick;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, []);

  const submit = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      recRef.current?.abort();
      submittedRef.current = true;
      setTranscript(q);
      setAnswer("");
      setError("");
      setStatus("thinking");
      askSegment(date, segmentId, q)
        .then((reply) => {
          setAnswer(reply);
          setStatus("answering");
          speak(reply);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Something went wrong.");
          setStatus("error");
        });
    },
    [date, segmentId, speak],
  );

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    setError("");
    setAnswer("");
    setTranscript("");
    finalRef.current = "";
    submittedRef.current = false;
    if (!Ctor) {
      // No speech recognition — the component falls back to a typed box.
      setStatus("idle");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      finalRef.current = text;
      setTranscript(text);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(
        e.error === "not-allowed"
          ? "Microphone access was blocked — type your question instead."
          : "Couldn't hear you — try again or type your question.",
      );
      setStatus("idle");
    };
    rec.onend = () => {
      // Auto-submit whatever was captured, unless we already did.
      if (!submittedRef.current && finalRef.current.trim()) {
        submit(finalRef.current);
      } else if (!submittedRef.current) {
        setStatus("idle");
      }
    };
    recRef.current = rec;
    setStatus("listening");
    try {
      rec.start();
    } catch {
      setStatus("idle");
    }
  }, [submit]);

  const stop = useCallback(() => {
    recRef.current?.abort();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
    setStatus("idle");
    setTranscript("");
    setAnswer("");
    setError("");
  }, []);

  // Tear everything down on unmount (closing the panel / new brief).
  useEffect(() => {
    return () => {
      recRef.current?.abort();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    status,
    transcript,
    answer,
    error,
    speaking,
    sttSupported,
    startListening,
    submit,
    stop,
  };
}
