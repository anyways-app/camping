# Camp King — Web App Addendum

Extends `00-core.md`. Only web-specific decisions live here.

## Stack

- **Next.js 14+** (App Router).
- **React 18+**, server components for feed pagination, client components for the swipe surface.
- **Tailwind CSS** for styling.
- **Radix UI** primitives for the long-press menu, modals, and forward-picker.
- **`@use-gesture/react` (or equivalent)** for swipe gestures on the card surface.
- **Supabase JS SDK** for auth, queries, realtime, storage uploads.
- **`canvas` / `OffscreenCanvas`** for client-side flair compositing at upload.

## PWA & install

- Manifest + service worker so the site is installable on desktop and mobile browsers.
- Offline shell only: cached app chrome + most-recent N feed cards. Posting requires connectivity.

## Auth UX

- Phone OTP form (shared component with mobile via `packages/ui`).
- Google + Apple OAuth via Supabase Auth's redirect flow.

## Image capture & upload

- File input with `accept="image/*"` and `capture="environment"` so mobile browsers can use the rear camera directly.
- No native sensor data attached. The web client populates **only**:
  - `geo_point` — opportunistically via the browser Geolocation API if the user grants permission. Optional.
  - All other sensor-fed fields (`elevation_m`, `compass_heading_deg`, `trail_length_m`, `ambient_temp_c`) are **read-only on web** — displayed when present on a card, never populated by the web composer.
- Caption-overlay editor uses HTML5 Canvas; final composite is a single PNG/JPEG uploaded to Supabase Storage.

## Casting (v1)

- **Mirror only** via the browser's native cast support:
  - Chrome / Edge desktop: "Cast tab" via the built-in Cast UI to a Chromecast.
  - Other browsers: fall back to fullscreen mode with the slideshow auto-running. UI hint: "For TV casting, open in Chrome or use the iOS / Android app."
- No app-side casting code in v1. v2 may add a `@google/cast-sdk` integration.

## Slideshow / idle

- 60s no-interaction → enter slideshow (full-screen, no chrome).
- 25s per card.
- Any input (mouse move, key press, click, swipe) exits slideshow.
- Wake-lock via the Screen Wake Lock API where supported, so the screen doesn't dim while casting.

## Navigation & gestures

- Swipe gestures on touchscreens; arrow keys + on-screen prev/next buttons for desktop.
- Desktop hover reveals the long-press menu via right-click; touch devices use long-press.
- Forward picker is a modal contact list.

## Browser support floor

- Chrome 110+, Edge 110+, Safari 16+, Firefox 115+. Older browsers get a "please update" page.
- Mobile Safari and mobile Chrome get the same layout; PWA install prompts where supported.

## Distribution

- Hosted on Vercel (or Cloudflare Pages — decide at deploy time).
- Single production environment + a staging environment fed by `main` and a `staging` branch respectively.

## Web-only verification additions

In addition to the cross-platform checks in core:
- Right-click on a card opens the long-press menu (desktop).
- Arrow keys advance the feed (desktop).
- Browser Geolocation prompt appears on first card creation; declining still allows posting (without `geo_point`).
- Cast tab to a Chromecast and confirm the feed renders.
- Install as a PWA on iOS Safari and Android Chrome; confirm the slideshow works in standalone mode.
