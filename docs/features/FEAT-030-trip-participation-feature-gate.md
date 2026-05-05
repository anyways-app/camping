---
id: FEAT-030
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-007, FEAT-019, FEAT-024, FEAT-029]
last_reviewed: 2026-05-01
---

# FEAT-030: Trip participation feature gate

## Summary

A row in the per-sub-profile feature-gate matrix (FEAT-007): **Trip participation**. Default On for new sub-profiles. The leader can flip it off to exclude a sub-profile from all trip experiences entirely. The gate is the **broadest** trip-related sub-profile control; the per-trip "Trip visibility" override (FEAT-029) gives finer-grained per-trip control on top of this gate. Gate Off ⇒ no trips visible at all (Trips section hidden from navigation per FEAT-019). Gate On + per-trip visibility Off ⇒ in some trips, not this specific one.

**Mesh-v1 independence note.** The Mesh send (FEAT-114) and Mesh receive (FEAT-115) gates added to FEAT-007 are independent of Trip participation. A sub-profile with `Trip participation=On` and both mesh gates off is on the trip but radio-silent on the offline mesh — this is intentional, matching the use case of "kid is on the trip but their device shouldn't transmit / receive on BLE."

## Roles & permissions

- **Troop leader**: writes the gate value via per-sub-profile management (FEAT-009). Can flip at any time.
- **Sub-profile**: read-only on their own gate. Their UI reflects the leader's choice — Trips section disappears from nav when gate is off.

## Surfaces

- **Per-sub-profile management screen → Feature gates section** (FEAT-009): shows "Trip participation" as a row with a switch. Default On.
- **Trip detail / trips list**: respects the gate at the visibility layer. If gate is off, the sub-profile sees no trips. If gate is on, per-trip visibility (FEAT-029) determines individual trip access.

## Behaviour

1. Sub-profile creation (FEAT-003) inserts `profile_feature_gates (profile_id, feature='trip_participation', enabled=true)` (the v1 default per FEAT-007 spec table).
2. Leader flips the gate off → server updates the row → Realtime broadcast.
3. Server cascade on flip-off: every `trip_profile_visibility` row for this sub-profile gets `visible=false` (per FEAT-029 OQ 1). Alternative: rows are deleted; default is set-false to preserve override intent. *(Open question 1.)*
4. Sub-profile's client refreshes; Trips section disappears from navigation; any open trip detail screen routes back to feed with a "Trips disabled by your troop leader" toast.
5. Leader flips back on → cascade reverses: every `trip_profile_visibility` row resets to `visible=true` for *currently-active* trips. Trips ended during the off-window do NOT regain visibility automatically. *(Open question 2.)*
6. **At trip accept** (FEAT-024): if the gate is off when the troop accepts, no `trip_profile_visibility` row is inserted for this sub-profile. They never become a member of that trip until the gate flips on (after which point: do they retroactively become a member, or only for trips accepted while the gate was on? Default: retroactively for active trips; not for ended trips.).

## Data

Reads:
- `profile_feature_gates` (the gate row).

Writes:
- `profile_feature_gates` (update via FEAT-009 leader UI).
- Cascading writes to `trip_profile_visibility` per FEAT-029.

## Edge cases

- **Gate flipped off mid-trip while sub-profile is on the trip detail screen**: Realtime updates; client routes to the feed with a toast.
- **Leader flips gate while bulk-managing**: each toggle is a separate write; no transactional batch unless the UI explicitly groups (FEAT-009 OQ 1).
- **Sub-profile deletion**: cascades drop the gate row.
- **Default change at the platform level** (we change the v1 default from On to Off, post-launch): existing sub-profiles' gates are NOT retroactively changed; only new sub-profiles get the new default (per FEAT-007 edge cases).
- **Gate state drift between client and server** (stale cache): client attempts a trip-related action, server rejects via gate enforcement; client refreshes the gate matrix and surfaces the correct UI.

## Out of scope

- **Per-trip-type gates** (e.g., allow long trips but not short ones). Not v1; gate is binary.
- **Time-of-day gating** ("can join trips only on weekends"). Not v1.
- **Sub-profile self-toggle**. Tied to FEAT-007 OQ — sub-profile self-edit of any feature gate is not v1.

## Open questions

1. **Cascade behaviour on flip-off.** Set existing visibility rows to false vs. delete them. Default: set false (preserves explicit leader intent if any). *(product)*
2. **Re-on retroactive scope.** When gate flips on, do trips ended during the off-window become visible? Default: no — only currently-active trips. Avoids surprise notification spikes on re-on. *(product)*
3. **Notification when gate flips.** Should the sub-profile see a polite in-app toast when the gate changes? Default: yes for off ("Trips disabled by your troop leader") and yes for on ("Trips have been re-enabled by your troop leader"). *(product)*
4. **Audit log surfacing.** Should the leader see "You disabled Trip participation for B1 on May 5"? Default: ops-only audit, not user-facing (consistent with FEAT-007 OQ 5). *(product)*

## Cross-platform notes

No platform divergence. Gate row in the feature matrix; standard switch component on each platform.

## Verification

Trip-specific:

- **Step 20**: "All sub-profiles in troop 2 with default `Trip participation = On` see the trip in their Trips list." (Implies gate is consulted on accept.)

Automated tests:

- "Unit tests for the per-sub-profile feature-gate matrix (block / report always on regardless of toggles; defaults match the spec table; 'Forward outside the troop = off' still blocks forwarding to fellow trip members)." (Trip participation gate is part of this matrix.)

Proposed additions:

- Default-On test: create new sub-profile; gate row exists with `enabled=true`.
- Flip-off cascade test: flip gate off; all `trip_profile_visibility` rows for the sub-profile become false; Trips section disappears from nav.
- Flip-on retroactive test: flip back on; only currently-active trips become visible (ended trips during off-window do NOT).
- Server-enforcement test: sub-profile attempts to access trip-related API while gate is off → server rejects.
