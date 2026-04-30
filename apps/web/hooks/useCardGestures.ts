"use client";

import { useCallback, useRef } from "react";

// Hand-rolled gesture handler for card interactions.
//
// The horizontal feed scroll is handled by the parent container's CSS
// scroll-snap, NOT here — we deliberately let the browser own that path so
// momentum and snap-points are native. This hook owns three orthogonal
// signals on a single card:
//   - long press (500ms hold without significant movement)
//   - swipe down  → LOL
//   - swipe up    → forward
//
// Vertical-only direction is detected by comparing |dy| against |dx| at
// pointerup; if the gesture is mostly horizontal we ignore it so the parent's
// scroll-snap can do its work.

const LONG_PRESS_MS = 500;
const SWIPE_THRESHOLD_PX = 70;
const HORIZONTAL_TOLERANCE = 1.4; // |dy| must exceed |dx| * this to count

export interface CardGestureCallbacks {
  onLongPress?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export function useCardGestures(callbacks: CardGestureCallbacks) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      longPressFired.current = false;
      cancelLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        callbacks.onLongPress?.();
      }, LONG_PRESS_MS);
    },
    [callbacks, cancelLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      // If the user starts moving meaningfully, cancel the long-press timer.
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelLongPress();
    },
    [cancelLongPress],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      cancelLongPress();
      if (longPressFired.current) {
        start.current = null;
        return;
      }
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      start.current = null;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Only treat as a vertical gesture when the motion is mostly vertical.
      if (absY > SWIPE_THRESHOLD_PX && absY > absX * HORIZONTAL_TOLERANCE) {
        if (dy < 0) callbacks.onSwipeUp?.();
        else callbacks.onSwipeDown?.();
      }
    },
    [callbacks, cancelLongPress],
  );

  const onPointerCancel = useCallback(() => {
    cancelLongPress();
    start.current = null;
  }, [cancelLongPress]);

  // Right-click on desktop opens the long-press menu (per docs/spec/10-web.md).
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      callbacks.onLongPress?.();
    },
    [callbacks],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
  };
}
