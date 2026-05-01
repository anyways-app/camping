---
id: FEAT-002
area: Identity & Accounts
release: v1
status: Spec'd
dependencies: [FEAT-001]
last_reviewed: 2026-05-01
---

# FEAT-002: Single troop leader

## Summary

Each troop has exactly **one** leader profile in v1 — a singleton role, not a set. The leader is the adult human who owns the troop, holds billing, owns security (password reset, MFA, PIN reset), and exercises every master-level control: creating/deleting sub-profiles, setting per-sub-profile feature gates, sharing contacts down to the troop, joining trips, promoting trip co-leaders. Co-leadership and ownership transfer to another adult identity are explicitly deferred (FEAT-011).

## Roles & permissions

- **Troop leader.** Sole writer of troop-level controls and master contact list. Can do everything any sub-profile can do, plus all leader-only actions.
- **Sub-profiles.** Cannot modify the leader role. Cannot view the leader's master contact list except via the leader-shared segment (FEAT-017).

The leader role is implicit in the data model: the profile referenced by `troops.leader_profile_id` is the leader. There is no "is_leader" flag on profiles; the FK on `troops` is the source of truth.

## Surfaces

- **Profile picker** (FEAT-004): the leader's avatar is visually distinguished (badge, ribbon, or accent border) so it's obvious which profile holds master controls.
- **Troop settings screen**: leader-only, never visible to sub-profiles.
- **Per-sub-profile management screen** (FEAT-009): leader-only.

## Behaviour

1. Troop creation (FEAT-001) creates exactly one profile and sets `troops.leader_profile_id` to that profile's id. The leader role is established at this moment and is immutable in v1.
2. Sub-profile creation (FEAT-003) creates additional profiles with `troop_id` set but does NOT change `troops.leader_profile_id`. The new profile is not a leader.
3. Sub-profile deletion: leader-only action. Cascade-deletes the sub-profile's owned cards, own contacts, and trip visibility rows.
4. Leader profile deletion: **not permitted** in v1. The only way to remove the leader's profile is to delete the entire troop (FEAT-001).
5. Leader credential rotation: leader can reset the troop PIN (FEAT-005) via the verified phone / Apple / Google identity. Cannot transfer the leader role to a different identity. *(Transfer is FEAT-011, deferred.)*

## Data

Reads:
- `troops` (to look up `leader_profile_id`).
- `profiles` (the leader's row).

Writes:
- None directly. The leader role is established at troop creation (FEAT-001) and is immutable in v1.

## Edge cases

- **Leader loses access to their phone / Apple / Google identity.** Account recovery falls back to the alternate identity if linked. If no alternates: support-mediated recovery via documentation of identity (driver's license check, etc.). *(Open question 2.)*
- **Leader is deceased / incapacitated.** No in-app path to claim a deceased leader's troop in v1. Support-mediated. Flag for legal review of jurisdictional inheritance rules. *(Open question 3.)*
- **Attempt to delete the leader profile.** Server rejects with a clear error: "The troop leader cannot be removed. Delete the troop instead, or transfer ownership in a future version."
- **Race: leader creates a sub-profile and deletes troop simultaneously from two devices.** Last-write-wins on the troop row; if the troop is deleted, the orphan sub-profile insert is rolled back via FK constraint.

## Out of scope

- **Co-leadership** (multiple leaders sharing privileges): deferred to v2 (FEAT-011).
- **Leader-role transfer** to another adult identity: deferred to v2 (FEAT-011).
- **Promote-sub-profile-to-leader** (in-troop promotion): deferred to v2 (FEAT-011).
- **Emergency-contact succession** (named recovery contact): deferred; tied to the broader account-recovery design pass.

## Open questions

1. **Leader's profile display indicator.** What's the visual badge on the leader avatar in the profile picker? Default: a small "★" or "👑" overlay; design-led decision. *(design)*
2. **Account recovery without alternate identity.** Default: support-mediated, requires identity verification. Should we mandate at least one alternate identity (e.g., require phone + email at signup) to make recovery self-serve? *(product, ops)*
3. **Deceased / incapacitated leader.** Default v1: support-mediated only. Document the policy publicly. Legal-team review of jurisdictional rules. *(legal)*
4. **Leader-only feature surfacing.** When a sub-profile attempts an action that requires leader privileges (e.g., they navigate to a deep-link that lands on troop settings), what do they see? Default: a clear "Only your troop leader can do this" empty state with the leader's display name. *(design)*

## Cross-platform notes

No divergence. Identity / role logic is server-side; clients are read-mostly with respect to the leader designation.

## Verification

Cross-platform:

- **Step 1** of cross-platform verification implies a single-leader troop: "Sign up two **troops** with different phone numbers (each starts with a single leader profile A and B respectively)."

Troop-specific:

- **Step 12**: "Confirm the leader profile always requires its PIN regardless of any toggle."
- **Step 18**: "Switch from B1 back to the leader profile via the 'Switch profile' entry; confirm the leader's PIN is required and the active session token re-scopes to the leader profile."

Proposed additions:

- Attempt to delete the leader profile via API → server rejects with a stable error code; UI surfaces a friendly message.
- Sub-profile attempts a leader-only action → server rejects with a stable error code; UI shows the "Only your troop leader can do this" state.
