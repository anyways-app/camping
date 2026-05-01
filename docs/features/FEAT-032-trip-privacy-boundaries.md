---
id: FEAT-032
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-001, FEAT-013, FEAT-018, FEAT-019, FEAT-027, FEAT-029]
last_reviewed: 2026-05-01
---

# FEAT-032: Trip privacy boundaries

## Summary

Joining a trip does **not** merge troops, share billing, or expose either troop's master contact list, sub-profile roster, or per-sub-profile feature-gate matrix to the other troop. Trips are a *temporary multi-troop sharing surface* for two specific things only: (1) the trip-shared contact list (FEAT-027) and (2) the visible-to-other-trip-members fact that you are a member of this trip (display name + avatar in the roster). Everything else stays inside the troop boundary. This feature documents the precise extent and limit of cross-troop visibility on a trip — the load-bearing privacy invariant that makes trips safe for participants who otherwise barely know each other.

## Roles & permissions

This feature constrains every trip-related screen — it's an invariant, not a UI surface. Specifically:

- **Trip member** (any role) can see, on a trip:
  - Trip metadata (name, dates, location text, description, cover image — FEAT-021).
  - Roster of *visible* members across joined troops: display name + avatar only.
  - Trip-shared contact list (FEAT-027): contacts visible per FEAT-018 RLS.
  - Cards posted by other trip members **if** the viewer is in their social graph independently (mutual-discovery, FoF) — being on the same trip does NOT auto-grant feed visibility.
- **Trip member CANNOT** see, on a trip:
  - Another troop's master contact list (FEAT-013 still applies).
  - Another troop's per-sub-profile feature gate matrix (FEAT-007 still applies).
  - Another troop's billing identity, payment method, or troop-level settings (FEAT-001 still applies).
  - Sub-profiles in another troop whose leader has set their per-trip visibility to off (FEAT-029).
  - Cards posted by another trip member to surfaces they don't have social-graph access to.

## Surfaces

The boundary applies across:

- Trip detail screen (FEAT-022): roster shows only display name + avatar; tap on another troop's member shows nothing more than what mutual-discovery already surfaces.
- Trip-shared contacts (FEAT-027, FEAT-028): the *only* cross-troop contact-sharing mechanism on a trip.
- Per-trip visibility (FEAT-029): leader's tool to control which of their sub-profiles are even enumerated.
- Mutual-discovery + feed: trip membership is NOT a mutual-discovery candidate by itself. A profile is matched for feed-visibility purposes via FEAT-014 (mutual-upload + registered) regardless of trip context.

## Behaviour

The rules, encoded:

1. **Trip membership ≠ mutual match.** A profile being on the same trip does not create a mutual-discovery match. Two profiles on the same trip see each other in the roster (display name + avatar) but their cards do NOT auto-appear in each other's feeds. They have to mutually upload + be registered to match.
2. **Trip-shared contacts ≠ master-list exposure.** When leader X shares a contact via FEAT-028, only `display_name` + `phone_hash` are exposed to other trip members. The raw contact (phone number, original CSV row, upload timestamp, the rest of X's master list) stays X-only.
3. **Sub-profile roster on a trip ≠ another troop's full sub-profile list.** Only profiles with `trip_profile_visibility.visible=true` are enumerated. The leader of another troop may have 5 sub-profiles in real life, but trip members only see the visible ones (could be 0, could be 5).
4. **Billing / settings boundary.** Nothing in any trip surface ever exposes billing details, payment methods, or troop-level settings of another troop. The trip's data model (trips, trip_troops, trip_co_leaders, trip_shared_contacts, trip_profile_visibility) carries no billing-relevant fields.
5. **Card visibility on a trip.** A profile's cards remain governed by their normal feed-visibility rules: direct contact (mutual match) → visible in feed; FoF (one-hop grant) → visible in feed; ads / system → public; otherwise → not visible. The trip context does not relax these.
6. **Block boundary.** A profile P who has blocked profile X retains the block within trip contexts. P does not see X's cards in feed, does not see X enumerated in trip rosters where X is also a member of P's trip. Block is per-profile, takes precedence over trip-roster visibility. *(Open question 2.)*

## Data

This feature is a constraint *on* every trip-related read. The relevant reads (and what they return at the cross-troop boundary):

- `trip_troops` joined to `trips`: trip membership + status. Cross-troop readable.
- `trip_co_leaders`: cross-troop readable (every member sees who the trip co-leaders are).
- `trip_shared_contacts`: cross-troop readable, but only the limited columns of `contacts` (display_name + phone_hash).
- `trip_profile_visibility`: NOT cross-troop readable. Only the affected sub-profile and that sub-profile's troop's leader can read it. Other troops see only the *result* (the visible roster).
- `profile_feature_gates`: NOT cross-troop readable. Each troop's gate matrix stays inside the troop.
- `contacts`, `troop_shared_contacts`: NOT cross-troop readable (FEAT-018 RLS).
- `troops` (billing fields): NOT cross-troop readable.

Writes (cross-troop):

- Only the explicit "Share with this trip" toggle (FEAT-028) writes a row that crosses troop boundaries.

## Edge cases

- **Trip member tries to enumerate another troop's roster outside the trip context** (e.g., direct API call to `profiles?troop_id=other_troop_id`): server rejects via RLS — `profiles` is troop-private outside trip-membership join.
- **Trip member tries to read another troop's `troop_shared_contacts`**: server rejects — `troop_shared_contacts` is troop-internal regardless of any trip overlap.
- **Trip ends while a member has another troop's data cached locally**: cached data is not invalidated automatically (no security mechanism to force-clear other clients' caches), but new reads against the API return only what RLS allows. *(Open question 3.)*
- **Trip co-leader (from troop 2) tries to read troop 1's gate matrix on the basis of co-leadership**: rejected. Trip co-leadership grants trip-level privileges only, never cross-troop access.
- **Mutual match between two profiles on the same trip**: works exactly as it does outside the trip context (FEAT-014). Trip context is irrelevant to the match calculation.
- **Forwarded card from one trip member to another**: works subject to FEAT-031 (forwarding gate strictness). The card carries forward border + sender's username pin (FEAT-039).
- **Sub-profile invisibility leakage.** If leader of troop 2 sets B2 invisible on a trip, can other trip members deduce B2 exists from any side channel? Default: no — invisible is invisible across the API. *(Open question 1.)*

## Out of scope

- **Trip-only visibility relaxations** ("for the duration of this trip, treat all members as direct contacts"). Not v1; would erode the privacy boundary.
- **Trip-level chat / DM** that bypasses the per-profile mutual-discovery requirement. Tied to FEAT-063 (deferred).
- **Cross-troop feed filter** ("show me cards from trip members"). Tied to FEAT-033 (trip-filtered feed view, deferred).
- **Read-receipts on trip-shared contacts** ("see who has viewed each contact"). Privacy-sensitive; not v1.

## Open questions

1. **Invisibility leakage prevention.** Default: no side channels (the API never returns counts of invisible profiles). Revisit if a UX need arises (e.g., "Troop 2 has 4 visible members, but more might exist" — currently we say nothing). *(privacy, design)*
2. **Block + roster interaction.** Default: blocked profile is hidden from blocker's roster view of the trip (consistent with feed-block behaviour). Could be debated — does suppressing an attendee from the roster create a confusing "where did Alex go?" moment? Default favours strict per-profile block visibility. *(privacy, product)*
3. **Cross-platform cache invalidation on trip-end / member-leave.** Best-effort via Realtime; not a security guarantee. Document as such. *(security, ops)*
4. **API audit log for cross-troop reads.** Should we ops-log every cross-troop read (e.g., "profile P from troop 1 read trip 5's shared contacts")? Default: yes for security investigations; not user-facing. *(ops, security)*

## Cross-platform notes

No platform divergence — this is a server-side / data-model invariant.

## Verification

Trip-specific:

- **Step 23**: "Confirm B1 is not enumerated to other trip members." (Per-trip visibility boundary.)

Automated tests:

- "Unit tests for the trip-shared-contacts visibility rule (visible only to trip members across joined troops; invisible to sub-profiles whose leader has set `trip_profile_visibility = false`)."

Proposed additions:

- Cross-troop read denial test: profile from troop 1 attempts direct API read of troop 2's `profile_feature_gates` → server rejects.
- Roster-visibility test: troop 2 has B2 set invisible; troop 1 members fetch the trip roster; B2 is not in the response, and no count or marker hints at their existence.
- Cross-troop feed test: profiles A and B are on the same trip but not mutual matches; B's cards do NOT appear in A's feed.
- Block-on-roster test: A blocks X; X is on the same trip as A; A's roster view of the trip omits X.
- Trip-end cache test: after trip ends, server-side reads return read-only archived state; client-cached state is stale-but-not-newly-fetched.
