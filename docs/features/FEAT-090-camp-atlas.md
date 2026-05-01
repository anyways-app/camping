---
id: FEAT-090
area: iOS Platform
release: v2
status: Deferred
dependencies: [FEAT-001, FEAT-002, FEAT-013, FEAT-014, FEAT-017, FEAT-042, FEAT-051, FEAT-089, FEAT-091]
last_reviewed: 2026-05-01
---

# FEAT-090: Camp Atlas — group-shared, platform-owned site captures

## Summary

A v2+ capability that turns one user's LiDAR / Gaussian-splat capture of a campsite, trail segment, water access, summit, etc. into a **persistent, platform-owned, group-shared 3D scene**. A user with a capable device (iOS Pro LiDAR; later Android ToF / ARCore Depth) walks an area for ~30s–5min via an in-app "Map this place" mode; a cloud GPU service trains a 3DGS scene tied to a geo-bounded polygon; the result is automatically available to the capturer's mutual-contact group (and one-hop registered friends where the grant is set), so no one in their group needs to re-capture the same place.

The core differentiator from FEAT-042 (Splat Cards): **Camp Atlas captures are platform-owned**, licensed to Camp King in perpetuity at capture time via a plain-language consent screen. Camp King retains rights to redistribute them to a broader paying audience outside the original capturer's group — as a campsite-discovery product, a paid app tier, or other monetisation surfaces. By-product: a proprietary, growing geo-spatial dataset of camping locations that is hard for any competitor to bootstrap.

## Roles & permissions

- **Capturer** (any troop leader; sub-profile with Camp Atlas capture gate on — default off): performs the capture. Grants the perpetual license at capture time. Can request attribution removal but not capture deletion (Camp King retains under the perpetual licence, except in private-land takedown cases).
- **Capturer's contact group** (mutual-contact graph): free, ambient access to the capture — appears pinned on a map view, splatted in-feed, used as scenery during slideshow.
- **Camp King (platform)**: full ownership of capture data; uses internally; redistributes to a broader paying audience (mechanism TBD).
- **Broader Camp King audience** (paying, non-original-group): access via a paid tier or campsite-discovery product. Out of scope for v2.0 launch unless the monetisation work in deferred item 7 has shipped.
- **Third parties** (USFS / BLM, mapping companies, OSM-style open data): NO access under the v2 capture grant. Requires a v3 expanded consent or per-deal opt-in.
- **Site landowners / operators** (private campgrounds): can object and request capture removal; if upheld, capture is removed entirely from all surfaces.

## Surfaces

- **Capture flow** (mobile, hardware-gated): "Map this place" entry point → consent screen → guided capture (visual / audio prompts to walk the area) → upload + processing.
- **Capture consent screen**: plain-language, surfaced *before* capture begins. NOT buried in ToS. Spells out: Camp King ownership, perpetual licence, in-group sharing, broader-audience redistribution, take-down rights.
- **In-feed scenery / slideshow**: captures appear as ambient backdrop during slideshow, with attribution to the capturer.
- **Map view** (a new top-level surface for v2): pinned site captures viewable on a map; tap to enter the splat scene.
- **Site detail screen**: enter a captured scene → orbit / pan / zoom; metadata about who captured, when, weather conditions, etc.
- **Camp King-side admin tools**: ops surfaces for capture moderation, deduplication, take-down processing.

## Behaviour

(All TBD per the v2 design pass; sketch only.)

1. User taps "Map this place" from the appropriate entry point (likely the new map view's "+" CTA, or a contextual entry from a campsite or trail).
2. **Pre-capture consent**:
   - Plain-language disclosure (substance, not exact wording — drafted with legal):
     > "Camp Atlas captures the place around you and adds it to Camp King's shared map of camping locations. **By capturing, you give Camp King permanent rights to use and share this scene** — with your contacts (free), with other Camp King users (in our paid features), and to improve Camp Atlas. You can ask us to remove your name from the capture, but the capture itself stays with Camp King. We don't capture or share private property — only public lands."
   - User must tap "Capture" on this screen; cannot proceed otherwise.
3. **Public-land check** (default rule per the open questions): geofence the user's GPS against a public-lands dataset (USFS, BLM, state/national parks, designated dispersed sites). If outside the dataset → block with "Camp Atlas captures are limited to public lands. Private-land captures are not yet supported." If on the boundary or unknown → fall back to a "Are you on public land?" attestation prompt with a "I'll skip this for now" alternative.
4. **Guided capture**: hardware-specific (iOS Pro LiDAR for v2.0). Real-time visual + audio cues guide the user to walk the area, hold the camera at varying angles, etc. Capture lasts ~30s–5min depending on site size.
5. **Upload**: frames + depth + IMU streamed to Camp King's cloud GPU service. Server starts the 3DGS training job.
6. **Anonymisation pass**: server-side ML pipeline blurs / removes faces, license plates, and other human PII before any capture leaves the original capturer's contact-group visibility scope.
7. **3DGS training**: cloud GPU trains a Gaussian-splat scene tied to a `geo_polygon` derived from the GPS trail of the walk.
8. **Distribution**:
   - In-group: visible to the capturer's mutual-contact graph + one-hop registered friends with the grant set. Free, ambient.
   - Broader audience: paywalled / discovery-product surface (TBD).
9. **Deduplication**: when a new capture overlaps an existing canonical capture for the same geographic cell, server keeps the highest-quality one as canonical; older captures retained for diff/changelog ("this site after the 2027 burn") but de-prioritised in serving.
10. **Take-down request**: capturer requests attribution removal (in-app); private-land operator requests capture removal (out-of-band → ops review). Capture removal cascades through all distribution surfaces.

## Data

(Conceptual; full table designs land in the v2 design pass.)

- `site_captures (id, capturer_profile_id, geo_polygon, captured_at, scene_url, source_metadata_jsonb, quality_score, status: 'training' | 'ready' | 'archived' | 'removed')`.
- `site_captures_distribution (id, site_capture_id, audience_tier: 'in_group' | 'broader_paying' | 'third_party_external', enabled_at, disabled_at NULL)`.
- `site_capture_consents (id, capturer_profile_id, site_capture_id, version, consented_at, ip, user_agent)`.
- `site_capture_takedowns (id, site_capture_id, requested_by_profile_id NULL, reason, ops_status, processed_at NULL)`.

Privacy invariant impact: introduces a new RLS surface separate from the `cards` table. Default visibility is the capturer's mutual-contact graph; broader-audience surfaces are gated by an explicit `distribution_tier` row, not by inheriting card-level RLS rules.

## Edge cases

(Many; flagged for the v2 design pass.)

- **Capture on private land slipped past geofencing.** Operator objects → capture removed entirely (not just attribution stripped). Revisit geofence dataset.
- **Bystander faces / license plates not fully anonymised.** Re-run the anonymisation pass; if persistent, capture is removed.
- **Capturer requests attribution removal but capture is heavily relied on.** Attribution stripped; capture stays. Communicated clearly at capture time.
- **Capture quality is low** (poor lighting, partial walk, jitter). Server's quality-score gates whether it ships to in-group at all. Below threshold → notify capturer "Your capture didn't quite work — try again with these tips."
- **Capturer's contact group is empty** (a capturer with no mutual matches). Capture lives in their personal scene library; broader-audience distribution still applies if Camp King decides to surface it.
- **Storage / GPU economics.** Each capture is ~10–500 MB plus ongoing CDN serving; GPU training cost is real per scene. Sized as part of the v2 build budget. Open questions live in the spec.
- **Aging captures.** Ground truth changes (burn, flood, new structure). Retraining cadence TBD.
- **A capture's contact-group expands** (capturer makes a new mutual match): the new contact gains access to the in-group capture automatically.

## Out of scope

(All of v1. v2 itself excludes:)

- **Third-party license-out** to USFS / BLM / private operators / mapping companies / OSM-style open data. Requires v3 expanded consent or per-deal opt-in.
- **Public-trip integration** with site captures. Tied to FEAT-033 (deferred). Captures might surface as "scenery" within a public trip's geo polygon, but that's a v2.x integration.
- **Editable / annotatable captures** ("here's where the latrine is"). v2.0 captures are read-only scenes.
- **Multi-capturer collaborative captures** (several people walking different parts of a site, merged). v2.0 is single-capturer per scene.
- **Indoor capture** (cabins, gear sheds). v2.0 outdoor only — privacy and regulatory reasons.
- **Sub-profile capture by default**. Default off in the feature gate matrix (FEAT-007). The leader's call.

## Open questions

(All deferred to the v2 design pass. The major axes:)

1. **Capture rights on private vs. public land.** Default rule: only allow Camp Atlas captures on public lands (USFS, BLM, state/national parks, designated dispersed sites). Private campgrounds get blocked or routed to a per-site operator-consent flow. *(legal, product, ops)*
2. **Bystander faces / license plates / human PII in captures.** Default rule: server-side anonymisation pass before any capture leaves the original group's visibility scope. Algorithmic + human-review escalation path. *(legal, ops)*
3. **Duplicate / overlapping captures of the same site.** Default rule: keep the highest-quality canonical capture per geographic cell; older captures retained for diff / changelog ("this site after the 2027 burn") but de-prioritised in serving. Cell size: TBD (e.g., 50m grid). *(product, ops)*
4. **Storage and GPU economics.** Average capture size + ongoing storage cost + retraining cadence are sized as part of the v2 build budget. Pricing for the broader-audience tier needs to recover marginal costs. *(ops, product)*
5. **Take-down rights.** Capturer can request attribution be removed; Camp King retains the capture itself under the perpetual licence. If the underlying site is on private land and the operator objects, the capture is removed entirely. Process and SLA TBD. *(legal, ops)*
6. **Consent flow language.** Plain-language consent surfaced *before* capture begins, not buried in ToS. Final wording is legal-team-owned. *(legal)*
7. **Verification of public-land geofencing dataset.** USFS / BLM data is generally accurate but not exhaustive (unmarked dispersed sites; private inholdings within public lands). Default: combine multiple data sources; conservative-fallback to attestation. *(ops, legal)*
8. **Sub-profile capture eligibility.** Default: off in the gate matrix; leader can grant. Even when granted, the perpetual-licence consent must come from a leader-equivalent identity (ToS surface; not a sub-profile). *(legal, product)*
9. **Capture deletion from Camp King's side**. If the capture is found to violate the consent (e.g., it turns out to be on private land that we missed at capture time), Camp King removes it. Capturer has no obligation to keep it for Camp King. *(legal, ops)*
10. **Cross-platform**. v2.0: iOS Pro LiDAR. v2.x: Android ARCore Depth + ToF where available. Web: never a capture surface; possibly a viewing surface for public captures.
11. **Distribution tiering pricing**. Tied to FEAT-109 monetization work. *(product, ops)*

## Cross-platform notes

- **iOS Pro (LiDAR)**: the v2.0 capture surface. Builds on FEAT-051 (LiDAR fantastical) and FEAT-089 (LiDAR Night Sight) infrastructure. Native module wrapping the LiDAR depth stream + IMU + camera.
- **Android (ARCore Depth + ToF)**: v2.x. Limited to devices with the relevant hardware.
- **Web**: no capture; potentially a *view* surface for public captures via a 3DGS WebGL viewer (third-party library or in-house).

## Verification

To be defined in the v2 design pass. Skeleton:

- Capture-and-share-in-group: capturer captures a site; immediately accessible to their mutual-contact group; not visible to others.
- Consent screen: capture cannot proceed without explicit consent; consent recorded with version + timestamp.
- Public-land enforcement: attempt a capture in a private campground → blocked.
- Anonymisation: capture with visible faces → anonymisation pass strips them before in-group visibility.
- Attribution removal: capturer requests; attribution stripped; capture remains.
- Operator take-down: private-land operator objects; capture removed entirely from all surfaces.
- Broader-audience tier: paying user can browse captures outside their contact group; ops job moves a capture into the broader tier.
- Deduplication: capture an overlapping site; server picks highest-quality canonical; older capture is archived but accessible via diff.
