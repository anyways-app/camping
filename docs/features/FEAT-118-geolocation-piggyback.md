---
id: FEAT-118
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-007, FEAT-067, FEAT-113, FEAT-114, FEAT-115]
last_reviewed: 2026-05-04
---

# FEAT-118: Geolocation piggyback on mesh messages

## Summary

Per-message opt-in: at compose time (FEAT-114), the user can attach their device's last-known GPS coordinates to a mesh message. When attached, the message payload includes 6 bytes of compact lat/lon (3 bytes each, ~5 m resolution at the equator). Receivers display this on a Trip map. Privacy controls are layered: per-message opt-in is the user's choice; the **per-sub-profile "Geo capture on posts" feature gate (FEAT-007)** governs whether the toggle is even available; sub-profiles whose leader has gated it off cannot attach geolocation regardless of intent.

## Roles & permissions

- **Sender**: chooses per message whether to attach geolocation. Only available if the active profile's "Geo capture on posts" gate (FEAT-007) is on.
- **Receiver**: sees the geolocation rendered on the Trip map (or as a coordinate string if map is unavailable). Cannot opt out of receiving — geolocation is part of the message payload, not a separable channel.
- **Troop leader**: governs the gate via FEAT-007. Default for new sub-profiles is **Off** — leader must opt them in.

## Surfaces

- **Compose sheet** (FEAT-114): "Attach my location" toggle. Default off. Greyed out with explanation if the gate is off.
- **Receive surface** (FEAT-115): per-message detail sheet shows a mini-map with the sender's coordinates. The Trip map view (FEAT-019 "Map" tab — coordinates rendering only in v1; full map view is FEAT-033 deferred) overlays a pin per geolocation-tagged message.
- **Per-Trip "share my location" toggle** (proposed): a Trip-wide opt-in / opt-out shortcut that defaults all per-message toggles for the active profile. Useful for "I'm OK with my location being broadcast for this whole trip" without per-message friction. *(Open question 1.)*

## Behaviour

### Compose-time

1. User in compose sheet (FEAT-114) toggles "Attach my location."
2. Pre-flight checks:
   - `Geo capture on posts` gate is on for the active profile (FEAT-007). If off: toggle is greyed out with "Disabled by your troop leader."
   - OS-level location permission is granted to the app. If not: prompt the user; if declined, toggle the affordance off and surface a one-time hint.
   - A recent GPS fix (≤ 5 minutes old) is available. If not: surface "Acquiring location…" with a 30-second timeout.
3. On send: read the latest fix's `lat`, `lon`. Encode each as a 24-bit signed integer:
   - `encoded_lat = round(lat * 10^5)` — ~1.1 m resolution at equator, fits in 24 bits for ±90°.
   - `encoded_lon = round(lon * 10^5)` — ~1.1 m × cos(lat) m resolution. Fits in 24 bits for ±180°.
4. Set the `has-geolocation` flag in the cleartext header (FEAT-113).
5. Append the 6-byte (lat || lon) at the end of the encrypted blob plaintext.
6. AES-CCM encrypt as normal.

### Receive-time

1. Receiver decodes the cleartext header; sees `has-geolocation` flag.
2. After decrypt, extract the 6-byte trailing field; decode lat/lon by dividing by 10^5.
3. Render in:
   - The per-message detail sheet (mini-map with a pin).
   - The Trip's map overlay (a pin per geolocation-tagged message in the activity log).

### Privacy guards

- **Per-message opt-in**: default off; explicit toggle every send.
- **Per-sub-profile gate** (FEAT-007 "Geo capture on posts"): leader-controlled, default off for new sub-profiles. Affects the entire profile's geo-capture across cards AND mesh messages.
- **Per-trip override** (FEAT-029 "Trip visibility"): if a sub-profile is invisible on a trip, no mesh participation at all — geo is moot.
- **No "always-on" location broadcasting**: there is no equivalent of a "find-my-friends" persistent location share in Mesh-v1. Each location share is one message at a time. *(Open question 3.)*
- **Coarse fallback**: future option to broadcast at 100m precision (drop bottom 3 bits of each coordinate) for sub-profiles whose leader wants extra-conservative privacy. Not in v1. *(Open question 2.)*

## Data

Reads:
- OS-level GPS / fused location via the existing FEAT-067 surface.
- `profile_feature_gates` for the active profile (Geo capture on posts).

Writes:
- Adds 6 bytes to the encrypted-blob plaintext per FEAT-113 layout.
- Sets the has-geolocation flag in the cleartext header.

## Edge cases

- **No recent GPS fix at compose**: 30-second acquisition window with a "trying…" UI; on timeout, send without geolocation and surface "Couldn't attach location" toast.
- **Indoor / cellular-jammed conditions**: GPS may take longer than 30 s. v1 treats this as the timeout case above. *(Open question 4.)*
- **GPS fix is stale (e.g. user has been in a tent for an hour)**: the 5-minute freshness threshold catches this; user is prompted to re-acquire.
- **Lat/lon precision overflow**: at 24 bits, the encoding handles ±90° lat and ±180° lon with ~1.1 m precision. No overflow under valid coordinates. Defensive: encoder clamps to ±90 / ±180 and asserts.
- **Antimeridian (180° / -180°)**: encoding handles correctly; receiver's map rendering must too. v1 accepts that maps near the antimeridian may render two pins; rare in practice for camping use cases.
- **Geo-tagged message relayed**: relay does not strip or modify the geolocation bytes. The original sender's location persists through all relay hops.
- **Leader flips the gate off mid-Trip**: in-flight messages already in the queue retain their geo bytes; new compose attempts have the toggle greyed out. Defensive: server-side enforcement at FEAT-114 send rejects new geo-tagged sends if the gate is off.
- **Map rendering offline**: in offline mode (which is the whole point), receivers don't have access to a tile server. v1 displays coordinates as numbers + a static, low-resolution Mercator-projection mini-map sourced from a bundled offline tile set (limited to known camping regions in v1; *Open question 5*).

## Out of scope

- Continuous / real-time location sharing — Mesh-v1 is per-message only.
- Geofencing inside the mesh (e.g. "tell me when X enters this radius") — Mesh-v2.
- Reverse geocoding (turn coordinates into "Heartwood Ridge campsite") — requires online; not v1.
- Route-tracking ("here's the path I walked") — would require many messages over time; v1 does not aggregate.

## Open questions

1. **Per-Trip "share my location for this trip" shortcut**: surfaces a Trip-wide toggle that defaults all per-message geo-toggles to on for the active profile. Default: yes, surface this shortcut; per-message toggle remains user-overridable. *(product, design)*
2. **Coarse-precision option** (e.g. 100m for kid sub-profiles): a per-sub-profile gate value (off / coarse / full). Default: not in v1 — keep the gate binary; revisit if leaders ask for finer-grained control. *(product, legal)*
3. **No "always-on" location broadcast in v1**: confirm this stays out of scope. The risk of a kid's device broadcasting continuous coordinates over BLE is real even within the trip-scoped encryption. *(product, legal)*
4. **GPS-fix timeout tuning**: 30 seconds vs. 60 vs. configurable. Default: 30. *(product)*
5. **Offline tile set**: bundle a low-res offline tile set covering the regions Camp King users typically camp? Disk cost vs. UX benefit. Alternative: render coordinates only as text, no map. Default v1: text + a coordinate-pin viewer (no real map tiles); full map is FEAT-033. *(design, product)*
6. **Relay strips geo on a per-relay basis**: a relay device should NOT strip geo from a transit message — that would break end-to-end fidelity. Confirm. *(eng, security)*

## Cross-platform notes

- **iOS**: GPS via Core Location (FEAT-067 / 20-ios.md). Mini-map via MapKit on the receive surface; in offline mode, MapKit shows a "no map data" placeholder unless an offline pack is bundled.
- **Android**: GPS via FusedLocationProviderClient (FEAT-067 / 30-android.md). Mini-map via Google Maps SDK; offline-pack same caveat.
- **Web**: web does not participate in the mesh, so this feature does not apply on web.

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification: covered indirectly by Step 31 (Cross-platform test) — geo-tagged messages should round-trip across iOS and Android.

Proposed additions:

- Per-message opt-in test: compose with toggle off → no has-geolocation flag in header; verify decryption yields a payload with no trailing 6 bytes.
- Per-message opt-in test (reverse): compose with toggle on → has-geolocation flag set; receiver decodes coordinates within 1 m of the sender's actual location.
- Gate-off test: leader sets sub-profile's Geo gate off; sub-profile's compose UI greys out the toggle; if forced via direct API, server rejects.
- Stale-fix test: GPS fix is 6 minutes old; compose with toggle on → acquisition prompt fires.
- Relay-preserves-geo test: send geo-tagged message via 2-hop relay; final receiver decodes the original sender's coordinates correctly.
- Antimeridian test: send from a camping spot near 180° longitude; verify decode handles correctly.
