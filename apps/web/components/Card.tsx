"use client";

import { useState } from "react";
import { CardBorder } from "./CardBorder";
import { LongPressMenu, type LongPressAction } from "./LongPressMenu";
import { useCardGestures } from "@/hooks/useCardGestures";
import { BORDER_STYLES } from "@/lib/borders";
import type { Card as CardModel } from "@/lib/types";

interface Props {
  card: CardModel;
  onAction: (
    cardId: string,
    action: LongPressAction | "lol" | "forward",
  ) => void;
}

export function Card({ card, onAction }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pulse, setPulse] = useState<"lol" | "forward" | null>(null);

  const flashPulse = (kind: "lol" | "forward") => {
    setPulse(kind);
    setTimeout(() => setPulse(null), 900);
  };

  const gestureHandlers = useCardGestures({
    onLongPress: () => setMenuOpen(true),
    onSwipeDown: () => {
      onAction(card.id, "lol");
      flashPulse("lol");
    },
    onSwipeUp: () => {
      onAction(card.id, "forward");
      flashPulse("forward");
    },
  });

  const sensors = card.sensors;
  const hasSensorRow =
    sensors &&
    (sensors.elevationM !== undefined ||
      sensors.ambientTempC !== undefined ||
      sensors.trailLengthM !== undefined ||
      sensors.compassHeadingDeg !== undefined);

  const borderLabel = BORDER_STYLES[card.borderKind].label;

  return (
    <article
      className="relative h-full w-full select-none touch-pan-x"
      aria-label={`${borderLabel} card from ${card.authorDisplayName}`}
      {...gestureHandlers}
    >
      <CardBorder kind={card.borderKind}>
        <div className="relative flex h-full w-full flex-col bg-zinc-950">
          <div className="relative flex-1 overflow-hidden">
            <img
              src={card.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
            {card.captionMode === "overlay" && card.captionText && card.overlayLayout && (
              <p
                className="absolute -translate-x-1/2 -translate-y-1/2 px-4 text-center"
                style={{
                  left: `${card.overlayLayout.x * 100}%`,
                  top: `${card.overlayLayout.y * 100}%`,
                  fontSize: card.overlayLayout.fontSize,
                  color: card.overlayLayout.color,
                  fontWeight: card.overlayLayout.fontWeight,
                  textShadow: "0 2px 12px rgba(0,0,0,0.55)",
                }}
              >
                {card.captionText}
              </p>
            )}
            {card.imageOrigin === "lidar_ai" && (
              <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-violet-200 backdrop-blur">
                Made with LiDAR
              </span>
            )}
            {card.forwardedFromDisplayName && (
              <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                ↪ via {card.forwardedFromDisplayName}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 bg-zinc-950/85 px-5 pb-5 pt-4 text-zinc-200">
            <header className="flex items-baseline justify-between gap-4">
              <h2 className="truncate text-base font-semibold text-zinc-100">
                {card.authorDisplayName}
              </h2>
              <time className="shrink-0 text-xs uppercase tracking-wide text-zinc-500">
                {timeAgo(card.createdAt)}
              </time>
            </header>

            {card.captionMode === "below" && card.captionText && (
              <p className="text-sm leading-snug text-zinc-300">{card.captionText}</p>
            )}

            {hasSensorRow && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                {sensors?.elevationM !== undefined && (
                  <li>⛰ {Math.round(sensors.elevationM)} m</li>
                )}
                {sensors?.ambientTempC !== undefined && (
                  <li>
                    🌡 {Math.round(sensors.ambientTempC)} °C
                    <span className="ml-1 text-zinc-500">
                      ({sensors.ambientTempSource === "sensor" ? "sensor" : "weather"})
                    </span>
                  </li>
                )}
                {sensors?.trailLengthM !== undefined && (
                  <li>👣 {(sensors.trailLengthM / 1000).toFixed(1)} km</li>
                )}
                {sensors?.compassHeadingDeg !== undefined && (
                  <li>🧭 {Math.round(sensors.compassHeadingDeg)}°</li>
                )}
              </ul>
            )}

            <div className="flex items-center gap-4 pt-1 text-xs text-zinc-500">
              <span>🔥 {card.counts.firewood}</span>
              <span>🪵 {card.counts.match}</span>
              <span>😂 {card.counts.lol}</span>
              <span>🔖 {card.counts.bookmark}</span>
              <span>↪ {card.counts.forward}</span>
              <span className="ml-auto rounded-full border border-zinc-700/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                #{card.tags[0] ?? "camping"}
              </span>
            </div>
          </div>
        </div>
      </CardBorder>

      {pulse && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
        >
          <span className="rounded-full bg-black/65 px-6 py-3 text-2xl font-semibold text-white shadow-2xl backdrop-blur animate-pulse-fade">
            {pulse === "lol" ? "😂  LOL" : "↪  Forwarded"}
          </span>
        </div>
      )}

      <LongPressMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAction={(action) => onAction(card.id, action)}
      />
    </article>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}
