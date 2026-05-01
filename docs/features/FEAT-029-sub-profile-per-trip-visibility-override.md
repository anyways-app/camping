---
id: FEAT-029
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-007, FEAT-024, FEAT-030]
last_reviewed: 2026-05-01
---

# FEAT-029: Sub-profile per-trip visibility override

## Summary

When a troop joins a trip (FEAT-024), all sub-profiles in that troop become trip members by default — provided their per-sub-profile **"Trip participation"** feature gate (FEAT-030) is On. The leader has a finer-grained per-trip override: from a "Trip visibility" panel inside each sub-profile's settings, they can deselect specific sub-profiles for specific trips. A deselected sub-profile does not see the trip in their Trips list, does not see the trip-shared contacts, and is not enumerated to other trip members. The override sits *on top* of the broader Trip participation gate — Trip participation gate Off means no trips at all; Trip participation On + per-trip visibility Off means in some trips, not this one.

## Roles & permissions

- **Troop leader**: sole writer for the per-trip visibility override on every sub-profile in their troop. Can flip at any time (toggle is live).
- **Sub-profile**: read-only on their own per-trip visibility. Their UI reflects the leader's choices — if they're invisible on a trip, the trip doesn't appear in their Trips list and they're not a member.

## Surfaces

- **Per-sub-profile management screen** (FEAT-009) → drill into a sub-profile → "Trip visibility" sub-section. Lists every active trip the troop is on. Each row has a toggle (default On) per sub-profile.
- **Trip detail screen → Members section** (leader-only): a "Manage visibility" affordance that lists sub-profiles and per-trip toggles for that specific trip — the convenience surface for "who in my troop sees this trip."
- **Accept-trip flow pre-flight** (FEAT-024 OQ 2): optional pre-flight panel during the accept confirmation that lets the leader set per-sub-profile visibility before the trip even goes active.

## Behaviour

1. Trip is accepted (FEAT-024). Server inserts `trip_profile_visibility (trip_id, profile_id, visible=true)` for every profile in the joining troop with Trip participation gate On. Profiles with the gate Off get NO row inserted (effectively `visible=false` by absence).
2. Leader navigates to per-sub-profile management → sub-profile B1 → Trip visibility section → flips off for trip A.
3. Server: upserts `trip_profile_visibility (trip_id=A, profile_id=B1, visible=false)`.
4. Realtime broadcast: B1's client refreshes; trip A disappears from B1's Trips list. Trip A's other members re-fetch the roster; B1 is no longer enumerated.
5. **Re-enable**: leader flips back on → server upserts `visible=true`. B1 sees trip A reappear in their list.
6. **Trip participation gate flip Off** (FEAT-030): server cascades — sets `trip_profile_visibility.visible=false` for every active trip the sub-profile was on. If gate later flips back On, visibility rows reset to `visible=true` for all *current* trips (no historical resurrect). *(Open question 1.)*
7. **Sub-profile created mid-trip**: server hook inserts `trip_profile_visibility` rows for the new sub-profile across all trips the troop is on, with `visible` matching the new sub-profile's Trip participation gate default (On per FEAT-007).

## Data

Reads:
- `trip_profile_visibility` (every gated read consults this).
- `trip_troops` (to scope to trips the profile's troop is on).

Writes:
- `trip_profile_visibility` (upsert on toggle, cascade on gate flip, insert on accept / sub-profile create, delete on troop-leave / sub-profile-delete).

Schema reference: see `00-core.md#trips → Schema sketch`.

## Edge cases

- **Leader sets visibility off for ALL sub-profiles**: leader stays on the trip alone (as the joined troop's only visible profile). Trip is still active for them. Useful for "I'm joining but my kids aren't."
- **Leader is themselves the only visible profile, and they set their own visibility off**: not allowed in v1 — the leader's row in `trip_profile_visibility` is always `visible=true` while their troop is on the trip. The leader's visibility tracks `trip_troops.status='accepted'`, not the per-trip override. Server enforces. *(Open question 2.)*
- **Sub-profile sees trip A while it's loading; leader flips visibility off mid-load**: realtime broadcasts; client receives the visibility-revoked event; routes back to Trips list with "You no longer have access to this trip" toast.
- **Visibility toggle while a sub-profile is mid-share-contact** (sub-profile attempting to send a card to a trip-shared contact): the sub-profile can't share into the trip (FEAT-028), but they can forward to a trip-shared contact (subject to FEAT-031 forwarding gate). If visibility revokes mid-flight, the in-flight forward completes; future attempts fail.
- **Trip ends with mixed visibility**: visibility rows persist into the read-only archive. Sub-profiles with `visible=true` see the archive view; those with `visible=false` continue to see nothing.
- **Race: leader is editing one sub-profile's visibility on device A while editing another's on device B**: independent rows; no conflict.
- **Storage**: `trip_profile_visibility` grows with `(trips × profiles_per_troop_on_trip)`. For 50 trips × 7 profiles per troop × 5 troops = 1750 rows per troop — easily manageable.

## Out of scope

- **Sub-profile self-set visibility**. v1: leader-only.
- **Reasons / notes on the visibility override** ("opting B1 out because they're at camp"). Not v1.
- **Bulk visibility set across many trips at once**. Default v1: per-trip toggle. Bulk would be "make B1 invisible on all trips this month" — not v1.
- **Time-limited visibility** (e.g., "B1 visible only Friday-Sunday"). Not v1.

## Open questions

1. **Trip participation gate cascade behaviour.** When the gate flips Off (after being On), should existing visibility rows be set false (preserving the old override state for resurrection on re-On)? Or deleted (clean slate)? Default: set false (preserves intent if leader briefly toggles gate). *(product)*
2. **Leader's own visibility on a trip their troop is on.** Default: leader is always visible while the troop is on the trip (cannot self-hide). Alternative: leader can self-hide too — they're a member but invisible. Default keeps things simple; leader being on the roster is part of the trust model. *(product)*
3. **Visibility to whom**: when B1 is invisible on a trip, can OTHER trip members see "there are sub-profiles of [Troop 2] not visible here" indirectly? Default: no — invisible means absent from the roster entirely. The leader sees the count; members see only visible profiles. *(privacy)*
4. **Default for new sub-profiles created mid-trip.** Default: `visible=true` matching their Trip participation gate. Could be `visible=false` requiring explicit leader opt-in per trip. Default favours zero-friction; leader opts out if needed. *(product)*

## Cross-platform notes

No structural divergence. The UI is a per-sub-profile sub-section listing toggles, one per trip.

## Verification

Trip-specific:

- **Step 23**: "As leader of troop 2, set 'Trip visibility' for sub-profile B1 to **off** for this trip. Switch to B1; confirm the trip does not appear in B1's Trips list and the trip-shared contacts are not visible to B1. Confirm B1 is not enumerated to other trip members."

Proposed additions:

- Re-enable test: flip back on; B1 sees the trip again on next refresh.
- Trip-participation-gate cascade test: flip Trip participation gate off → all trip-visibility rows for that sub-profile go false; flip gate on → all rows return to true.
- Mid-load visibility revoke test: B1 has trip detail open; leader flips off; B1 is bounced back to Trips list.
- Sub-profile-created-mid-trip test: leader creates B2 while trip is active; B2 auto-included with `visible=true`.
