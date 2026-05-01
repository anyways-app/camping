---
id: FEAT-025
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-002, FEAT-020, FEAT-022, FEAT-026]
last_reviewed: 2026-05-01
---

# FEAT-025: Trip creator role

## Summary

The **trip creator** is the troop leader who created the trip via FEAT-020. There is always exactly one creator per trip. The creator has full authority over trip settings, invites, lifecycle, and co-leader promotion. Creator status is **non-transferable in v1** — if the creator's troop leaves the trip or is deleted, the trip ends (FEAT-022). Trip creator transfer / co-creator semantics are deferred to FEAT-034.

## Roles & permissions

- **Trip creator**: every trip-level write — invite (FEAT-023), edit metadata (FEAT-021), promote/demote co-leaders (FEAT-026), share contacts (FEAT-028), end trip (FEAT-022), kick troops (open question 2).
- **Trip co-leader** (FEAT-026): same as creator EXCEPT cannot demote the creator, cannot kick the creator's troop, cannot transfer creator status (which is deferred entirely).
- **Other trip members**: read-only on trip-level state.

## Surfaces

- The creator distinction is data-model-level (`trips.created_by_profile_id`). UI surfacing:
  - **Trip detail member roster**: the creator's row gets a small "Creator" badge.
  - **Co-leader management screen**: creator row is read-only — cannot be removed.
  - **Lifecycle actions** ("End this trip", "Edit metadata", "Promote co-leader") are visible to the creator and to anyone in `trip_co_leaders`. The UI does not distinguish at the action level.

## Behaviour

1. Creator status is established at trip creation (FEAT-020 step 3): `trips.created_by_profile_id = leader.profile_id` and `trips.created_by_troop_id = leader.troop_id`.
2. Creator status is **immutable in v1** — no in-app action changes it.
3. **Creator's troop leaves the trip** (FEAT-024 leave flow): server checks if the leaving troop is the creator's troop. If so, transition the trip to `status='ended'` immediately (FEAT-022 step 5). All other troops remain in the read-only archive.
4. **Creator's troop is deleted** (FEAT-001 deletion): same auto-end transition.
5. **Creator-only actions** that even co-leaders can't take in v1:
   - Promote / demote co-leaders (FEAT-026 step 4).
   - Cannot be done by anyone else, period.

## Data

Reads:
- `trips.created_by_profile_id` and `trips.created_by_troop_id` (immutable).

Writes:
- Set once at trip creation (FEAT-020). Never updated in v1.

Schema reference: see `00-core.md#trips → Schema sketch`.

## Edge cases

- **Creator's profile is deleted** (sub-profile or — hypothetically — leader profile). Sub-profile being the creator is impossible in v1 because only leaders can create. Leader deletion is impossible without troop deletion (FEAT-002), which auto-ends the trip.
- **Creator's display name changes**: creator badge in the member roster reflects the current display name.
- **Creator transfers ownership of their troop** (FEAT-011, deferred): creator status still references `created_by_profile_id`, which is the *profile* that created the trip. If that profile is migrated under v2 transfer mechanics, the trip's creator follows. *(Open question 1.)*
- **Creator demoted by a co-leader via API misuse**: server-side check prevents this; co-leader writes to `trip_co_leaders` cannot affect the creator row.

## Out of scope

- **Trip creator transfer**: FEAT-034 (deferred).
- **Multiple creators / co-creators**: FEAT-034 (deferred).
- **Creator-only privileges differing from co-leaders** beyond what's specified above. v1 keeps the gap minimal — co-leaders are nearly creator-equivalent, with creator-specific privileges limited to: promote/demote co-leaders, and the immutable creator badge. Most actions are delegable to co-leaders.

## Open questions

1. **Creator-status preservation across v2 troop ownership transfer.** When FEAT-011 ships, what happens to trips created by a profile that's been migrated to a new leader's identity? Default: trip creator follows the original profile_id; if the original profile is deleted as part of the transfer, the trip's creator-troop reference points to a no-longer-existing profile, and the auto-end rule kicks in. Likely revisited as part of FEAT-034 design. *(product)*
2. **Kick a troop from a trip.** Should the creator (or any co-leader) be able to remove another troop from an active trip? Default: no in v1 — troops can leave themselves; involuntary removal is a v2 design. *(product, design)*
3. **Visual creator badge.** Crown / star / ribbon. Default: simple "Creator" text label in the roster — minimal visual noise. *(design)*

## Cross-platform notes

No platform divergence at the role level.

## Verification

Trip-specific:

- **Step 19**: "Leader A creates a trip 'Wind River 2026'..." (Implies A is the creator.)
- **Step 24**: "Leader A promotes Leader B to trip co-leader. ... Confirm B cannot demote Leader A." (Creator-status immutability.)
- **Step 26**: "Leader A marks the trip `ended`." (Creator can end.)

Proposed additions:

- Creator-leaves-troop test: creator leaves the trip → trip auto-ends.
- Creator-demote-attempt test: co-leader attempts to demote the creator via API → server rejects.
- Creator-troop-deletion test: delete the creator's troop → trip auto-ends.
