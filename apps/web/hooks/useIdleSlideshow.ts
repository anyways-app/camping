"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Slideshow rule (docs/spec/00-core.md):
//   - 60 seconds of no interaction → enter slideshow
//   - advance one card every 25 seconds
//   - any user input exits slideshow
// We listen at the window level so any pointer / key / wheel event resets the
// idle timer, even if it lands on UI chrome outside the feed.

const IDLE_MS = 60_000;
const ADVANCE_MS = 25_000;

export interface IdleSlideshowControls {
  isPlaying: boolean;
  exit: () => void;
}

export function useIdleSlideshow(
  onAdvance: () => void,
  enabled: boolean,
): IdleSlideshowControls {
  const [isPlaying, setIsPlaying] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onAdvanceRef = useRef(onAdvance);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  const stopAdvance = useCallback(() => {
    if (advanceTimer.current) {
      clearInterval(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  const startAdvance = useCallback(() => {
    stopAdvance();
    advanceTimer.current = setInterval(() => {
      onAdvanceRef.current();
    }, ADVANCE_MS);
  }, [stopAdvance]);

  const exit = useCallback(() => {
    setIsPlaying(false);
    stopAdvance();
  }, [stopAdvance]);

  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!enabled) return;
    idleTimer.current = setTimeout(() => {
      setIsPlaying(true);
    }, IDLE_MS);
  }, [enabled]);

  // Re-arm timers whenever isPlaying or enabled changes.
  useEffect(() => {
    if (!enabled) {
      stopAdvance();
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }
    if (isPlaying) {
      startAdvance();
    } else {
      stopAdvance();
      resetIdle();
    }
    return () => {
      stopAdvance();
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [enabled, isPlaying, resetIdle, startAdvance, stopAdvance]);

  // Window-level interaction listeners.
  useEffect(() => {
    if (!enabled) return;
    const reset = () => {
      if (isPlaying) setIsPlaying(false);
      resetIdle();
    };
    const events = ["pointerdown", "pointermove", "wheel", "keydown"] as const;
    for (const ev of events) window.addEventListener(ev, reset, { passive: true });
    return () => {
      for (const ev of events) window.removeEventListener(ev, reset);
    };
  }, [enabled, isPlaying, resetIdle]);

  return { isPlaying, exit };
}
