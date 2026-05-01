---
id: FEAT-012
area: Identity & Accounts
release: v2
status: Deferred
dependencies: [FEAT-001, FEAT-003, FEAT-007]
last_reviewed: 2026-05-01
---

# FEAT-012: Larger troops / tiered offering

## Summary

v1 caps a troop at 6 sub-profiles + 1 leader = 7 total profiles (FEAT-003), matching Apple Family / Netflix-style household sizing. v2+ introduces a **tiered offering** with at least one larger-troop tier sized for actual scout troops, extended families, and classroom cohorts. Tiered pricing, larger contact-import quotas, and possibly a "leader of leaders" structure (federated troops — many sub-troops under a council) come with this work.

## Roles & permissions

- **Standard troop**: 7-profile cap as in v1.
- **Larger troop tier(s)**: TBD profile caps. Plausible v2 launch tiers:
  - "Family Plus" — 12 profiles, modest price increase.
  - "Scout Troop" — 30 profiles, with adult-leader / youth-member role distinctions.
  - "Classroom" — 40 profiles, single school-year duration, simplified billing.
- **Federated structure** (advanced): a "council" entity that holds multiple troops; a "council leader" who can see roll-up reporting across constituent troops. Almost certainly later than the initial larger-troop tier.

## Surfaces

- **Pricing tier picker** at signup (or upgrade flow from troop settings).
- **Larger-troop management UI**: same shape as FEAT-009 but designed to scale to 30+ rows (search, filter, bulk actions).
- **Council UI** (if shipped): troop list, council-level settings, roll-up of activity.

## Behaviour

(All TBD per v2 design.)

1. Leader signs up or upgrades; chooses tier; billing event applied.
2. `troops.tier` field set; `troops.profile_cap` derived from tier.
3. Leader can create up to N sub-profiles; cap enforcement (FEAT-003) reads `troops.profile_cap`.
4. Bulk import of sub-profiles for classroom / scout-troop tiers — CSV upload of "[name, optional avatar]" rows.
5. Optional sub-tier roles within a larger troop: e.g., "Adult Leader" + "Youth Member" with different default gate matrices.

## Data

(Conceptual.)

- `troops.tier ENUM('standard', 'family_plus', 'scout_troop', 'classroom', ...)`.
- `troops.profile_cap INT` (derived or stored).
- New table: `councils (id, name, owner_identity, ...)` and `council_troops (council_id, troop_id, ...)` for the federated structure if shipped.
- Bulk-import endpoint for sub-profile creation.

## Edge cases

(All TBD.)

- Downgrading a tier when current sub-profile count exceeds the new cap. Default: blocked until the leader deletes the excess; alternative: oldest sub-profiles auto-archive.
- Mid-cycle tier change: prorated billing.
- Council departure: a troop leaves a council. Council-shared resources (contact lists, trip lists, etc.) are dropped from the departing troop's view.

## Out of scope (this feature)

- All of v1. v1 is the standard 7-profile tier.
- "Per-seat" pricing where each sub-profile has its own bill. v2: troop-level tiered pricing only.
- Cross-troop cards / cross-troop social graph beyond what trips already provide. The graph stays per-profile (FEAT-013).

## Open questions

1. **Initial tier set.** Which tiers ship in v2.0 and which wait? Default: Family Plus (12 profiles) at v2.0; Scout Troop and Classroom in v2.1+. *(product)*
2. **Federated councils.** Worth the complexity for v2, or wait for clear scout-troop demand? Default: not in v2.0; revisit when there's data on actual scout-troop usage of the Scout Troop tier. *(product)*
3. **Pricing.** Free / freemium / paid only — how does each tier price? Default: standard tier is free; Family Plus is a small monthly subscription; Scout Troop / Classroom are higher monthly subscriptions. Actual prices TBD by business. *(product)*
4. **Larger-troop default gate matrix.** Should the defaults differ for, e.g., "Scout Troop" (more permissive within-troop forwarding because the sub-profiles are co-troopers, not siblings)? Default: same defaults as standard tier; leaders adjust as needed. *(product)*
5. **Adult-leader / youth-member roles.** Is the role distinction a first-class concept or just a default-gate-matrix template? Default: template only — keep the data model flat. *(product)*
6. **CSV bulk-import safety.** Bulk-importing 30 sub-profiles is a lot of identity creation; how do we prevent abuse / spam-account creation? Default: rate-limit per troop, require email confirmation per imported sub-profile (which itself implies sub-profiles get email addresses, which is a v2 ask). *(security, product)*

## Cross-platform notes

To be defined. The larger-troop management UI may benefit more from the desktop / web form factor than the small-screen mobile form factor for caps over ~12.

## Verification

To be defined. Skeleton:

- Upgrade from standard to Family Plus: profile cap rises to 12; leader can create more sub-profiles up to 12.
- Downgrade with excess profiles: blocked until pruned.
- Bulk import 25 sub-profiles for Scout Troop tier: all succeed; gates apply per template.
- Federated council (if shipped): create council, link two troops, council leader can see roll-up; departing a troop drops council-shared visibility.
