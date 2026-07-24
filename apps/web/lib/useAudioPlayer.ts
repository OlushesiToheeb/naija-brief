"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Brief } from "@naija-brief/shared";
import { audioUrl } from "./api";

export interface AudioPlayer {
  isPlaying: boolean;
  started: boolean;
  currentTime: number;
  duration: number;
  unavailable: boolean;
  currentMarkerId: string | undefined;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seekTo: (sec: number) => void;
  seekToMarker: (id: string) => void;
  nudge: (delta: number) => void;
}

export function useAudioPlayer(brief: Brief | null): AudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  if (typeof window !== "undefined" && !audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
  }

  // Point the element at the current brief's audio (or clear it).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setUnavailable(false);
    setStarted(false);
    setCurrentTime(0);
    setIsPlaying(false);
    if (brief?.audio) {
      audio.src = audioUrl(brief.date, brief.generatedAt);
      setDuration(brief.audio.durationSec || 0);
    } else {
      audio.removeAttribute("src");
      setDuration(0);
    }
  }, [brief?.date, brief?.audio, brief?.generatedAt]);

  // Wire element events to React state (once).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDur = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      setStarted(true);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      if (audio.currentSrc) setUnavailable(true);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play().catch(() => setUnavailable(true));
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else audio.pause();
  }, [play]);

  const seekTo = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, sec);
  }, []);

  const seekToMarker = useCallback(
    (id: string) => {
      const marker = brief?.audio?.markers.find((m) => m.id === id);
      if (!marker || !audioRef.current) return;
      audioRef.current.currentTime = marker.startSec;
      play();
    },
    [brief, play],
  );

  const nudge = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime + delta);
  }, []);

  const currentMarkerId = useMemo(() => {
    const markers = brief?.audio?.markers ?? [];
    let current = markers[0]?.id;
    for (const m of markers) {
      if (currentTime >= m.startSec - 0.3) current = m.id;
    }
    return current;
  }, [brief, currentTime]);

  return {
    isPlaying,
    started,
    currentTime,
    duration,
    unavailable,
    currentMarkerId,
    toggle,
    play,
    pause,
    seekTo,
    seekToMarker,
    nudge,
  };
}
