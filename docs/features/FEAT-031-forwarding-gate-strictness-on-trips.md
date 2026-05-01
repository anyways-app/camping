---
id: FEAT-031
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-007, FEAT-024, FEAT-027, FEAT-061]
last_reviewed: 2026-05-01
---

# FEAT-031: Forwarding-gate strictness on trips

## Summary

A sub-profile's "**Forward outside the troop**" feature gate (FEAT-007) is **NOT** loosened by trip membership. Other trip members (regardless of whether they're in your troop or another joined troop) and trip-shared contacts both count as "outside the troop" for the forwarding gate. If a leader wants their sub-profile to forward into the trip context, they must flip the gate on for that sub-profile — there is no separate "forward within trip" gate in v1. This keeps leader control uniform and the gate matrix simple.

## Roles & permissions

- **Troop leader**: writes the "Forward outside the troop" gate per sub-profile (FEAT-007).
- **Sub-profile**: experiences the gate uniformly: it applies whether they're forwarding from the feed in non-trip context or from within a trip context.
- **Server**: enforces uniformly. The forward-card endpoint reads the active profile's gate; if off, only in-troop sibling profiles are valid recipients regardless of any trip context.

## Surfaces

This feature is an *invariant*, not a screen. It manifests in:

- **Forward picker** (FEAT-061): when the gate is off, the recipient list is filtered to in-troop sibling profiles only. Fellow trip members (in other troops) and trip-shared contacts do NOT appear, even though both are "on the trip." Empty-state text: "Ask your troop leader to enable forwarding outside the troop."
- **Server forward endpoint**: rejects any forward to a recipient outside the active profile's troop when the gate is off.

## Behaviour

The rule, restated as a decision tree:

```
ON forward attempt by profile P to recipient R:
  IF R is a profile in the same troop as P (sibling sub-profile or P's own troop's leader):
    → ALLOW (in-troop forward; not gated)
  ELSE IF P's "Forward outside the troop" gate is ON:
    → ALLOW (gate permits; subject to mutual-discovery / trip membership for visibility)
  ELSE:
    → REJECT (gate off; recipient is "outside the troop" regardless of trip context)
```

The trip context does not loosen the rule. A sub-profile B1 with the gate off, on a trip with profiles from troops 2 and 3, can forward to B (their own leader) but not to anyone in troops 2 or 3, and not to any trip-shared contact.

## Data

Reads:
- `profile_feature_gates` (the active profile's `forward_outside_troop` gate).
- `profiles` + `troops` (recipient's troop ID, compared to the active profile's troop ID).

Writes:
- None (this is a read-side enforcement rule).

## Edge cases

- **Recipient is a fellow trip member in another troop**: counts as outside; gate applies.
- **Recipient is a trip-shared contact** (registered profile or just a contact): counts as outside; gate applies.
- **Recipient is the active profile's own troop's leader**: counts as in-troop; not gated. Sub-profiles can always forward to their leader, even with the gate off.
- **Recipient is another sub-profile in the same troop**: in-troop; not gated.
- **Recipient is a trip co-leader who happens to be the leader of the active profile's own troop**: in-troop; not gated. Trip role doesn't change the troop-membership calculation.
- **Active profile is the leader (not a sub-profile)**: the gate doesn't apply to leaders. Leaders can forward to any valid recipient.

## Out of scope

- **Per-trip forwarding gate.** Not v1. Could be a v1.x add: a "Forward within trip" toggle that loosens the strict rule for specific trips.
- **Per-recipient forwarding gate** ("can forward to alex but not jordan"). Not v1.
- **Receive-side filtering by gate**: the receive-side gate "Receive forwards from outside the troop" (FEAT-007) is independent and applies regardless of trip context too. Same strictness.

## Open questions

1. **Should this strictness be opinionated as a default, or surfaced as a separate per-trip toggle?** Default: keep strict for v1 (one gate to rule them all; simple matrix). Revisit if leaders ask for trip-specific exceptions in the wild. *(product)*
2. **UI hint within the trip context** ("Your sub-profile can't forward to other members on this trip — Forward outside the troop is off"). Default: subtle empty-state in the picker; not a banner that's always visible. *(design)*
3. **Server error code consistency.** The reject reason should be the same whether the recipient is a non-trip external profile or a fellow trip member; client surfaces the same friendly message. *(backend)*

## Cross-platform notes

No platform divergence — the rule is server-side; clients just render the empty state in the forward picker.

## Verification

Trip-specific:

- Implicit in the gate-respecting tests across FEAT-007, FEAT-024, FEAT-029.

Automated tests:

- "Unit tests for the per-sub-profile feature-gate matrix ... 'Forward outside the troop = off' still blocks forwarding to fellow trip members."

Proposed additions:

- Strict-gate test: sub-profile B1 with gate off; on trip with troops 2 and 3; attempt to forward to a profile in troop 2 → forward picker excludes them; if forced via direct API → server rejects.
- Strict-gate-trip-shared test: same, but recipient is a trip-shared contact → same exclusion / rejection.
- In-troop-allowed test: same B1 with gate off; forward to B (own leader) → allowed.
- Leader-not-gated test: leader (with no gate matrix) forwards to any valid recipient → allowed.
