---
id: FEAT-001
area: Identity & Accounts
release: v1
status: Spec'd
dependencies: []
last_reviewed: 2026-05-01
---

# FEAT-001: Troops as account container

## Summary

A Camp King account is a **troop** — a grouping of associated people represented by the profiles set up under it. The troop holds billing, security identity, and master-level controls; profiles do the actual social-product work (post cards, hold contacts, receive cards in their feed). This is the Netflix-shape household: one account, multiple profiles, profile picker on launch. The troop is the unit billing and auth attach to; everything user-facing happens at the profile level.

## Roles & permissions

- **Troop leader** (FEAT-002): owns the troop. Sole writer of troop-level metadata (name, billing, payment method, sub-profile creation/deletion).
- **Sub-profiles** (FEAT-003): live under the troop but cannot modify troop-level state. They see the troop name and the troop avatar but not billing or security info.
- **Camp King support / system**: read-only for support tickets; no general write access.

## Surfaces

- **Troop creation flow** (one-time, at signup). Phone OTP / Apple / Google → choose troop name + avatar → create leader profile → land in the leader profile.
- **Troop settings screen** (leader-only). Edit name + avatar; manage billing; view audit log of structural changes (sub-profile created / deleted, leader PIN reset).
- **Profile picker** (FEAT-004) shows the troop name + avatar at the top of the picker so a user knows which troop they're entering.

## Behaviour

1. New user signs up via phone OTP / Apple / Google. Single auth identity is created at the troop level (FEAT-074).
2. The signup flow asks: **troop name** (default: the user's phone-verified display name + "'s troop") and **troop avatar** (optional; defaults to a generated chip).
3. Server: insert `troops (id, name, avatar_url, billing_identity_id, leader_profile_id, created_at)`. Insert the leader profile row (FEAT-002) with `troop_id` set. Set `troops.leader_profile_id` to the leader's id.
4. Server: insert default `profile_feature_gates` rows for the leader (everything On — leader has no gates) and the spec defaults for any sub-profile created later (FEAT-007).
5. The user lands in the leader profile, sees the feed, and can begin inviting other troops, posting, etc.
6. Troop deletion (account closure): leader-only action from troop settings. Cascade-deletes all profiles, contacts, troop-shared contacts, owned cards. Trips the troop created end immediately; trips the troop participated in have the troop removed but otherwise persist for the remaining troops. Hard delete; no soft-delete tombstone in v1. *(Open question 2.)*

## Data

Reads:
- `troops`, `profiles` (own troop only).

Writes:
- `troops` (insert at signup; update on settings change; delete on account closure).
- Cascade deletes: `profiles`, `contacts`, `troop_shared_contacts`, `cards` (owned), `profile_feature_gates`, `trip_*` rows where appropriate.

Schema fields: `id`, `name`, `avatar_url`, `billing_identity_id` (Stripe customer ID or equivalent), `leader_profile_id` (FK to `profiles.id`), `created_at`.

## Edge cases

- **Phone number reused.** A new troop creation attempt with a phone number already attached to an existing troop is rejected at the auth layer; the user is offered to sign in to the existing troop instead.
- **OAuth identity linked to multiple troops.** Default v1: one OAuth identity → one troop. If a user wants a second troop, they must sign up with a different identity. *(Open question 1.)*
- **Troop deletion while a trip is active.** Trip ends if the deleting troop was the trip creator (FEAT-025); otherwise the troop is removed from `trip_troops` and its sub-profiles cease to be trip members.
- **Network down during signup.** Signup is atomic on the server; client retries with backoff. If the troop row is inserted but the leader profile isn't, server cleanup job removes the orphan troop within 24 h. UI shows a generic "Try again" toast on failure.
- **Empty troop.** A troop must always have at least one profile (the leader). The leader cannot be deleted while the troop exists; troop deletion is the only path out.

## Out of scope

- **Co-leadership / multi-leader troops.** Deferred to v2 (FEAT-011). Exactly one leader per troop in v1.
- **Ownership transfer between adult identities.** Deferred to v2 (FEAT-011).
- **Linking multiple billing identities to one troop.** v1: one billing identity per troop.
- **Federated / parent-of-troops structures** (e.g. a scout-troop council that contains many family troops). Deferred to v2 (FEAT-012).
- **Account migration between Apple / Google / phone identities.** Deferred to v2.

## Open questions

1. **One OAuth identity → one troop?** Default: yes. Alternative: an Apple ID could be attached to multiple troops with a troop-picker shown after auth. Adds significant complexity; defer unless real demand. *(product)*
2. **Hard-delete vs. soft-delete on account closure.** Default: hard delete. GDPR-defensible posture; aligns with "right to erasure." If business needs an undo window (e.g., 30-day grace for billing reversals), revisit. *(legal, product)*
3. **Troop avatar source.** Generated chip, leader's profile avatar, custom upload? Default: generated chip with the troop name's first two characters; leader can upload a custom image later. *(design)*
4. **Audit log retention.** How long do we keep the troop's structural audit log (sub-profile created, leader PIN reset, etc.)? Default: indefinitely, for the lifetime of the troop. *(legal, ops)*

## Cross-platform notes

No platform divergence at the troop-container level. Auth identity is shared across platforms via Supabase (FEAT-074, FEAT-075, FEAT-076).

## Verification

Cross-platform:

- **Step 1** of cross-platform verification: "Sign up two **troops** with different phone numbers (each starts with a single leader profile A and B respectively); sign in to both."

Proposed additions:

- Account closure path: leader signs in → troop settings → delete account → confirm → all troop data is removed within one verification cycle.
- Reused-phone-number rejection: attempt signup with a phone number already tied to an existing troop → rejected with offer to sign in instead.
