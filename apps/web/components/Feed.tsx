"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "./Card";
import { GridView } from "./GridView";
import { useIdleSlideshow } from "@/hooks/useIdleSlideshow";
import type { Card as CardModel } from "@/lib/types";
import type { LongPressAction } from "./LongPressMenu";

// Horizontal full-screen feed.
//
// Why CSS scroll-snap for left/right: the browser's native momentum and snap
// behaviour beats anything we'd hand-roll. We let it own that axis. Cards then
// own their own pointer events for vertical (LOL / forward) and long-press.
//
// Active-card tracking uses an IntersectionObserver because it cleanly handles
// programmatic scroll (slideshow advance) and user scroll without fighting
// the native scroller.

interface Props {
  cards: CardModel[];
}

type Toast = { id: number; text: string };

export function Feed({ cards }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((text: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1800);
  }, []);

  const handleCardAction = useCallback(
    (cardId: string, action: LongPressAction | "lol" | "forward") => {
      const card = cards.find((c) => c.id === cardId);
      const author = card?.authorDisplayName ?? "card";
      switch (action) {
        case "firewood":
          pushToast(`🔥 Firewood for ${author}`);
          break;
        case "match":
          pushToast(`🪵 Match — burn it`);
          break;
        case "bookmark":
          pushToast(`🔖 Bookmarked`);
          break;
        case "block_report":
          pushToast(`🚫 Block / report — opened`);
          break;
        case "lol":
          pushToast(`😂 LOL`);
          break;
        case "forward":
          pushToast(`↪ Forward — picker would open here`);
          break;
      }
    },
    [cards, pushToast],
  );

  const scrollToIndex = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const target = cardRefs.current[i];
      const track = trackRef.current;
      if (!target || !track) return;
      track.scrollTo({ left: target.offsetLeft, behavior });
    },
    [],
  );

  const advanceSlideshow = useCallback(() => {
    setActiveIndex((prev) => {
      const next = (prev + 1) % cards.length;
      // Defer the scroll until after state commit so refs are stable.
      requestAnimationFrame(() => scrollToIndex(next));
      return next;
    });
  }, [cards.length, scrollToIndex]);

  const slideshow = useIdleSlideshow(advanceSlideshow, !showGrid);

  // Track which card is centered using IntersectionObserver.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: track, threshold: [0.6] },
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [cards]);

  // Keyboard navigation on desktop.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showGrid) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollToIndex(Math.min(cards.length - 1, activeIndex + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollToIndex(Math.max(0, activeIndex - 1));
      } else if (e.key === "g") {
        setShowGrid(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, cards.length, scrollToIndex, showGrid]);

  const dotIndex = useMemo(() => activeIndex, [activeIndex]);

  if (showGrid) {
    return (
      <GridView
        cards={cards}
        activeIndex={activeIndex}
        onSelect={(i) => {
          setShowGrid(false);
          setActiveIndex(i);
          requestAnimationFrame(() => scrollToIndex(i, "auto"));
        }}
        onClose={() => setShowGrid(false)}
      />
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-zinc-950 text-zinc-100">
      <div
        ref={trackRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth no-scrollbar"
        aria-label="Camp King feed"
        role="region"
      >
        {cards.map((card, i) => (
          <div
            key={card.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            data-index={i}
            className="flex h-full w-full shrink-0 snap-center items-stretch px-3 py-3 sm:px-6 sm:py-4"
            style={{ scrollSnapStop: "always" }}
          >
            <div className="mx-auto h-full w-full max-w-[560px] pb-16">
              <Card card={card} onAction={handleCardAction} />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom create bar (per docs/spec/00-core.md — the horizontal "+"). */}
      <button
        type="button"
        onClick={() => pushToast("➕ Card creation flow lands in the next milestone.")}
        className="absolute inset-x-0 bottom-0 z-20 flex h-12 items-center justify-center gap-2 border-t border-zinc-800 bg-zinc-950/95 text-sm font-medium text-zinc-300 backdrop-blur transition hover:bg-zinc-900/95"
        aria-label="Create a new card"
      >
        <span aria-hidden="true">＋</span> New card
      </button>

      {/* Position indicator + grid toggle. */}
      <div className="pointer-events-none absolute left-0 right-0 top-3 z-10 flex justify-center px-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-zinc-900/80 px-4 py-1.5 text-xs text-zinc-400 ring-1 ring-white/5 backdrop-blur">
          <span className="font-mono tabular-nums">
            {String(dotIndex + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => setShowGrid(true)}
            className="rounded-full bg-zinc-800/80 px-3 py-1 font-medium text-zinc-200 hover:bg-zinc-700/90"
            aria-label="Open grid view"
          >
            Grid
          </button>
        </div>
      </div>

      {/* Toasts: ephemeral feedback for gesture/menu actions. */}
      <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-30 flex flex-col items-center gap-2 px-4 pb-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-full bg-zinc-100/95 px-4 py-1.5 text-sm font-medium text-zinc-900 shadow-lg"
          >
            {t.text}
          </div>
        ))}
      </div>

      {slideshow.isPlaying && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-emerald-500/85 px-3 py-1 text-xs font-semibold text-emerald-950">
          Slideshow · 25s
        </div>
      )}
    </div>
  );
}
