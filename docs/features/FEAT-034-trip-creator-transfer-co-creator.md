---
id: FEAT-034
area: Trips
release: v2
status: Deferred
dependencies: [FEAT-022, FEAT-025, FEAT-026]
last_reviewed: 2026-05-01
---

# FEAT-034: Trip creator transfer / co-creator

## Summary

v1 hard-codes a single non-transferable trip creator (FEAT-025): if their troop leaves the trip or is deleted, the trip ends (FEAT-022). v2 may introduce two follow-on capabilities:

1. **Trip creator transfer** — the creator hands the creator role to a co-leader before leaving / deleting their troop, allowing the trip to continue.
2. **Trip co-creator** — a status that sits between trip creator and trip co-leader, with elevated privileges (e.g., can promote/demote OTHER co-leaders, can transfer creator status). Multiple co-creators permitted, providing redundancy.

Both have material implications for trip-survivability semantics, audit trails, and the broader trip-lifecycle invariants.

## Roles & permissions

(All TBD per the v2 design pass.)

Likely shape:

- **Trip creator** (existing FEAT-025): grants every privilege; can transfer creator status to another joined-troop leader.
- **Trip co-creator** (new): everything a creator can do *except* there can be multiple co-creators concurrently. Demoting the creator (or another co-creator) is permitted; demoting yourself permitted. Quorum or last-one-standing rules apply when down to a single co-creator.
- **Trip co-leader** (existing FEAT-026): unchanged.

## Surfaces

- **Transfer creator flow**: creator navigates to trip detail → "Transfer creator role" → picker of joined-troop leaders (or co-leaders specifically) → confirmation → transfer commits with optional cooldown.
- **Promote co-creator flow**: similar entry point; promotes a co-leader to co-creator status.
- **Creator badge UI**: roster shows "Creator" or "Co-creator" badges. Co-creators are visually distinguished from regular co-leaders.

## Behaviour

(All TBD; sketch only.)

1. **Transfer creator**: creator picks a co-leader → confirmation prompt with cooldown ("This will transfer trip creator role to [Name] in 24 hours. You can cancel before then."). On commit, `trips.created_by_profile_id` updates; original creator becomes a normal co-leader (or steps off). Audit log captures who transferred to whom.
2. **Promote co-creator**: creator (or another co-creator) picks a co-leader → confirmation → server inserts a row into `trip_creators` (new table; multi-row allowed) with role='co_creator'.
3. **Auto-promote on creator-troop-deletion** (replacing FEAT-022's auto-end behaviour for trips with co-creators): if the creator's troop deletes itself or leaves the trip, and at least one co-creator exists, the longest-tenured co-creator auto-promotes to creator. Trip survives. *(Open question 1.)*
4. **Demoting a co-creator**: another creator/co-creator initiates → confirmation → server removes the row.
5. **Last-one-standing**: if all but one co-creator demote themselves, the remaining one is automatically the singular creator (writes to `trips.created_by_profile_id` and removes their `trip_creators` row).

## Data

(Conceptual.)

- New table: `trip_creators (trip_id, profile_id, role: 'creator' | 'co_creator', joined_at, removed_at NULL)`. Replaces or augments `trips.created_by_profile_id`.
- Audit table: `trip_creator_transfers (id, trip_id, from_profile_id, to_profile_id, initiated_at, committed_at, cancelled_at)`.

## Edge cases

(All TBD.)

- Transfer initiated; original creator's troop is then deleted before commit. Default: transfer auto-completes immediately upon detection.
- Two simultaneous transfer attempts (creator + a co-creator both initiate). Default: first one wins; second sees an error.
- All co-creators demote themselves at once. Default: last write becomes the singular creator (whoever was last on the demote list).
- Co-creator from a troop that gets deleted: their row auto-cleans; if they were the trip's only remaining creator-class member, the trip ends.

## Out of scope (this feature)

- All of v1. v1 has neither transfer nor co-creator.
- Cross-trip co-creator status (a profile being co-creator on multiple trips automatically). Not specified; would emerge naturally from per-trip rows.
- Time-limited co-creator status. Not v2.

## Open questions

1. **Auto-promote on creator-troop-leave/deletion.** Default: yes if any co-creator exists; trip survives. Else: trip ends (current FEAT-022 behaviour). *(product)*
2. **Cooldown on transfer.** 24 h vs. immediate vs. configurable. Default: 24 h with cancellable window. *(product, security)*
3. **Maximum co-creators.** No cap vs. small number (3-5). Default: small cap (5) to prevent governance chaos. *(product)*
4. **Co-creator visibility to non-co-creator members.** Default: yes (transparency wins). *(design)*
5. **Whether transfer must go to a *current* trip co-leader, or to any joined-troop leader.** Default: any joined-troop leader (broader pool); the new creator may not have been a co-leader prior. *(product)*
6. **Sequencing relative to FEAT-011 (troop co-leadership / ownership transfer).** v2-troop ownership transfer (FEAT-011) is a separate axis; trip-level transfer (FEAT-034) is independent. They're conceptually similar but operate on different entities. *(product)*

## Cross-platform notes

To be defined.

## Verification

To be defined. Skeleton:

- Transfer creator → role moves; original creator becomes co-leader; audit log captures.
- Promote co-creator → multiple co-creators visible; each can take creator-equivalent actions.
- Auto-promote on creator-troop-deletion: creator's troop is deleted; longest-tenured co-creator becomes creator; trip survives.
- All-co-creators-demote: last one standing is the singular creator; trip survives.
