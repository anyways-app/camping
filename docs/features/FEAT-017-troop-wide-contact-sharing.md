---
id: FEAT-017
area: Social Graph & Privacy
release: v1
status: Spec'd
dependencies: [FEAT-001, FEAT-002, FEAT-003, FEAT-016, FEAT-018]
last_reviewed: 2026-05-01
---

# FEAT-017: Troop-wide contact sharing

## Summary

The troop leader can expose specific contacts from their own master contact list to every profile in the same troop, by flicking a per-row "Share with troop" toggle. Sub-profiles see those contacts in a distinct, leader-attributed segment of their own contact list. This is the controlled exception to the "raw uploaded contacts are never visible to anyone but the uploader" privacy invariant — it lets a parent surface key extended-family / trusted-friend contacts to every kid's profile without each kid having to re-import them, while preserving the invariant for everything not toggled on.

## Roles & permissions

- **Troop leader.** Sole writer. Can toggle "Share with troop" on any contact in their own master contact list, individually or in bulk. Can untoggle at any time.
- **Sub-profile.** Read-only consumer. Sees the leader-shared segment in their contact list. Cannot toggle, cannot remove from the segment, cannot see leader contacts that aren't toggled on.
- **Members of other troops.** No visibility — sharing is troop-internal.

No feature-gate controls this — every sub-profile in the troop sees the leader-shared segment regardless of their per-sub-profile gates. This is intentional: the leader's control over what gets shared down is the gate.

## Surfaces

- **Leader's contact list screen.** Each contact row gets a "Share with troop" toggle (right-side switch). Multi-select mode for bulk share.
- **Every sub-profile's contact list screen.** Renders in two segments:
  1. **My contacts** — what the sub-profile imported themselves (FEAT-016).
  2. **Shared by [Leader display name]** — leader-toggled subset, visually distinct (separate header, accent colour, leader's avatar in the header).
- **Mutual-discovery candidate pool computation.** Background — leader-shared contacts feed each sub-profile's matching pipeline alongside their own contacts (FEAT-014).

## Behaviour

1. Leader navigates to "My contacts." Each row shows the contact's display name + "Share with troop" toggle on the right.
2. Leader toggles ON for one contact.
   - Client: optimistic UI, toggle flips immediately.
   - Server: insert row into `troop_shared_contacts (troop_id, contact_id, shared_by_profile_id, shared_at)`.
   - Realtime broadcast: Supabase Realtime channel for the troop fires; subscribed sub-profile clients update their contact list within seconds.
3. Sub-profile in the same troop sees the contact appear in their "Shared by [Leader]" segment. If their app isn't subscribed (backgrounded), they see it on next refresh.
4. Bulk share: leader long-presses (or taps "Select") to enter selection mode, checks N rows, taps "Share with troop" in the action bar.
   - Server: bulk insert into `troop_shared_contacts`.
   - Realtime: single broadcast event listing the new contact ids.
5. Leader toggles OFF for a previously-shared contact.
   - Server: delete the matching row from `troop_shared_contacts`.
   - Realtime broadcast: subscribed sub-profile clients remove the row from their shared segment within one refresh.
6. **Mutual-discovery interaction.** When matching pipeline runs for a sub-profile, candidate pool is `(sub-profile's own contacts) ∪ (contacts where troop_shared_contacts.shared_by_profile_id = leader's profile)`. A match (and the resulting dark-green direct-contact border on cards) still requires both sides to have uploaded each other AND to be registered. Sharing alone never fabricates a match.
7. **Dedup.** If a sub-profile has the same contact in both their own list and the leader-shared segment (matched by phone hash), the leader-shared row is the canonical render — higher-trust source. The sub-profile's own row is hidden, not deleted.

## Data

Reads:
- `contacts` (leader's rows; each sub-profile's own rows for dedup).
- `profiles` (display names, avatars).
- `troops` (membership for RLS scoping).

Writes:
- `troop_shared_contacts (troop_id, contact_id, shared_by_profile_id, shared_at)` — insert on share, delete on unshare.

Sub-profile reads of `contacts` go through the RLS policy that joins with `troop_shared_contacts` (see [`00-core.md` Backend RLS](../spec/00-core.md#backend)). Only `display_name` and `phone_hash` are exposed across profiles; never raw upload metadata.

## Edge cases

- **Leader deletes a contact from their master list while it's shared.** The `troop_shared_contacts` row is automatically dropped via cascade delete on `contact_id`. Sub-profiles see it disappear within one refresh. Default: cascade. *(Open question 1.)*
- **Sub-profile blocks a leader-shared contact via the long-press menu.** The contact is hidden from THAT sub-profile's view (a `profile_blocks` row, separate from this feature) but remains shared to the rest of the troop. Block is per-profile, share is per-troop.
- **Leader toggles share off while a sub-profile has a pending forward to that contact in flight.** The in-flight forward is allowed to complete; future forwards become subject to the standard "Forward outside the troop" gate.
- **Race: leader and sub-profile both edit the contact list simultaneously** (sub-profile is editing their own row for the same contact). No write conflict because they touch different tables (`contacts` rows are profile-scoped; `troop_shared_contacts` is troop-scoped). UI may briefly show both segments containing the contact until dedup runs on next refresh.
- **Network down.** Leader toggles a share offline; client queues the operation. On reconnect, replay the queued toggles. If the contact has been deleted in the meantime, the share insert is silently dropped.
- **Empty state for sub-profile.** If the leader has shared zero contacts, the "Shared by [Leader]" segment header is hidden entirely (don't show an empty segment).
- **Empty state for leader.** Leader's contact list with zero contacts shows the standard "Import contacts to get started" empty state. The Share toggle is irrelevant in this case.

## Out of scope

- **Trip-shared contacts** (FEAT-027, FEAT-028) — different scope, different RLS surface, different table (`trip_shared_contacts`). A contact can be in both at once independently.
- **Sub-profiles sharing TO the troop.** Only leaders share down; sub-profiles cannot promote contacts upward.
- **Leader sharing a sub-profile's contact.** Leader can only share their own contacts.
- **Notification when a new contact is shared.** v1: silent. The new contact just appears in the segment on next view. *(Open question 3 — could become a feature later.)*
- **Audit log of share/unshare events.** No first-class user-facing log in v1; the timestamps live in `troop_shared_contacts.shared_at` for ops debugging only.

## Open questions

1. **Cascade-delete on contact removal.** Default proposed: yes — deleting a contact from the leader's master list automatically untoggles the share. Alternative: keep the share row as a tombstone for re-share if the contact is re-imported. *(product)*
2. **Visual treatment of the "Shared by Leader" segment header.** Accent colour; leader avatar size; whether the header is sticky during scroll. *(design)*
3. **Notification UX when leader shares a new contact.** v1 default: silent. Alternatives: passive in-list "new" badge for 24h, push notification (overkill), in-app toast next time the sub-profile opens the contact list. *(product)*
4. **Behaviour after troop ownership transfer (v2 / FEAT-011).** When a leader hands the troop to another adult identity, do the previous leader's shares persist under the new leader's attribution? Drop entirely? Get re-attributed? *(product, depends on FEAT-011 design)*
5. **Bulk share UX entry point.** Long-press to enter selection mode (mobile-native), or always-visible "Select" button (web-friendly), or both. *(design)*

## Cross-platform notes

- **Web**: existing M1 shell does not yet have a contact-list screen. Toggle is a standard switch component on each row. Bulk share via "Select" button toggling selection mode.
- **iOS**: native React Native row with a UISwitch-style toggle. Long-press to enter selection mode; multi-select with checkmarks.
- **Android**: native row with a Material Switch. Long-press to enter selection mode; floating action bar appears with "Share with troop" / "Cancel."

## Verification

References from [`00-core.md` Verification](../spec/00-core.md#verification-cross-platform-end-to-end):

- **Step 14** of troop-specific verification: "As leader of troop 1, toggle 'Share with troop' on a contact in the leader's contact list. Switch to B1; confirm the contact appears in B1's contact list under 'Shared by [Leader display name]' and not in B1's 'My contacts' segment."
- **Step 15**: "Untoggle the share; refresh B1; the contact disappears from the shared segment within one refresh cycle."

Automated test floor entries:

- "Unit tests for the troop-shared-contacts visibility rule (leader toggle on → sibling profiles see; off → siblings do not see; toggling does not leak unshared contacts; one-hop grants do not transfer across siblings)."

Proposed additions (not yet in spec, surface for next spec sync):

- Race-condition test: leader unshares while sub-profile has the contact open in detail view — confirm UI updates without a hard error.
- Cascade test: deleting a contact from the leader's master list drops all `troop_shared_contacts` rows referencing it.
- Dedup test: sub-profile imports a contact already shared by leader — confirm only leader-shared row renders, sub-profile's row is hidden not deleted.
