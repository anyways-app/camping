"use client";

import { useEffect } from "react";

// Long-press menu shows ONLY actions that have no gesture equivalent
// (per docs/spec/00-core.md):
//   - Block / report
//   - Firewood (like)
//   - Match (dislike)
//   - Bookmark
// Swipe-down LOL and swipe-up forward are gesture-only and are deliberately
// absent here — that is the "gesture XOR menu" rule.

export interface LongPressMenuProps {
  open: boolean;
  onClose: () => void;
  onAction: (action: LongPressAction) => void;
}

export type LongPressAction = "firewood" | "match" | "bookmark" | "block_report";

const ACTIONS: { id: LongPressAction; label: string; emoji: string; tone: string }[] = [
  { id: "firewood", label: "Firewood", emoji: "🔥", tone: "text-amber-200" },
  { id: "match", label: "Match (burn it)", emoji: "🪵", tone: "text-rose-300" },
  { id: "bookmark", label: "Bookmark", emoji: "🔖", tone: "text-sky-300" },
  { id: "block_report", label: "Block / report", emoji: "🚫", tone: "text-zinc-300" },
];

export function LongPressMenu({ open, onClose, onAction }: LongPressMenuProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Card actions"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <ul
        className="relative grid grid-cols-2 gap-3 rounded-2xl bg-zinc-900/95 p-4 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {ACTIONS.map((action) => (
          <li key={action.id}>
            <button
              type="button"
              className={`flex w-44 flex-col items-center gap-2 rounded-xl bg-zinc-800/80 px-4 py-5 text-sm font-medium transition hover:bg-zinc-700/80 active:scale-95 ${action.tone}`}
              onClick={() => {
                onAction(action.id);
                onClose();
              }}
            >
              <span className="text-3xl" aria-hidden="true">
                {action.emoji}
              </span>
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
