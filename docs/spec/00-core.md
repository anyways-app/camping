# Camp King — Core Spec (shared across web, iOS, Android)

This document holds the product invariants that apply to every Camp King client. Platform-specific details (sensors, native APIs, casting protocols, distribution) live in the sibling addenda:

- `10-web.md`
- `20-ios.md`
- `30-android.md`

When something appears in this file, it is binding on **all three** clients. Addenda only **extend** core; they may not contradict it.

---

## Audience & branding

- **Minimum age 13+.** No kids mode, no parental-consent flow. Standard 13+ social-platform ToS.
- **Voice: fun, playful, camping-mastery + camaraderie.** No political framing. Tone: campfire warmth, gentle ribbing, badge-of-honor mastery.

## Social graph & privacy

- **Mutual-discovery only.** Two users see each other in-app only if **both** uploaded the other's contact info **and** both are registered.
- **One-hop visibility, registered users only.** A user can toggle "let X see who I'm connected to" per friend. When on, X sees a sub-list under that user's name showing only the *registered users* X doesn't already know — never raw uploaded contacts. No further hops.
- **Raw uploaded contacts are never visible to anyone but the uploader.** GDPR/CCPA-defensible posture.

## Auth

- **Primary: phone-number SMS OTP.** Best match for contact import.
- **Alternate: Google OAuth, Apple OAuth.**
- Provider: Supabase Auth (Twilio/MessageBird routed under the hood).

## Backend

- **Supabase** — managed Postgres, Auth, Storage, Realtime, Edge Functions.
- **Row-Level Security maps the privacy invariants:**
  - `contacts`: row owner only.
  - `contact_matches`: visible to either side of a mutual match.
  - `one_hop_grants`: controls whether the grantee can see the grantor's registered-friend list.
  - `cards`: visible based on the social graph (direct contact, FoF if grant exists, public for ads/system).

## The card (data model)

A card is the atomic content unit. Schema:

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | |
| `author_id` | uuid | |
| `created_at` | timestamptz | |
| `image_url` | text | required; every card has an image |
| `image_origin` | enum | `camera` \| `gallery` \| `lidar_ai` (iOS Pro only — see iOS addendum) |
| `flair_template_id` | text | nullable; which decorative frame is overlaid |
| `caption_text` | text | nullable |
| `caption_mode` | enum | `below` \| `overlay` |
| `overlay_layout` | jsonb | x, y, font, color, size when `caption_mode = overlay` |
| `tags` | text[] | v1 always `["camping"]` |
| `forwarded_from_user_id` | uuid | nullable |
| `geo_point` | geography(Point) | nullable; populated from device GPS when available |
| `elevation_m` | numeric | nullable; from barometer or GPS |
| `compass_heading_deg` | numeric | nullable; direction the camera was pointing |
| `trail_length_m` | numeric | nullable; populated from pedometer "trail" mode |
| `ambient_temp_c` | numeric | nullable |
| `ambient_temp_source` | enum | `sensor` \| `weather_api` \| null |
| `voice_clip_url` | text | nullable; optional ambient/voice audio attached to the card |
| `bookmark_count`, `firewood_count`, `match_count`, `lol_count`, `forward_count` | int | denormalized |

`border_kind` is **derived at render time** from the social graph + `image_origin` + author flags, not stored.

Border kinds: `default | ad | forwarded | system | direct_contact | friend_of_friend | merchant`.

## Feed

- **Horizontal full-screen card swipe.** Each card occupies most of the screen, top-aligned; bottom band reserved for the horizontal "+" create button and current-card meta.
- **Zoom-out grid view.** Button collapses the feed to ~12 cards on screen; tap returns to full-screen on that card.
- **Auto-slideshow** kicks in after 60s of no interaction; advances 1 card every 25s. Designed for casting to a TV.

## Card creation flow

1. Tap horizontal "+" bar.
2. Blank template appears: central image slot, caption field at bottom.
3. **Image source options** (per platform — see addenda):
   - Pick from gallery
   - Take a photo
   - **LiDAR fantastical** (iOS Pro only — produces `image_origin = lidar_ai`)
4. **Camping flair**: pick one frame from the curated set (~12 frames in v1, in `assets/flair/`). Composited onto the image client-side at upload — no per-view rendering.
5. Caption: type 1–2 sentences. "Convert to overlay" moves text onto the image with movable / resizable / font / color controls.
6. Preview step (right-arrow → preview, left-arrow → back to editor).
7. Tag step. v1: `"camping"` is auto-applied as a single locked chip.
8. Post → uploads composited image, creates card row, appears in feed.

## Card interactions (gesture XOR menu)

Long-press menu (no gesture equivalents):
- Block / report poster
- Firewood (like)
- Match (dislike — "burn it")
- Bookmark

Gesture-only (not duplicated in menu):
- Swipe down → LOL
- Swipe up → Forward (opens contact picker; recipient sees card with forwarded border + sender's username pinned)
- Swipe left / right → next / previous card

## Border encoding (color + pattern)

Pattern carries the meaning for accessibility; color is enrichment. Screen readers announce the border kind explicitly.

| Border kind | Color | Pattern |
|---|---|---|
| Default | Black | Solid line |
| Advertisement | Gray | Long dashes |
| Forwarded | White | Dotted |
| System message | Red | Wavy / sine |
| Direct contact | Dark green | Double line |
| Friend-of-friend | Light green | Single thin line |
| Merchant | Gold | Chevron / sawtooth |

## Tagging (v1)

- Single system-defined tag: `"camping"`. Auto-applied.
- v2+ adds further tags (`informative`, `help`, `ask`, `announcement`, etc.). Schema is already array-based.

## Camping-flair frames

- v1 launch set: ~12 PNG/SVG decorative overlays in `assets/flair/`. Examples: campfire glow at edges, pine-bough corners, lantern-corner overlay, hammock silhouette, canoe ribbon along the bottom, marshmallow-on-stick corner, compass-rose corner.
- Compositing happens client-side at upload.

## Content moderation

- **Layer 1 — automated pre-moderation on upload.** Image classifier + caption text classifier flag adult / violence / hate / PII. Flagged posts go to a review queue and **never appear in any feed** until cleared.
- **Layer 2 — manual report queue.** In-app reports route to the same queue.
- Budget: ~$1–3 per 1000 posts in API costs at launch.

## Image hosting + flair compositing

- Composite at upload on the device. One final PNG/JPEG stored.
- Bucket: Supabase Storage `cards/`. Originals optionally retained in `cards-originals/` for re-edits.

## Casting (v1)

OS-level screen mirroring on every platform. No native cast streams in v1 (deferred). Per-platform mechanism is in each addendum.

## Sensor-fed card fields (overview)

The card schema reserves these fields for sensor-derived data; **how** they get populated is platform-specific (see addenda):

| Field | Source intent |
|-------|---------------|
| `geo_point` | Device GPS / fused location |
| `elevation_m` | Barometer if present, else GPS-derived |
| `compass_heading_deg` | Magnetometer + gyroscope |
| `trail_length_m` | Pedometer "trail mode" (start/stop) |
| `ambient_temp_c` + `ambient_temp_source` | On-device thermometer if present, else weather API for the geo_point |
| `voice_clip_url` | Microphone capture, optional |

The web client cannot populate most of these; it should display them when present and gracefully omit them when absent.

## Deferred to v2+

Each requires its own design pass.

1. Real-time chat / DM
2. Calendar / event management
3. Ride-share / transportation coordination
4. Convoy management
5. Campsite availability / dispersed camping
6. Marketplace / paid connections / merchant onboarding
7. Monetization, billing, ultra-monetized reach
8. Additional system tags beyond `"camping"`
9. AI image generation from a text prompt (general-purpose nano banana flow). Note: a **narrow** AI-image flow exists in v1 on iOS Pro only — the LiDAR fantastical mode (see iOS addendum). The general "describe an image" flow is still deferred.
10. Native cast-stream support (replacing v1 mirror-the-screen)
11. Native iOS/Android rebuild if React Native proves limiting
12. **Gaussian Splatting — Night Sight v2.** Accumulate a few seconds of LiDAR + RGB into an incremental on-device 3D Gaussian Splat (SplaTAM / MonoGS-style) and render artificially-coloured novel views, giving a wider perceived field of view than v1's raw ~5m point-cloud. Bleeding-edge on mobile; needs research-grade pipelines to mature.
13. **Gaussian Splatting — Splat Cards.** A new card type. The author records a 30–60s walk-around (frames + depth + IMU); a cloud GPU service trains a 3DGS scene; recipients can orbit / pan the result in-feed. Cost per scene: ~$0.05–0.50 GPU + ~10–100 MB storage + bandwidth. Requires a new infra surface (training queue, GPU workers, splat CDN, in-app GS viewer). iOS Pro only at first; Android with ToF / ARCore Depth in a later wave.

## Verification (cross-platform end-to-end)

Run on each client before declaring v1 done:

1. Sign up two users with different phone numbers; sign in.
2. Upload a contact CSV on user A containing user B's phone, and vice versa. Both users see each other connected.
3. User A toggles "expose my contacts" for B. B sees one-hop registered users under A; B never sees A's raw uploaded contacts.
4. User A creates a card: image → flair → caption → overlay convert → preview → post. Tag chip is `camping` and locked.
5. User B sees the card with dark-green border + double-line pattern. Long-press shows firewood/match/bookmark/block/report. Swipe-down logs LOL; swipe-up opens forward picker.
6. User B forwards the card to user C. C sees it with white-border dotted pattern and B's username pinned.
7. 60s idle → slideshow starts; advances every 25s.
8. Cast (mirror) the feed to a TV from each platform.
9. Upload triggers an automated moderation flag → post lands in queue, not the public feed.
10. Report a post as user B → appears in the manual review queue.

Automated test floor:
- Unit tests for the contact-matching algorithm (mutual-only + one-hop registered-only invariants).
- Snapshot/visual tests for each of the 7 border kind + pattern combos.
- E2E: Playwright (web), Detox or Maestro (mobile).
