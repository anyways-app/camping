---
id: FEAT-026
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-002, FEAT-024, FEAT-025]
last_reviewed: 2026-05-01
---

# FEAT-026: Trip co-leader promotion

## Summary

The trip creator (FEAT-025) can promote any **joined troop's leader** to **trip co-leader**. Multiple co-leaders are permitted on a single trip. Co-leaders gain the ability to invite more troops, edit trip metadata, share contacts to the trip, promote further co-leaders (creator-only — see FEAT-025), and end the trip — all the trip-management privileges *except* creator-only ones. Co-leaders cannot demote the creator or affect the creator's troop. Trip-level co-leadership is **scoped strictly to the trip**; it does NOT grant the co-leader any access to another troop's master contact list, billing, or per-sub-profile feature gates. This is distinct from troop co-leadership (deferred to FEAT-011), where the privilege would extend across the troop's whole footprint.

## Roles & permissions

- **Trip creator**: sole writer for promote/demote of co-leaders. Server enforces.
- **Trip co-leader** (existing): can take all trip-level actions except promote/demote others (creator-only) and demote the creator (impossible).
- **Joined troop's leader** (eligible candidate): can be promoted by the creator. Sub-profiles in joined troops are NOT eligible — only the leader.
- **Other trip members**: cannot promote or be promoted.

## Surfaces

- **Trip detail → "Co-leaders"** section (creator-only edit): list of current co-leaders + "Add co-leader" CTA. Adding pulls a picker of joined-troop leaders not yet co-leaders.
- **Member roster** (all members): co-leaders get a "Co-leader" badge alongside their display name. Creator gets the "Creator" badge instead (FEAT-025).

## Behaviour

1. Creator navigates to trip detail → Co-leaders section → "Add co-leader."
2. Picker shows joined-troop leaders not yet promoted. Tap a leader → confirmation: "Promote [Leader display name] to co-leader of this trip? They'll be able to invite, share contacts, edit, and end the trip."
3. On confirm:
   - Server inserts `trip_co_leaders (trip_id, profile_id)`.
   - Realtime broadcast: trip detail and roster update for all members. Promoted leader sees an in-app notification + push notification: "[Creator display name] promoted you to co-leader of [Trip name]."
4. Promoted leader now has full co-leader privileges (every trip-level action except creator-only).
5. **Demote**: creator taps an existing co-leader → "Remove co-leader privilege" → confirmation → server deletes the `trip_co_leaders` row. Realtime broadcast updates the badge across all clients. The demoted leader retains regular trip-member access (their troop remains a member).
6. **Co-leader leaves their own troop's membership** (FEAT-024 leave): their `trip_co_leaders` row is auto-deleted along with the troop's `trip_troops` row. They lose co-leader status when they leave.

## Data

Reads:
- `trip_troops` (eligible candidates: leaders of joined troops not in `trip_co_leaders`).
- `profiles` (display names / avatars).

Writes:
- `trip_co_leaders` (insert on promote; delete on demote or troop-leaves).

## Edge cases

- **Promote a non-leader (sub-profile)**: server rejects with "Only troop leaders can be co-leaders."
- **Promote a leader whose troop hasn't joined the trip**: server rejects — the leader isn't a trip member yet, so they can't be a co-leader.
- **Promote the creator** (already creator): no-op; client UI hides the creator from the candidate picker.
- **Concurrent promotion conflicts**: idempotent — duplicate insert returns success without error.
- **Demote yourself** (a co-leader demotes themselves): allowed; server permits a co-leader to remove their own row. Useful for stepping down. Demoting *another* co-leader is creator-only.
- **Co-leader's troop deletion**: cascade-deletes their `trip_troops` row, which cascades to `trip_co_leaders`. They're cleanly removed.
- **Trip ends while a promotion is in flight**: server rejects the insert with "trip has ended."
- **Creator demotes themselves** (attempts to remove their own creator status via the co-leader screen): impossible — creator is not a co-leader; the screen has no row for the creator.

## Out of scope

- **Promote sub-profile to co-leader.** Not v1. Co-leaders must be leaders of their own troop.
- **Conditional / time-limited co-leadership** ("you're co-leader for 24 h"). Not v1.
- **Co-leader hierarchy** (some co-leaders more equal than others). Not v1.
- **Co-creator** (status that survives the creator's troop leaving). FEAT-034 (deferred).

## Open questions

1. **Maximum co-leaders per trip.** No cap in v1, or a sensible ceiling (e.g., 10)? Default: no cap. Likely fine — usage will self-regulate. *(product)*
2. **Self-demotion notification to the creator.** When a co-leader steps down, does the creator get a push notification? Default: in-app notification only, no push. *(product)*
3. **Demoted co-leader notification.** When the creator demotes a co-leader, does the demoted person get a notification? Default: yes — in-app + push, framed as "Your co-leader role on [Trip name] was changed." Avoid framing as "removed." *(product, design)*
4. **Auto-promote on leader-leaves**: if the creator's troop leaves a trip and there's at least one co-leader, should one of them auto-promote to creator? Default: no — trip ends per FEAT-022. Auto-promote requires FEAT-034. *(product)*
5. **Eligible candidates UI**: show all joined-troop leaders, or only those the creator already has a contact relationship with? Default: all joined-troop leaders (they're already trip members; visibility is mutual). *(design)*

## Cross-platform notes

No platform divergence — picker and confirmation patterns are standard.

## Verification

Trip-specific:

- **Step 24**: "Leader A promotes Leader B to trip co-leader. Confirm B can now invite a third troop and edit the trip's metadata. Confirm B cannot demote Leader A."

Proposed additions:

- Demote-self test: co-leader demotes themselves; server allows; row deleted; badge clears across all clients.
- Demote-other test: co-leader attempts to demote another co-leader → server rejects (creator-only).
- Sub-profile-not-eligible test: attempt to promote a sub-profile of a joined troop via API → server rejects.
- Auto-cleanup test: a co-leader's troop leaves the trip → their `trip_co_leaders` row is auto-deleted.
