---
id: FEAT-011
area: Identity & Accounts
release: v2
status: Deferred
dependencies: [FEAT-001, FEAT-002, FEAT-005]
last_reviewed: 2026-05-01
---

# FEAT-011: Co-leadership and ownership transfer

## Summary

v1 hard-codes one troop leader (FEAT-002). v2 introduces two follow-on capabilities:

1. **Co-leadership** — two or more adult identities sharing leader privileges on the same troop (with a defined conflict-resolution rule when opposing setting changes collide).
2. **Ownership transfer** — the existing leader hands the troop off to another adult identity in a one-way move; the prior leader either becomes a sub-profile, becomes a co-leader (if co-leadership ships first), or is removed from the troop entirely.

Both have material auth, billing, security, and audit-trail implications that warrant their own design pass. Listed together because they share the underlying mechanic (multiple authoritative adults touching the same troop).

## Roles & permissions

(All TBD per the v2 design.)

- **Co-leader**: full leader privileges. Can manage sub-profiles, share contacts, configure gates, invite to trips, end trips, etc. Cannot remove the original leader (in some designs); cannot reduce another co-leader to non-leader without a quorum (in other designs).
- **Original creator** (in some designs): a soft-distinguished role with veto on co-leader-removal actions. Or fully equivalent to other co-leaders (no creator-distinction). Open question.
- **Recipient of an ownership transfer**: becomes the troop's leader after the transfer commits. Inherits everything the prior leader could do.

## Surfaces

- **Co-leader invitation flow**: leader invites a co-leader by phone / username; recipient accepts; recipient's auth identity becomes additionally attached to the troop.
- **Conflict-resolution UX**: when two co-leaders are concurrently editing the same setting, the second writer sees a "Co-leader [Name] is also editing this. Continue and overwrite?" prompt.
- **Ownership-transfer flow**: leader initiates → recipient confirms within a grace window → transfer commits with a 24 h "are you sure?" cooldown / undo. *(Open question 4.)*

## Behaviour

(All TBD; sketch only.)

1. **Add co-leader**: leader navigates to troop settings → "Manage troop leaders" → "Invite co-leader." Recipient is identified by phone / Apple / Google identity. Recipient receives an invitation; on accept, their identity is attached to the troop's `co_leadership` table. They can sign in to the troop and switch into the leader-equivalent profile.
2. **Remove co-leader**: simple in single-co-leader case; complex with multiple co-leaders. Quorum or veto rules TBD.
3. **Transfer ownership**: leader navigates to troop settings → "Transfer troop ownership" → enters recipient identity → confirmation cycle. On commit, `troops.leader_profile_id` flips to the recipient's profile (a new profile is created if needed) and the prior leader is converted to a sub-profile (or removed; TBD).

## Data

(Conceptual.)

- New table: `troop_leaders (troop_id, profile_id, role: 'creator' | 'co_leader', joined_at, removed_at NULL)`. Replaces or augments the `troops.leader_profile_id` singleton.
- Audit log: every leadership change captures who initiated, who accepted, when, and what state existed before/after.
- Billing reassignment on ownership transfer: the billing identity migrates with the troop.

## Edge cases

(Many; flagged for design pass.)

- Concurrent co-leader edits to the same setting (last-write-wins vs. quorum vs. lock).
- Removal of the original creator by other co-leaders.
- Ownership transfer to an identity not yet on the platform: do we issue a "claim your troop" invite via SMS / email?
- What happens to the leader's master contact list on transfer? It carries with them as a personal asset; the new leader starts with their own. *(Open question 3.)*
- What happens to in-flight sharing toggles, trip co-leader assignments, etc., on transfer.

## Out of scope (this feature)

- All of v1. v1 is single-leader, no transfer.
- "Soft" co-leadership where a sub-profile gains *some* leader privileges without becoming a full co-leader. v3 if ever.
- Multi-troop linking (a council of troops sharing some state). Tied to FEAT-012 instead.

## Open questions

1. **Co-leader vs. ownership-transfer sequencing.** Ship co-leadership first, ownership transfer second? Or both together? Default: ship co-leadership first; ownership transfer becomes "convert all but one co-leader to sub-profile, then that one is the new singular leader." *(product)*
2. **Conflict-resolution rule.** Last-write-wins, quorum, or first-write-locks. Default: last-write-wins with notification (Camp King is not Notion / Figma; co-edits are rare). *(product, design)*
3. **Master contact list on ownership transfer.** Stays with the prior leader (personal asset) vs. transfers with the troop. Default: stays with the prior leader. Troop-shared contacts (per FEAT-017) likewise — they're rooted in the *uploader's* contact list, so when the uploader leaves, the share is dropped. *(product)*
4. **Transfer cooldown / undo.** 24-hour reversal window vs. immediate commit. Default: 24 h with notification to both parties, can be cancelled by either party. *(product, security)*
5. **Maximum co-leaders per troop.** 2? 3? 6 (matching the sub-profile cap)? Default: 3 for v2 launch. *(product)*
6. **Recovery scenarios.** Co-leadership materially affects FEAT-002 open question 2 (account recovery). Designed in conjunction with the v2 recovery flow. *(legal, security)*

## Cross-platform notes

To be defined in the v2 design pass. Auth-identity attachment is a server-side concern; UI is largely platform-symmetric.

## Verification

To be defined. Skeleton:

- Add a co-leader; both accounts can sign in to the same troop and exercise leader privileges.
- Concurrent edit test: both co-leaders flip the same gate to opposite values; resolution rule applies as designed.
- Ownership transfer commits successfully; billing identity migrates; prior leader is no longer authoritative.
- Audit log captures every leadership change with attribution.
