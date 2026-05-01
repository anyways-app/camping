---
id: FEAT-003
area: Identity & Accounts
release: v1
status: Spec'd
dependencies: [FEAT-001, FEAT-002, FEAT-007]
last_reviewed: 2026-05-01
---

# FEAT-003: Sub-profiles under a troop

## Summary

A troop can hold up to **6 sub-profiles** in addition to the troop leader, for a maximum of 7 profiles total per troop. Sub-profiles are how non-leader people in the troop's household / association use Camp King — each gets their own social graph, contact list, feed, and posts under the troop's billing umbrella. The leader chooses who gets a sub-profile and configures their feature gates (FEAT-007). The platform does NOT classify any sub-profile as a "kids profile"; the leader handing a sub-profile to an under-13 is the leader's responsibility per the ToS attestation (FEAT-008).

## Roles & permissions

- **Troop leader**: sole writer for sub-profile creation, deletion, naming, avatar, PIN-protected toggle, feature-gate configuration (FEAT-007). Cannot transfer a sub-profile to another troop.
- **Sub-profile**: read-only on its own metadata (display name, avatar, gates) — they can request changes via in-app feedback but cannot self-edit. Has full read/write on their own social-product surface (cards, contacts, feed) subject to feature gates.

## Surfaces

- **Per-sub-profile management screen** (FEAT-009), accessible only to the leader from troop settings: list of all sub-profiles, "Create new sub-profile" CTA, per-row drilldown into name / avatar / PIN / feature-gate matrix.
- **Profile picker** (FEAT-004) on launch: shows leader avatar + all sub-profile avatars. Sub-profiles below the leader's slot, sorted by creation order or pinned by the leader.
- **Sub-profile create flow**: name, avatar (generated chip default; optional upload), initial feature-gate state (defaults from spec table; leader can flip any toggle before save).

## Behaviour

1. Leader navigates to troop settings → "Manage profiles" → "Create new sub-profile."
2. Form: display name (required), avatar (optional upload; generated chip otherwise), initial PIN-protected toggle (default off), feature-gate matrix preview (defaults from FEAT-007 spec table).
3. On save: server validates count (`SELECT COUNT(*) FROM profiles WHERE troop_id = ?` must be ≤ 6 sub-profiles, i.e. ≤ 7 total). If at cap, return "You've reached the maximum of 6 sub-profiles" error; offer link to v2-deferred larger-troops tier (FEAT-012) when that exists.
4. Insert `profiles (id, troop_id, display_name, avatar_url, role='sub_profile', pin_hash NULL, protected=false, created_at)`. Insert default `profile_feature_gates` rows.
5. New sub-profile appears in the picker on next launch (or live via Realtime if the leader's app is observing).
6. Sub-profile deletion (leader-only): confirmation dialog warns "This will permanently delete [Name]'s contacts, posts, and feed history. This cannot be undone." On confirm, cascade-delete owned data; the sub-profile vanishes from the picker.
7. Sub-profile rename / re-avatar: editable from the per-sub-profile management screen by the leader. Sub-profile sees the change on next refresh.
8. Sub-profile PIN-protect toggle: see FEAT-006.

## Data

Reads:
- `profiles` (count for cap enforcement; list for the management screen).

Writes:
- `profiles` (insert / update / delete on sub-profile lifecycle).
- `profile_feature_gates` (insert defaults; update on gate flip; cascade-delete with profile).
- Cascade deletes owned `cards`, `contacts`, `contact_matches`, `one_hop_grants`, `trip_profile_visibility` rows.

## Edge cases

- **Leader hits the 6-cap and tries to create another.** Server rejects with the error above. UI prevents the user from getting to the form, hiding "Create new sub-profile" CTA when at cap and showing a count badge ("6 / 6").
- **Sub-profile name collision within a troop.** Default: allowed but discouraged with a soft warning "There's already a profile named 'Alex' in your troop. They'll be hard to tell apart in the picker." *(Open question 2.)*
- **Sub-profile name collision across troops.** No restriction. Display names are not unique platform-wide; the (troop, profile) pair is the canonical identity.
- **Sub-profile deleted while they had cards in flight.** Cascade-delete removes their cards from all viewers' feeds within one refresh. Forwards by other profiles of those cards remain (the new copies have their own `author_id` referencing the forwarder, not the deleted sub-profile).
- **Leader deletes a sub-profile mid-trip.** The sub-profile is removed from `trip_troops` membership for that trip, and from any `trip_profile_visibility` overrides. Trip metadata is unaffected.
- **Leader deletes a sub-profile during an active session on that profile (other device).** The other device's session token becomes invalid on next request; user is bounced to the profile picker with a "This profile has been removed" toast.

## Out of scope

- **More than 6 sub-profiles per troop.** Deferred to v2 tiered offering (FEAT-012).
- **Moving a sub-profile between troops.** Not planned. Deletion + recreation in the destination troop is the intended path.
- **Sub-profile-to-sub-profile DMs / chats.** Tied to FEAT-063 (deferred).
- **Sub-profile self-edit of own display name / avatar.** v1: leader-only edits to keep the leader-control invariant clean. Could be opened up in v2 with leader-approval flow.

## Open questions

1. **Hidden sub-profiles** (a "Guest" or "Spouse" profile that doesn't show on the picker by default; revealed via a long-press on the troop avatar). Default: not in v1 — picker shows all sub-profiles. *(product)*
2. **Same-name handling.** Soft warning vs. hard rejection vs. silent allowance. Default: soft warning (least friction, most flexibility). *(design)*
3. **Sub-profile creation rate limit.** Should the leader be rate-limited on rapid sub-profile creation/deletion churn? Default: no in v1; the 6-cap acts as a natural ceiling. *(ops)*
4. **Avatar upload size / format constraints.** Default: ≤ 2 MB, JPEG/PNG/WebP, server-side resize to 256×256 on upload. Match platform conventions. *(design, ops)*
5. **Sub-profile "About" / bio text.** Default: not in v1; just display name + avatar. *(product)*

## Cross-platform notes

No structural divergence. The per-sub-profile management screen UX may differ visually:

- **Web**: form-style screen with toggles in a matrix layout.
- **iOS / Android**: stacked sheet-style screens, one toggle per row, mobile-native pickers for avatar upload.

## Verification

Troop-specific:

- **Step 11**: "From the leader profile of troop 1, create a sub-profile B1. B1 appears on the profile picker on next app launch."

Proposed additions:

- Cap-enforcement test: create 6 sub-profiles successfully, attempt 7th → rejected with the cap-error.
- Cascade-delete test: delete a sub-profile that has 5 posted cards and 20 contacts → all owned data is removed within one refresh in every viewer's feed.
- Mid-session deletion test: sub-profile is signed-in on device A; leader deletes it from device B; device A's next request bounces to the profile picker.
