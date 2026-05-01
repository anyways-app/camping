---
id: FEAT-028
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-002, FEAT-017, FEAT-018, FEAT-024, FEAT-027]
last_reviewed: 2026-05-01
---

# FEAT-028: Share with this trip toggle

## Summary

The mechanic that populates the trip-shared contact list (FEAT-027). Any troop leader who is a member of an active trip can flick a per-row "**Share with this trip**" toggle on contacts in their *own master contact list*. The toggle is per-trip-per-contact: the same contact can be shared to several active trips simultaneously by independent toggles, or to none. Bulk-share supported. Live-revocable. This is the **second** explicit exception to the "raw contacts uploader-only" privacy invariant (FEAT-018), the first being FEAT-017's troop-share.

## Roles & permissions

- **Troop leader** who is a member of any active trip: can toggle "Share with this trip" on contacts in their own master list. Can multi-select for bulk share.
- **Sub-profiles**: cannot share contacts to trips. Read-only access to the trip-shared list (FEAT-027).
- **Co-leaders of a trip who are leaders of their own troops**: same as troop leader — they share contacts from *their own troop's* master list, not from another troop's list.
- **Members of joined troops who are not their troop's leader**: cannot share.

## Surfaces

- **Leader's master contact list**: each row gets a contextual share menu. v1 design: the row shows the existing FEAT-017 "Share with troop" toggle PLUS a per-trip "Share with this trip" affordance (a sub-menu listing the leader's currently-active trips, each with a toggle).
- **Trip detail screen → "My contacts to share"** view (leader-only): a focused per-trip view of the leader's contacts with one toggle per row, scoped to that trip. This is the convenience surface for "let me populate this trip with contacts I'd want to share." *(Open question 1.)*
- **Bulk share UI**: multi-select within either of the above surfaces; "Share selected with [Trip name]" action.

## Behaviour

1. Leader navigates to their master contact list. For each contact row, leader taps the share menu (icon button on the right) → sees:
   - "Share with troop" (current toggle from FEAT-017).
   - "Share with [Trip A]" — toggle.
   - "Share with [Trip B]" — toggle.
   - … one per active trip the leader is a member of.
2. Leader flips "Share with [Trip A]" on for a contact.
   - Server: insert `trip_shared_contacts (trip_id=A, contact_id, shared_by_profile_id=leader, shared_at=now)`.
   - Realtime: trip A's channel fires; all trip A members re-fetch the trip-shared segment.
3. Leader flips off:
   - Server: delete the matching row.
   - Realtime: trip A members see the contact disappear from their trip-shared segment.
4. **Bulk share**: leader long-presses a contact (mobile) or taps "Select" header action (web), checks N rows, taps "Share selected with..." → trip picker → confirm. Server bulk-inserts.
5. **Trip detail "My contacts to share"** view (alternative entry): leader navigates to a trip → sub-section shows their own contacts with one toggle per row. Faster for "populate this trip" intent.
6. **Cross-trip share**: same contact toggled on for two trips → two `trip_shared_contacts` rows, one per trip. Both trips' members see the contact.
7. **Server enforcement**: the leader must be a member of the trip (`trip_troops.status='accepted'` for their troop). Server rejects attempts to share with trips the leader isn't on.

## Data

Reads:
- `contacts` (the leader's own contacts).
- `trip_troops` (which trips the leader's troop is on, status `accepted`).

Writes:
- `trip_shared_contacts` (insert on toggle on; delete on toggle off).

## Edge cases

- **Leader is on multiple active trips with overlapping sub-profile rosters.** Per-trip toggles are independent; sharing with trip A does not share with trip B even though some members overlap.
- **Same contact shared by two leaders to the same trip**: two `trip_shared_contacts` rows; FEAT-027 OQ 3 covers display.
- **Trip ends mid-toggle**: server rejects with "trip has ended"; client surfaces a toast and the row reverts.
- **Leader leaves the trip mid-share**: same; the toggle is no longer permitted; existing shares may auto-clean per FEAT-024 OQ 4.
- **Network down during bulk-share**: client queues the operations; on reconnect, replay. If individual rows fail (e.g., trip ended before reconnect), the failures are surfaced individually.
- **Leader deletes a contact that's shared to a trip**: cascade delete — `trip_shared_contacts` rows referencing the deleted `contact_id` are auto-removed (per FEAT-017 OQ 1, same default).
- **A non-leader profile attempts to share via direct API call**: server rejects (RLS denies).
- **Rapid toggle thrashing**: leader flips on/off/on/off rapidly. Each is a write; idempotent at the row level. Realtime broadcasts may be debounced to avoid client churn. *(Open question 4.)*

## Out of scope

- **Sub-profile-initiated share** ("I want to share this contact with our family trip"). Sub-profiles cannot share; they request via out-of-band conversation with the leader. *(Could become a "request to share" feature in v2.)*
- **Time-limited shares** ("share for the duration of the trip only" — but trips already have a lifecycle, so this would be redundant).
- **Cross-trip bulk share** ("share these 5 contacts with all my active trips"). Not v1; tedious workaround is to bulk-share each trip separately. *(Open question 2.)*
- **Sharing a *summary* of contacts** ("here's a list of trail conditions" — not actually a contact). Not v1.

## Open questions

1. **"My contacts to share" view inside trip detail.** Helpful as a focused entry point or redundant with the master-list per-row toggle? Default: include for convenience — different mental model (per-trip-first vs. per-contact-first). *(design, product)*
2. **Cross-trip bulk share.** "Share selected with all my active trips." Default: not v1 — adds complexity for an unclear win. *(product)*
3. **Visibility of who shared a contact**. Always show "Shared by [Leader name]" attribution, or only on detail / long-press? Default: always show (FEAT-027 OQ 2). *(design)*
4. **Toggle thrashing rate limit.** Default: server-side debounce on Realtime broadcasts only; the writes themselves are accepted as fast as the leader can flip. Reasonable tradeoff. *(ops)*
5. **Confirmation on share toggle.** v1: no confirm — flip is direct. Could add a confirm for first-time share to a trip ("This will share [Contact name] with all 12 members of [Trip name]. Continue?"). *(product, design)*
6. **Sharing a phone-number-only contact** (one without a registered Camp King profile). Default: yes — `contact_id` is the row in `contacts`, and `display_name` + `phone_hash` are exposed. The contact may or may not be a registered profile; mutual-discovery determines whether they appear as a *match*. *(product)*

## Cross-platform notes

- **Web**: per-row share menu is a popover on right-side affordance. Bulk-select via "Select" mode toggle.
- **iOS / Android**: per-row share menu is a sheet that slides up from the row. Long-press opens multi-select mode; floating action bar appears with "Share selected with..."

## Verification

Trip-specific:

- **Step 21**: "Leader B toggles 'Share with this trip' on a contact in B's master contact list."
- **Step 22**: "Leader B unshares the same contact; it disappears within one refresh cycle."

Proposed additions:

- Bulk-share test: select 5 contacts, share with trip → 5 rows inserted; all 5 visible to trip members.
- Cross-trip independence test: share contact with trip A; do NOT share with trip B; trip A members see it, trip B members don't.
- Non-leader-share-rejection test: sub-profile attempts to share via direct API → rejected.
- Cascade-on-contact-delete test: leader deletes a shared contact → all `trip_shared_contacts` rows referencing it are auto-removed.
- Leader-leaves-cleanup test: leader leaves trip → their `trip_shared_contacts` rows are auto-removed (per FEAT-024 OQ 4).
