---
id: FEAT-033
area: Trips
release: v2
status: Deferred
dependencies: [FEAT-019, FEAT-021, FEAT-022, FEAT-027]
last_reviewed: 2026-05-01
---

# FEAT-033: Trip features beyond v1 metadata

## Summary

v1 trips are intentionally minimal: a multi-troop contact-sharing surface with simple metadata (name, description, location text, dates, cover image, status). This feature is the **catch-all bucket** for richer trip product surfaces deferred to v2+. Each is its own design pass; they're grouped here because they all extend the same core entity (`trips`) and share an audience (multi-troop attendees).

## Roles & permissions

(All TBD per the v2 design pass for each individual surface below.)

## Surfaces

This file is a catalog. Each item below would become its own FEAT-NNN once promoted to v2 active scope.

### Sub-features deferred under this umbrella

1. **Trip-filtered feed view.** A tab or filter in the Trips section that shows only cards posted by current-trip members during the trip's date window. Solves "what's the camping group up to right now?" without forcing each trip member to follow every other member individually.
2. **Trip geo-polygon.** Replaces free-form `location_text` with a map-drawn polygon (or pinned point + radius). Enables "you're entering trip area" notifications, location-based prompts ("post a card from this trail"), and integration with Camp Atlas (FEAT-090) for site captures within the polygon.
3. **Trip itinerary / activity sub-board.** Day-by-day schedule with named activities, time slots, who's leading each activity, etc. Useful for scout troops, organised expeditions, and multi-day events.
4. **Trip checklist / packing list.** Shared, editable list per trip. Each member ticks off their own items. Optionally synced from a canonical "[Trip type] packing list" template.
5. **Per-profile RSVP.** Each member of each joined troop indicates "Going / Maybe / Not going" with optional date constraints. Currently v1 makes "all visible profiles in joined troops are members"; RSVP would be the explicit per-profile attendance signal.
6. **Post-trip albums and wrap-ups.** Once a trip ends (FEAT-022), an automatic album of cards posted during the trip is curated (most-firewood, group photo, etc.) for the trip's read-only archive.
7. **Trip-specific flair frames.** Custom flair frame set selectable on cards posted during the trip ("Wind River 2026" frame). Tied to FEAT-044 flair frames.
8. **Public / discoverable trips.** Trips that any troop can self-join, browse from a regional listing, or search. v1 trips are strictly invitation-only; this would open up federated / community trips.
9. **Trip-only ad blocking.** While in trip context, ads are suppressed regardless of per-sub-profile gates. Useful for paid-tier trips or ad-light experiences during real outings.

## Behaviour

(All TBD per individual v2 design passes.)

Sketch for each:

- **Trip-filtered feed**: extra tab in Trips section showing `cards.author_id IN (trip members)` AND `cards.created_at IN (start_date, end_date)`. Subject to mutual-discovery + per-card visibility (no auto-bypass; trip context just adds a filter layer on top of normal visibility).
- **Geo-polygon**: server stores `trips.geo_polygon GEOGRAPHY(POLYGON)`. Clients fetch for map rendering. Mobile clients can subscribe to "I'm entering trip area" notifications via OS geofencing APIs.
- **Itinerary**: new table `trip_activities (id, trip_id, name, description, start_at, end_at, lead_profile_id)` + `trip_activity_attendees (activity_id, profile_id, status)`.
- **Packing list**: new table `trip_packing_items (id, trip_id, name, category, owner_profile_id NULL, completed)`. Owner_profile_id null = shared item; else assigned to a profile.
- **RSVP**: new table `trip_rsvps (trip_id, profile_id, status: 'going' | 'maybe' | 'not_going', dates_constraint_jsonb)`.
- **Albums**: server-side curation job runs at trip-end; outputs a `trip_albums` row referencing N cards. Read-only.
- **Trip flair**: extension to `flair_templates` with `trip_id` scoping; visible only to trip members during the trip.
- **Public trips**: `trips.visibility ENUM('private', 'public', 'unlisted')`; new search index over public trips' name + location.
- **Trip-only ad blocking**: server-side filter on the cards endpoint when the active context is a trip; suppresses `cards.border_kind='ad'`.

## Data

(Per sub-feature; conceptual.) New tables noted above.

## Edge cases

(All TBD; flagged for the individual design passes.)

## Out of scope (this umbrella)

- All of v1. Each sub-feature is a standalone design surface.
- Inter-trip feature interactions (e.g., RSVP sync across two related trips). Not in scope at all.
- Trip *templates* — saved trip configurations reusable across trips. Possibly an even-later v2.x or v3.

## Open questions

(Per sub-feature; consolidated here at a high level.)

1. **Sequencing.** Which sub-features ship first in v2? Likely candidates for v2.0: trip-filtered feed (low effort, high value); geo-polygon (paves the way for Camp Atlas FEAT-090). Itineraries / packing lists / RSVPs probably v2.1+ as user demand becomes clear. *(product)*
2. **Public-trip moderation.** Public trips need their own moderation considerations (who can join? how is abuse reported? merchant trips?). Bigger design pass than the technical implementation. *(legal, product)*
3. **Album curation algorithm.** Ranking by firewood count? Most-forwarded? Manually curated by the trip creator? *(product, design)*
4. **Trip-flair scope.** Limited to the trip's date window or available indefinitely after? *(design)*
5. **Geofencing privacy.** Sending OS-level geofence notifications for trip-entry adds cross-platform complexity and battery cost. Worth it? *(product, ops)*

## Cross-platform notes

To be defined per sub-feature.

## Verification

To be defined per sub-feature in their respective FEAT-NNN entries when promoted to active scope.
