"use client";

import { BORDER_STYLES, type BorderStyle } from "@/lib/borders";
import type { BorderKind } from "@/lib/types";

// Renders the seven (color + pattern) frames around a card. Pattern is the
// accessibility-primary signal; the colour enriches but is not required.
//
// Sizing strategy: SVG fills the wrapper at 100%×100% and the rect inset is
// expressed via CSS Geometry Properties on the style prop, which accept calc()
// reliably in Chrome/Edge 80+, Firefox 69+, Safari 14+ — well within the
// support floor stated in docs/spec/10-web.md.

interface Props {
  kind: BorderKind;
  children: React.ReactNode;
}

const STROKE_WIDTH = 6;
const RADIUS = 28;
const INSET = STROKE_WIDTH / 2;

export function CardBorder({ kind, children }: Props) {
  const style = BORDER_STYLES[kind];

  return (
    <div
      className="relative h-full w-full"
      style={{ padding: STROKE_WIDTH * 1.5 }}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <BorderShape style={style} />
      </svg>
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ borderRadius: RADIUS - STROKE_WIDTH }}
      >
        {children}
      </div>
      <span className="sr-only">{style.description}</span>
    </div>
  );
}

const fillRect: React.CSSProperties = {
  x: `${INSET}px`,
  y: `${INSET}px`,
  width: `calc(100% - ${STROKE_WIDTH}px)`,
  height: `calc(100% - ${STROKE_WIDTH}px)`,
  rx: `${RADIUS}px`,
  ry: `${RADIUS}px`,
};

function BorderShape({ style }: { style: BorderStyle }) {
  const common = {
    fill: "none",
    stroke: style.color,
    strokeLinejoin: "round" as const,
  };

  switch (style.pattern) {
    case "solid":
      return <rect style={fillRect} strokeWidth={STROKE_WIDTH} {...common} />;
    case "dashed":
      return (
        <rect
          style={fillRect}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray="22 12"
          {...common}
        />
      );
    case "dotted":
      return (
        <rect
          style={fillRect}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray="2 10"
          strokeLinecap="round"
          {...common}
        />
      );
    case "double":
      return (
        <>
          <rect
            style={fillRect}
            strokeWidth={2}
            {...common}
          />
          <rect
            style={{
              x: `${INSET + 6}px`,
              y: `${INSET + 6}px`,
              width: `calc(100% - ${STROKE_WIDTH + 12}px)`,
              height: `calc(100% - ${STROKE_WIDTH + 12}px)`,
              rx: `${RADIUS - 6}px`,
              ry: `${RADIUS - 6}px`,
            }}
            strokeWidth={2}
            {...common}
          />
        </>
      );
    case "thin":
      return <rect style={fillRect} strokeWidth={2} {...common} />;
    case "wavy":
      return (
        <>
          <defs>
            <pattern
              id={`wavy-${style.kind}`}
              width="24"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0 7 Q 6 0, 12 7 T 24 7"
                fill="none"
                stroke={style.color}
                strokeWidth={STROKE_WIDTH * 0.7}
                strokeLinecap="round"
              />
            </pattern>
          </defs>
          <rect
            style={fillRect}
            fill="none"
            stroke={`url(#wavy-${style.kind})`}
            strokeWidth={STROKE_WIDTH * 1.4}
          />
        </>
      );
    case "chevron":
      return (
        <>
          <defs>
            <pattern
              id={`chevron-${style.kind}`}
              width="22"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0 14 L11 0 L22 14"
                fill="none"
                stroke={style.color}
                strokeWidth={STROKE_WIDTH * 0.7}
                strokeLinejoin="round"
              />
            </pattern>
          </defs>
          <rect
            style={fillRect}
            fill="none"
            stroke={`url(#chevron-${style.kind})`}
            strokeWidth={STROKE_WIDTH * 1.4}
          />
        </>
      );
  }
}
