"use client";

import { useEffect } from "react";
import { CardBorder } from "./CardBorder";
import { BORDER_STYLES } from "@/lib/borders";
import type { Card as CardModel } from "@/lib/types";

// Zoom-out grid view (docs/spec/00-core.md). Renders ~12 cards on screen and
// returns to the feed at the picked card.

interface Props {
  cards: CardModel[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function GridView({ cards, activeIndex, onSelect, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "g") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="relative h-dvh w-full overflow-y-auto bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-200">
          Grid view
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700/90"
        >
          Back to feed
        </button>
      </header>
      <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((card, i) => {
          const borderLabel = BORDER_STYLES[card.borderKind].label;
          return (
            <li key={card.id} className="aspect-[4/5]">
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={`relative block h-full w-full ${i === activeIndex ? "ring-2 ring-emerald-400" : ""}`}
                aria-label={`${borderLabel} card from ${card.authorDisplayName}`}
              >
                <CardBorder kind={card.borderKind}>
                  <div className="relative h-full w-full bg-zinc-950">
                    <img
                      src={card.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-left">
                      <p className="truncate text-[11px] font-medium text-zinc-200">
                        {card.authorDisplayName}
                      </p>
                    </div>
                  </div>
                </CardBorder>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
