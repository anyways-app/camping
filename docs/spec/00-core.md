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
| Trip participation | On (per-trip override available — see "Trips" → Sub-profile visibility) |

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
- **Raw uploaded contacts are never visible to anyone but the uploader, with two explicit leader-only exceptions:**
  1. **Share with troop.** A troop leader may toggle individual contacts from their own contact list as "Share with troop," exposing those specific contacts (display name + match-eligible phone hash) to every profile in the same troop.
  2. **Share with trip.** A troop leader who is a member of an active multi-troop trip may toggle individual contacts as "Share with this trip," exposing those specific contacts to every profile that is a member of that trip across all joined troops, for as long as the trip is active and the toggle stays on. See "Trips" below for full mechanics.

  In both cases the shared contact is not informed of the share-down — they only see normal mutual-match visibility if a viewer becomes a match. GDPR / CCPA posture preserved: both exceptions are per-contact, opt-in, leader-only, and revocable.

## Trips

Trips are a separate section of the app for multi-troop camping events. A trip groups profiles from multiple troops around a shared event, with its own contact list scoped to the trip and its own lifecycle. Trips do **not** merge troops, share billing, or expose either troop's master contact list or per-sub-profile feature-gate matrix to the other troop. Each joined troop keeps its identity, leader, and gates intact. The trip is purely a temporary multi-troop sharing surface.

### Lifecycle

1. **Create.** A troop leader creates a trip from the Trips section. Required: a name. Optional: dates, location text, description, cover image. Initial status: `draft`.
2. **Invite.** The trip creator (or any trip co-leader) invites *other troop leaders* by phone number / username. Each invited troop appears with `status = invited` until that troop's leader accepts.
3. **Accept.** The invited troop's leader accepts; their troop joins the trip. All sub-profiles in that troop become trip members by default — the troop's leader can opt specific sub-profiles out via the per-trip override on the "Trip participation" feature gate.
4. **Active.** Once any troop accepts, the trip is `active`. Members can browse the trip page, see the trip-shared contact list, and (subject to feature gates) participate.
5. **Ended.** The trip creator or any trip co-leader can mark the trip `ended`. The trip moves to a read-only archive: no new invites, no new shared contacts, no new shares. Historical visibility is preserved for participants.

### Roles within a trip

- **Trip creator.** The troop leader who created the trip. Always exactly one. Has full authority over trip settings, invites, co-leader promotion, and lifecycle. Trip creator status is not transferable in v1 — if the creator's troop leaves the trip, the trip ends.
- **Trip co-leader.** A troop leader (from a *joined* troop) promoted by the trip creator to share trip-management privileges. Can invite further troops, edit trip metadata, share contacts to the trip, and end the trip. Cannot demote the creator. Multiple co-leaders are permitted.
- **Trip member.** Any profile (leader or sub-profile) belonging to a joined troop, with that troop's leader's per-trip "Trip participation" toggle on. Can see the trip metadata, the trip-shared contact list, and the member roster. Cannot edit trip settings, invite, or share contacts unless they are the trip creator or a trip co-leader.

Trip-level co-leadership is **scoped to the trip only**. It does not affect any troop's internal leader, billing, security, or master contact list — see "Privacy boundaries" below. This is distinct from troop co-leadership (deferred to v2 per item 15); a trip co-leader still leads exactly one troop of their own.

### Trip-shared contact list

Each trip has its own shared contact list, separate from any troop's master list and separate from any individual profile's contact list.

- Any troop leader on the trip (creator, co-leader, or simply a joined-troop leader) can flick "**Share with this trip**" on individual contacts in their *own* master contact list. Bulk share supported.
- The shared contact appears in every trip member's view under "**Trip contacts: [Trip name]**" — distinct from the profile's own contacts and from any "Shared by [Leader]" segment within their own troop.
- Toggle is live and revocable: flip off → contact disappears from the trip's shared list on next refresh.
- Mutual-discovery rules unchanged. A trip-shared contact only becomes a *match* (with the dark-green direct-contact border) for a given trip member if both sides have uploaded each other and are both registered. Sharing into the trip only adds the contact to each member's mutual-discovery candidate pool.

### Sub-profile visibility

When a troop joins a trip, all sub-profiles in that troop become trip members by default (their per-trip override matches the troop-level "Trip participation" gate, which defaults to On). The troop's leader can deselect specific sub-profiles per trip from a "Trip visibility" panel inside that sub-profile's settings. A deselected sub-profile does not see the trip in their Trips list, does not see the trip-shared contact list, and is not enumerated to other trip members.

### Forwarding-gate interaction

A sub-profile's "**Forward outside the troop**" gate is **not** loosened by trip membership. Other trip members and trip-shared contacts both count as "outside the troop" for forwarding purposes. If a leader wants their sub-profile to forward into the trip context, they flip the gate on for that sub-profile — there is no separate "forward within trip" gate in v1.

### Privacy boundaries

- Joining a trip does **not** merge troops, share billing, or expose either troop's master contact list, sub-profile roster, or feature-gate matrix to the other troop.
- A trip member can see the *display names and avatars* of other trip members and the contents of the trip's shared contact list. They cannot see another troop's full member roster outside the trip context, nor any sub-profile of another troop whose leader has set "Trip visibility" off for that sub-profile.
- The "Share with this trip" toggle is the sole mechanism for exposing contacts across troops on a trip. Master contact lists remain leader-private.
- Trip-shared contacts are scoped to the trip's active window only. When a trip ends, its shared contacts no longer enter members' mutual-discovery pools and the trip-contacts segment becomes read-only in the archive view.

### v1 trip metadata

Customizable per trip; only `name` is required.

| Field | Type | Notes |
|---|---|---|
| `name` | text | required |
| `description` | text | optional, multi-line |
| `location_text` | text | optional, free-form (e.g., "Wind River Range, WY") |
| `start_date` | date | optional |
| `end_date` | date | optional |
| `cover_image_url` | text | optional |
| `status` | enum | `draft` \| `active` \| `ended` |

Trip-filtered feed views, trip geo-polygons, itineraries, RSVPs, packing lists, post-trip albums, public / discoverable trips, and trip-specific flair frames are deferred — see deferred list.

### Schema sketch

- `trips` (id, name, created_by_troop_id, created_by_profile_id, description, location_text, start_date, end_date, cover_image_url, status, created_at).
- `trip_troops` (trip_id, troop_id, joined_by_profile_id, status [invited / accepted / declined / left], invited_at, responded_at).
- `trip_co_leaders` (trip_id, profile_id) — `profile_id` is always a troop leader's id.
- `trip_shared_contacts` (trip_id, contact_id, shared_by_profile_id, shared_at).
- `trip_profile_visibility` (trip_id, profile_id, visible) — default `visible = true`; the troop's leader sets `false` to opt a sub-profile out of a trip.

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
  - `trips`: readable by every profile that is a member of the trip (joined troop ∩ `trip_profile_visibility.visible = true`); writable by the trip creator and trip co-leaders.
  - `trip_troops`: readable by every profile in any joined troop on the trip; insert by trip creator / co-leaders, status update by the invited troop's leader.
  - `trip_co_leaders`: readable by every trip member; writable by the trip creator only.
  - `trip_shared_contacts`: readable by every visible trip member; writable by any troop leader who is a member of the trip.
  - `trip_profile_visibility`: readable by the affected sub-profile and that troop's leader; writable by that troop's leader only.

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

17. **Trip features beyond v1 metadata.** v1 trips are a multi-troop contact-sharing surface with simple metadata (name, dates, location text, description, cover image, status). Deferred to v2+: trip-filtered feed views (show only cards from current-trip members), trip geo-polygons replacing free-form `location_text`, itineraries / activity sub-boards, packing checklists, per-profile RSVPs, post-trip albums and wrap-ups, trip-specific flair frames, and **public / discoverable trips** joinable beyond the invitation-only model. Each is its own design pass; v1 keeps trips intentionally minimal.

18. **Trip creator transfer / trip co-creator.** v1 hard-codes a single non-transferable trip creator (if their troop leaves, the trip ends). v2 may introduce trip creator transfer to a co-leader, and possibly a "co-creator" tier with elevated privileges short of full creator status.

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

### Trip-specific verification

19. Leader A creates a trip "Wind River 2026" with a name and start / end dates. Trip appears in A's Trips list with status = `draft`.
20. Leader A invites troop 2 (whose leader is B). B sees an invitation entry in B's Trips list. B accepts; trip status flips to `active`. All sub-profiles in troop 2 with default `Trip participation = On` see the trip in their Trips list.
21. Leader B toggles "Share with this trip" on a contact in B's master contact list. The contact appears in the trip's shared contact list, visible to every trip member across both joined troops, under the segment "Trip contacts: Wind River 2026."
22. Leader B unshares the same contact; it disappears from the trip's shared list within one refresh cycle.
23. As leader of troop 2, set "Trip visibility" for sub-profile B1 to **off** for this trip. Switch to B1; confirm the trip does not appear in B1's Trips list and the trip-shared contacts are not visible to B1. Confirm B1 is not enumerated to other trip members.
24. Leader A promotes Leader B to trip co-leader. Confirm B can now invite a third troop and edit the trip's metadata. Confirm B cannot demote Leader A.
25. Confirm a trip-shared contact appears as a *match* (dark-green direct-contact border) only when both that contact and the viewing trip member have uploaded each other and are both registered — not merely because the contact is in the trip-shared list.
26. Trip lifecycle: leader A marks the trip `ended`. Confirm no new invites, contacts, or shares are accepted; existing trip-shared contacts remain visible historically to participants in a read-only archive.

Automated test floor:
- Unit tests for the contact-matching algorithm (mutual-only + one-hop registered-only invariants, profile-pair-keyed).
- Unit tests for the troop-shared-contacts visibility rule (leader toggle on → sibling profiles see; off → siblings do not see; toggling does not leak unshared contacts; one-hop grants do not transfer across siblings).
- Unit tests for the trip-shared-contacts visibility rule (visible only to trip members across joined troops; invisible to sub-profiles whose leader has set `trip_profile_visibility = false`; goes read-only when trip ends).
- Unit tests for the per-sub-profile feature-gate matrix (block / report always on regardless of toggles; defaults match the spec table; "Forward outside the troop = off" still blocks forwarding to fellow trip members).
- Snapshot / visual tests for each of the 7 border kind + pattern combos.
- E2E: Playwright (web), Detox or Maestro (mobile).
