---
id: FEAT-013
area: Social Graph & Privacy
release: v1
status: Spec'd
dependencies: [FEAT-001, FEAT-003]
last_reviewed: 2026-05-01
---

# FEAT-013: Per-profile social graph

## Summary

Camp King's social graph is **per-profile, not per-troop**. Each profile owns its own contact list, mutual-discovery state, one-hop grants, blocks, and feed. Profiles in the same troop do NOT share a social graph by default — even though they share a troop identity, billing, and a leader. The only shared social surfaces are the leader-managed troop-shared contacts segment (FEAT-017) and trip-shared contacts (FEAT-027). This is the load-bearing privacy architecture decision: a sub-profile's social life is theirs, not their troop's.

## Roles & permissions

- **Each profile (leader or sub-profile)**: owns and is the sole authoritative writer of their own contacts, matches, grants, and blocks.
- **Troop leader**: cannot view a sub-profile's contact list, matches, or blocks. Can share contacts *down* (FEAT-017) but cannot read *up* into a sub-profile's graph.
- **Sub-profiles**: cannot view each other's social graph. The fact that two sub-profiles are sibling profiles in the same troop is not visible across their social-product surfaces.

## Surfaces

This is a foundational invariant rather than a screen. It manifests across:

- Each profile's **contact list** screen — disjoint per profile (FEAT-016 per-profile imports + FEAT-017 leader-shared overlay).
- Each profile's **feed** — composed from cards by people in *that profile's* social graph.
- Each profile's **forward picker** (FEAT-061) — recipients drawn from *that profile's* matches, plus in-troop sibling profiles, plus trip members.
- **Border kind derivation** (FEAT-064) — direct-contact / FoF status is computed against the *viewing profile's* graph, not the troop's collective graph.

## Behaviour

1. Sub-profile A imports a contact list (FEAT-016). The contacts live in `contacts` rows keyed to A's `profile_id`. They are not visible to any other profile in the troop except via FEAT-017's explicit leader-share — which doesn't apply here because the upload was by A, not the leader.
2. Sub-profile B in the same troop independently imports their own contacts. B's `contacts` rows are disjoint from A's even if they refer to the same external person.
3. Mutual-discovery (FEAT-014) runs per profile: A's matches are computed from A's contacts ∩ external profiles whose contact lists contain A. B's matches are an independent computation against B's own contacts.
4. The leader's contacts are similarly private to the leader's profile, with the FEAT-017 toggle being the only mechanism by which any of them become visible to sub-profiles.
5. Per-profile blocks: if A blocks an external profile X, X's cards are hidden from A's feed only. B's feed is unaffected.
6. Per-profile one-hop grants (FEAT-015): A grants X visibility into A's connection list. The grant is keyed to (A's profile, X's profile) — it does not extend to B granting X anything.

## Data

This feature is the *invariant* that all the social-graph tables uphold. The relevant tables and their key shapes:

- `contacts (id, uploader_profile_id, contact_phone, contact_display_name, ...)` — uploader_profile_id keys the row to the *individual profile*, not the troop.
- `contact_matches (profile_a_id, profile_b_id, matched_at)` — both keys are profile-ids; mutual matches between two specific profiles.
- `one_hop_grants (grantor_profile_id, grantee_profile_id, granted_at)` — profile-pair-keyed.
- `profile_blocks (blocker_profile_id, blocked_profile_id, blocked_at)` — per-profile blocks.

RLS enforces per-profile reads on all of the above (with the FEAT-017 / FEAT-028 exceptions for shared contacts).

## Edge cases

- **Same external person uploaded by multiple profiles in a troop.** Each profile holds their own row; no merging. Matches are computed independently. UI shows the contact in each profile's "My contacts" segment.
- **Contact deletion in one profile.** Affects only that profile's row. Sibling profiles' rows for the same external person are unaffected.
- **Block decision divergence.** Sub-profile A blocks X; sub-profile B does not. B continues to see X's cards. A doesn't. Both states are valid simultaneously.
- **One-hop grant by one profile, requested by another.** If sub-profile A has granted one-hop visibility to friend X, but sub-profile B has *not*, X sees A's friend list but not B's. The grant doesn't transfer or imply anything cross-profile in the same troop.

## Out of scope

- **Troop-wide blocks.** A leader cannot block someone "for the whole troop." Blocks are per-profile by design. *(Open question 1.)*
- **Roll-up views** (the leader sees an aggregate view of "what cards is the troop seeing today"). Not v1 — privacy-sensitive.
- **Contact merge UI** ("the same external person appears in 3 sub-profiles' lists; consolidate?"). Not v1; would violate the per-profile-graph invariant.
- **Cross-profile mutual-discovery shortcuts** (e.g., "if any sub-profile in this troop has matched X, suggest X to the others"). Not v1; would violate the invariant.

## Open questions

1. **Troop-wide block.** Should the leader have a power tool to block an external profile across all sub-profiles at once (effective: applies the block to every sub-profile in the troop, individually)? Default: no in v1 — keeps blocks strictly per-profile. Could be a v2 leader power tool. *(product)*
2. **Visibility into per-profile activity for safety reasons.** Should the leader be able to see, e.g., "sub-profile B has reported 3 cards this week"? Default: no in v1. Aggregate, anonymised safety metrics could be v2. *(product, legal)*
3. **Suggesting contacts to a new sub-profile.** When a leader creates a new sub-profile, should the new profile be pre-suggested contacts based on troop-shared contacts? Default: yes, that's exactly what FEAT-017's "Shared by Leader" segment does. No additional auto-suggestion needed.
4. **Mutual-discovery deduplication across troop.** Should there be any backend optimisation to compute matches once per *external person* and reuse the result across sub-profiles' independent searches? Default: server-side optimisation only; does not change the per-profile visibility model. *(backend)*

## Cross-platform notes

No platform divergence — this is a server-side / data-model invariant. All clients honour it via RLS.

## Verification

Cross-platform:

- **Step 2** of cross-platform verification: "Upload a contact CSV on profile A containing profile B's phone, and vice versa. Both profiles see each other connected." (Implies per-profile graph; the matches are profile-pair-keyed.)
- **Step 3**: "Profile A toggles 'expose my contacts' for B." (Per-profile one-hop grant.)

Automated tests:

- "Unit tests for the contact-matching algorithm (mutual-only + one-hop registered-only invariants, profile-pair-keyed)."
- "Unit tests for the troop-shared-contacts visibility rule ... one-hop grants do not transfer across siblings."

Proposed additions:

- Sub-profile-isolation test: sub-profile A imports a contact; switch to sub-profile B; B does not see the contact in their own list.
- Cross-profile block-isolation test: A blocks X; B's feed continues to show X's cards.
- Cross-profile match-isolation test: A is matched with X; B is not; X's cards appear with the direct-contact border in A's feed but not in B's.
