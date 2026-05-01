---
id: FEAT-019
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-001, FEAT-002, FEAT-020]
last_reviewed: 2026-05-01
---

# FEAT-019: Trips section in app navigation

## Summary

Trips are a **separate top-level section** of the app, distinct from the feed. Trips group profiles from multiple troops around a shared event (camping trip, group expedition, etc.). The Trips section is the entry point to all trip-related surfaces: a list of trips the active profile is on, the create-trip flow, the per-trip detail screen with its trip-shared contact list and member roster.

## Roles & permissions

- **Any active profile**: sees the Trips section if their "Trip participation" feature gate is On (FEAT-007 / FEAT-030).
- **Leader profile**: sees the Trips section regardless (no gate applies to the leader).
- **Sub-profile with Trip participation gate Off**: Trips section is hidden from the navigation entirely — the leader has explicitly excluded them from trip experiences.

## Surfaces

- **Top-level navigation**. v1 has two top-level sections: Feed (FEAT-053) and Trips. On mobile: a tab bar at the bottom or a sidebar drawer. On web: a left rail or a top-bar nav. *(Open question 1.)*
- **Trips list**: the entry surface within the Trips section. Lists every trip the active profile is on, in three groups:
  - **Active**: trips currently in `status='active'` that the profile can see.
  - **Invited**: trips where the profile's troop has been invited but the leader hasn't accepted yet (only visible to the leader).
  - **Past**: trips in `status='ended'`, read-only archive.
- **Per-trip detail screen** (FEAT-022 lifecycle, FEAT-027 shared contacts, etc.) — drilled into from the list.
- **Create trip CTA** — leader-only entry point to FEAT-020.

## Behaviour

1. Active profile taps the Trips entry in navigation.
2. Trips list loads. Server returns: trips where the profile's troop is in `trip_troops` with `status='accepted'` AND the profile has `trip_profile_visibility.visible=true` for that trip.
3. List rendering: active section at top, invited section (leader-only) next, past section at bottom (collapsed by default; tap to expand). Each row: trip name, dates if set, cover image thumbnail, "[N] members" or "[N] troops" count. Tap a row → trip detail screen.
4. **Create trip CTA**: visible only to the leader. Floating button bottom-right (mobile) or list-header action (web). Tap → FEAT-020 trip creation flow.
5. **Empty state**: if the profile has no trips, list shows a helpful empty state. Leader sees "Create your first trip" CTA. Sub-profile sees "Trips you're invited to will appear here" without a CTA.
6. **Hidden state**: if the sub-profile's Trip participation gate is off, the Trips section is hidden from navigation entirely — they don't see an empty Trips screen, the navigation entry just isn't there. *(Open question 2.)*

## Data

Reads:
- `trip_troops` joined to `trips` for the list.
- `trip_profile_visibility` for sub-profile gating.
- `trips.cover_image_url` and metadata for list rendering.

Writes:
- None directly. Writes happen in the create / invite / accept / share flows (FEAT-020 onward).

## Edge cases

- **Active profile is on 50+ trips.** List paginates / lazy-loads after ~20 rows. *(Open question 3.)*
- **Trip the profile was invited to before being created (race).** Doesn't happen in v1 because invites are only sent to existing leaders; leaders must already exist to invite.
- **Trip's creator-troop is deleted.** Trip ends immediately (FEAT-022 step 5); appears in Past section for remaining members.
- **Sub-profile's trip visibility flipped off mid-session.** Trip disappears from their Trips list on next refresh. If they had the trip detail open, they're bounced back to the Trips list with a "You no longer have access to this trip" toast.
- **Network down.** Trips list serves the cached version with a "stale" indicator; tapping a row works against cached data; mutations are queued for replay.

## Out of scope

- **Trip-filtered feed view.** Tied to FEAT-033 (deferred). The feed section remains profile-wide; trips don't filter the feed in v1.
- **Trip search / discovery.** v1 trips are invitation-only; no search UI. Public / discoverable trips are FEAT-033.
- **Trip notifications.** Trip invite notifications, "new contact shared," etc. — tied to FEAT-092 (iOS) / FEAT-096 (Android) push notifications. The Trips section reflects state but doesn't drive notifications itself.
- **Trip-list customisation** (rearranging, archiving, hiding). Default: server-defined ordering.

## Open questions

1. **Navigation pattern.** Tab bar (always visible) vs. drawer / sidebar (hidden by default). Default: tab bar on mobile (Trips + Feed), top-bar on web. *(design)*
2. **Hidden vs. visible-but-empty Trips section** for sub-profiles with the gate off. Default: hidden entirely (don't draw attention to what they can't access). *(design)*
3. **Trip-list pagination.** Threshold for lazy-load (20 rows default). *(design, ops)*
4. **Past trip retention.** Do past trips persist forever, or auto-archive after N months? Default: forever in v1 (the trip object is small; the cards posted during the trip are part of normal feed history regardless). *(product)*
5. **Trip-list ordering within a group.** By start_date, by created_at, by activity recency? Default: start_date asc within Active; invited_at desc within Invited; ended_at desc within Past. *(design)*

## Cross-platform notes

- **Web**: top-level nav between Feed and Trips. M1 web shell does not yet have the Trips section — Feed-only.
- **iOS**: bottom tab bar with two tabs (Feed, Trips). Same as Android.
- **Android**: bottom tab bar identical to iOS.

## Verification

Trip-specific:

- **Step 19**: "Leader A creates a trip 'Wind River 2026' with a name and start / end dates. Trip appears in A's Trips list with status = `draft`." (Implies the Trips section and list exist.)
- **Step 20**: "Leader B sees an invitation entry in B's Trips list."

Proposed additions:

- Hidden-section test: sub-profile with Trip participation gate off → Trips entry is not in the navigation.
- Empty-state test: leader with no trips → empty state with "Create your first trip" CTA.
- Past-trip render test: end a trip → it moves from the Active group to the Past group on next refresh.
