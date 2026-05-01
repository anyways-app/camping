# Camp King — Core Spec (shared across web, iOS, Android)

This document holds the product invariants that apply to every Camp King client. Platform-specific details (sensors, native APIs, casting protocols, distribution) live in the sibling addenda:

- `10-web.md`
- `20-ios.md`
- `30-android.md`

When something appears in this file, it is binding on **all three** clients. Addenda only **extend** core; they may not contradict it.

---

## Audience & branding

- **Minimum age 13+ for every user of every profile**, attested by the troop leader at troop creation. Camp King does not classify any profile as a kids profile; the platform has no kids mode and no parental-consent flow at the platform level. See "Troops & profiles" below for the troop / sub-profile model. A v2+ verified-kids tier is in the deferred list.
- **Voice: fun, playful, camping-mastery + camaraderie.** No political framing. Tone: campfire warmth, gentle ribbing, badge-of-honor mastery.

## Troops & profiles

A Camp King account is a **troop** — a grouping of associated people represented by the profiles set up under it. The troop holds billing, security, and master-level controls; the profiles do the actual social-product work (post cards, hold contacts, receive cards in their feed). Netflix shape: one account, multiple profiles, profile picker on launch.

### Roles

- **Troop leader.** Adult human who owns the troop. Holds billing, owns security (password reset, MFA), sets per-sub-profile feature gates, manages the master contact list, and can share specific contacts down to the troop. Phone OTP and OAuth identities (Apple, Google) belong to the leader. **v1: exactly one leader per troop**; the role is a singleton, not a set. Co-leadership and ownership transfer to another adult identity are deferred to v2 (see deferred list).
- **Sub-profile.** Any other profile under the troop. The leader chooses who gets a sub-profile. Sub-profiles have no platform-level age classification — the leader decides who they hand a sub-profile to, and bears responsibility per the ToS attestation in "Audience & branding."

**v1 troop size limit.** Up to **6 sub-profiles per troop**, in addition to the troop leader (so 7 profiles maximum per troop). Matches Apple Family / Netflix-style household sizing for v1. Larger troops (scout-style, extended families, etc.) are deferred to a v2+ tiered offering.

### Profile-switching auth

- Avatar grid on app launch (Netflix-style). Tap an avatar to enter that profile.
- The **leader's profile** always requires a PIN (set by the leader at troop creation, resettable via the OAuth / OTP identity).
- Any sub-profile the leader marks "**protected**" also requires a PIN. Default: not protected.
- Device remembers the last-active profile to skip the picker on subsequent launches; "Switch profile" is always one tap away from anywhere in the app.
- All non-PIN actions (post a card, send a forward, etc.) execute as the active profile, never the leader implicitly.

### Per-sub-profile feature gates

The leader manages a feature toggle matrix per sub-profile. Defaults below are the **starting state for a newly-created sub-profile**; the leader can flip any of them. If the leader flips everything on, a sub-profile is effectively a peer adult — the model stays flexible, with no hard "junior" tier.

| Feature | Default for new sub-profile |
|---|---|
| Post cards | On |
| Receive cards in feed | On |
| Receive forwards from outside the troop | On |
| Forward outside the troop | **Off** |
| Long-press: block / report | **On (always — never gateable)** |
| Contact CSV import | **Off** (leader can enable, or pre-share via troop-shared list) |
| Voice clip recording | **Off** |
| Geo capture on posts | **Off** |
| Merchant card visibility | **Off** |
| Ad card visibility | **Off** |
| LiDAR fantastical (iOS Pro) | On |
| Camp Atlas capture (v2) | **Off** (only the leader captures and grants the licence) |
| Direct messages (v2) | **Off** |
| Slideshow / TV cast | On |

### Troop-wide contact sharing

The leader can expose specific contacts from their own contact list down to every profile in the troop, by flicking a per-row "**Share with troop**" toggle on the leader's contact-list screen. This is the controlled exception to the "raw uploaded contacts are never visible to anyone but the uploader" invariant — see "Social graph & privacy" below.

UX:

- Sub-profiles see their contact list in two segments:
  1. **My contacts** — what the sub-profile imported themselves.
  2. **Shared by [Leader display name]** — leader-toggled subset, visually distinct (separate header, accent colour). Sub-profiles never see leader contacts that aren't toggled on.
- Bulk share supported: leader can multi-select rows and "Share these N with the troop."
- Toggle is live and revocable: flip off → contact disappears from every sub-profile's shared segment on next refresh.
- Dedup: if a sub-profile already has the contact themselves *and* the leader has shared them, the leader-shared segment wins for display (it's the higher-trust source of the relationship).

Mutual-discovery and border kinds:

- A leader-shared contact enters a sub-profile's mutual-discovery candidate pool. They become a *match* (and earn the dark-green direct-contact border on their cards in that sub-profile's feed) only if both sides are registered and have each other.
- The "Shared by Leader" label persists on the contact-list row regardless of match status.
- Forwarding gates apply uniformly: a leader-shared contact is "outside the troop" for the "forward outside the troop" gate, since they are a real external person, not another sub-profile in the same troop.

### Schema sketch

Full table designs land in the backend doc. Conceptual shape:

- `troops` (id, billing_identity_id, leader_profile_id, created_at).
- `profiles` (id, troop_id, display_name, avatar_url, role, pin_hash NULL, protected_bool, created_at).
- `profile_feature_gates` (profile_id, feature, enabled).
- `troop_shared_contacts` (troop_id, contact_id, shared_by_profile_id, shared_at).
- `cards.author_id` references `profiles.id` (not a global user id).
- `contacts.uploader_profile_id` references `profiles.id`.
- One-hop grants and contact matches are profile-pair-keyed, not user-pair-keyed; one-hop grants are not transferable across sibling profiles in the same troop.

## Social graph & privacy

The social graph is **per-profile, not per-troop**. Each profile has its own contact list, its own mutual-discovery state, its own feed. Profiles in the same troop do not share a social graph by default; the only shared surface is the leader-managed troop-shared contacts segment described above.

- **Mutual-discovery only.** Two profiles see each other in-app only if **both** uploaded the other's contact info **and** both are registered.
- **One-hop visibility, registered profiles only.** A profile can toggle "let X see who I'm connected to" per friend. When on, X sees a sub-list under that profile's name showing only the *registered profiles* X doesn't already know — never raw uploaded contacts. No further hops. One-hop grants are not transferable across sibling profiles in the same troop.
- **Raw uploaded contacts are never visible to anyone but the uploader, with one explicit exception:** the troop leader may toggle individual contacts from their own contact list as "Share with troop," exposing those specific contacts (display name + match-eligible phone hash) to every profile in the same troop. The shared contact is not informed of the share-down — they only see normal mutual-match visibility if a sub-profile becomes a match. GDPR / CCPA posture preserved: the exception is per-contact, opt-in, leader-only.

## Auth

Auth identities live at the **troop** level, not the profile level. There is one phone-number / Apple ID / Google account per troop, owned by the troop leader.

- **Primary: phone-number SMS OTP.** Best match for contact import. The verified phone number is the leader's.
- **Alternate: Google OAuth, Apple OAuth.**
- Provider: Supabase Auth (Twilio / MessageBird routed under the hood).
- After successful auth, the user lands on the **profile picker** (see "Troops & profiles" → "Profile-switching auth"). Profile selection within a troop is handled by avatar tap + optional PIN; it is not a separate Supabase Auth event.

## Backend

- **Supabase** — managed Postgres, Auth, Storage, Realtime, Edge Functions.
- **Row-Level Security maps the privacy invariants.** All ownership keys are `profile_id`, not `user_id` (see "Troops & profiles"):
  - `contacts`: visible to the uploader profile only, **plus** other profiles in the same troop where a `troop_shared_contacts` row exists for that contact (display name + match-eligible phone hash only — never the raw upload metadata).
  - `contact_matches`: visible to either side of a mutual match (both keys are profile-ids).
  - `one_hop_grants`: controls whether the grantee profile can see the grantor profile's registered-friend list. Not transferable across sibling profiles in the same troop.
  - `cards`: visible based on the social graph of the *viewing profile* (direct contact, FoF if grant exists, public for ads / system messages).
  - `troop_shared_contacts`: readable by every profile in the troop; writable only by the leader profile.
  - `profile_feature_gates`: readable by the profile and the leader; writable by the leader only.

## The card (data model)

A card is the atomic content unit. Schema:

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | |
| `author_id` | uuid | references `profiles.id` (not a global user id) |
| `created_at` | timestamptz | |
| `image_url` | text | required; every card has an image |
| `image_origin` | enum | `camera` \| `gallery` \| `lidar_ai` (iOS Pro only — see iOS addendum) |
| `flair_template_id` | text | nullable; which decorative frame is overlaid |
| `caption_text` | text | nullable |
| `caption_mode` | enum | `below` \| `overlay` |
| `overlay_layout` | jsonb | x, y, font, color, size when `caption_mode = overlay` |
| `tags` | text[] | v1 always `["camping"]` |
| `forwarded_from_profile_id` | uuid | nullable; references `profiles.id` |
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
13. **Gaussian Splatting — Splat Cards.** A new card type. The author records a 30–60s walk-around (frames + depth + IMU); a cloud GPU service trains a 3DGS scene; recipients can orbit / pan the result in-feed. Cost per scene: ~$0.05–0.50 GPU + ~10–100 MB storage + bandwidth. Requires a new infra surface (training queue, GPU workers, splat CDN, in-app GS viewer). iOS Pro only at first; Android with ToF / ARCore Depth in a later wave. (Splat Cards are per-post, owned by the author, and live in the feed. The persistent, place-owned counterpart is item 14 below.)

14. **Camp Atlas — group-shared, platform-owned site captures.** Builds on items 12 and 13. A user with a capable device (iOS Pro LiDAR; later Android ToF / ARCore Depth) captures a Gaussian-splat scene of a specific campsite, trail segment, water access, summit, etc. via an in-app "Map this place" mode — a ~30s–5min walk-around depending on site size. The cloud GPU service trains a 3DGS scene tied to a geo-bounded polygon. The result is automatically available to the capturer's mutual-contact group (and one-hop registered friends where the grant is set), so no one else in their group needs to re-capture the same place.

    **Ownership and licence.** Captures are licensed to Camp King in perpetuity at capture time via a plain-language consent screen shown *before* capture begins (not buried in ToS). Camp King retains full rights to use captures internally and to redistribute them to a broader paying audience outside the original capturer's group — e.g., as a campsite-discovery product or a paid tier of the app itself (mechanism TBD; ties into the monetization work in item 7 and the marketplace work in item 6).

    **Distribution surfaces.**
    - Original capturer's mutual-contact group: free, ambient — sites appear pinned on a map view, splatted in-feed, or used as scenery during slideshow.
    - Broader Camp King audience: paid tier or campsite-discovery product (TBD).
    - **Out of scope for the v2 capture grant:** anonymous license-out to third parties (USFS / BLM, private campground operators, mapping companies, OSM-style open data). That requires either a v3 expanded consent or a per-deal opt-in.

    **Open questions to resolve before v2 build.**
    - Capture rights on private vs. public land. Default rule: only allow Camp Atlas captures on public lands (USFS, BLM, state/national parks, designated dispersed sites). Private campgrounds get blocked or routed to a per-site operator-consent flow.
    - Bystander faces, license plates, and other human PII visible in captures. Default rule: server-side anonymisation pass before any capture leaves the original group's visibility scope.
    - Duplicate or overlapping captures of the same site. Default rule: keep the highest-quality canonical capture per geographic cell; older captures retained for diff / changelog ("this site after the 2027 burn") but de-prioritised in serving.
    - Storage and GPU economics. Average capture size + ongoing storage cost + retraining cadence are sized as part of the v2 build budget, not committed here.
    - Take-down rights. The capturer can request their attribution be removed; Camp King retains the capture itself under the perpetual licence. If the underlying site is on private land and the operator objects, the capture is removed entirely.

    **Why this matters strategically.** The by-product of free use of the app is a proprietary, growing geo-spatial dataset of camping locations that is hard for any competitor to bootstrap. The same capability lowers friction for new users joining an existing group — they instantly see splatted scenes of their friends' favourite spots without ever having been there.

    **Privacy invariant impact.** Camp Atlas introduces a new RLS surface (`site_captures`, `site_captures_distribution`) separate from the `cards` table. Default visibility is the capturer's mutual-contact graph; broader-audience surfaces are gated by an explicit `distribution_tier` row, not by inheriting card-level RLS rules.

15. **Co-leadership and ownership transfer.** v1 limits a troop to a single leader (see "Troops & profiles" → Roles). v2 will introduce: **co-leadership**, where two or more adult identities share leader privileges (with a defined conflict-resolution rule when opposing setting changes collide); and **ownership transfer**, where the existing leader hands the troop off to another adult identity in a one-way move. Both have material auth, billing, security, and audit-trail implications that warrant their own design pass.

16. **Larger troops / tiered offering.** v1 caps a troop at 6 sub-profiles (7 profiles total). v2 may introduce a higher-tier troop sized for scout troops, extended families, classroom cohorts, etc. Tiered pricing, larger contact-import quotas, and possibly a "leader of leaders" structure (federated troops) come with this work.

## Verification (cross-platform end-to-end)

Run on each client before declaring v1 done. Each named "profile" below belongs to its own troop unless stated otherwise.

1. Sign up two **troops** with different phone numbers (each starts with a single leader profile A and B respectively); sign in to both.
2. Upload a contact CSV on profile A containing profile B's phone, and vice versa. Both profiles see each other connected.
3. Profile A toggles "expose my contacts" for B. B sees one-hop registered profiles under A; B never sees A's raw uploaded contacts.
4. Profile A creates a card: image → flair → caption → overlay convert → preview → post. Tag chip is `camping` and locked.
5. Profile B sees the card with dark-green border + double-line pattern. Long-press shows firewood / match / bookmark / block / report. Swipe-down logs LOL; swipe-up opens forward picker.
6. Profile B forwards the card to profile C (leader of a third troop). C sees it with white-border dotted pattern and B's username pinned.
7. 60s idle → slideshow starts; advances every 25s.
8. Cast (mirror) the feed to a TV from each platform.
9. Upload triggers an automated moderation flag → post lands in queue, not the public feed.
10. Report a post as profile B → appears in the manual review queue.

### Troop-specific verification

11. From the leader profile of troop 1, create a sub-profile B1. B1 appears on the profile picker on next app launch.
12. PIN-protect sub-profile B1 from the leader's settings panel; confirm B1 cannot be entered without the PIN. Confirm the leader profile always requires its PIN regardless of any toggle.
13. As leader of troop 1, set "Forward outside the troop" to **Off** for B1. Switch to B1; confirm the swipe-up forward gesture either does nothing or surfaces "Disabled by troop leader." Confirm B1 can still forward to *other profiles within the same troop*.
14. As leader of troop 1, toggle "Share with troop" on a contact in the leader's contact list. Switch to B1; confirm the contact appears in B1's contact list under "Shared by [Leader display name]" and not in B1's "My contacts" segment.
15. Untoggle the share; refresh B1; the contact disappears from the shared segment within one refresh cycle.
16. As leader, set "Ad card visibility" to Off for B1. Switch to B1; confirm no ad-bordered cards appear in B1's feed.
17. Block / report on a sub-profile is never gated: confirm the option is present on every long-press menu in B1, regardless of any feature toggle.
18. Switch from B1 back to the leader profile via the "Switch profile" entry; confirm the leader's PIN is required and the active session token re-scopes to the leader profile.

Automated test floor:
- Unit tests for the contact-matching algorithm (mutual-only + one-hop registered-only invariants, profile-pair-keyed).
- Unit tests for the troop-shared-contacts visibility rule (leader toggle on → sibling profiles see; off → siblings do not see; toggling does not leak unshared contacts; one-hop grants do not transfer across siblings).
- Unit tests for the per-sub-profile feature-gate matrix (block / report always on regardless of toggles; defaults match the spec table).
- Snapshot / visual tests for each of the 7 border kind + pattern combos.
- E2E: Playwright (web), Detox or Maestro (mobile).
