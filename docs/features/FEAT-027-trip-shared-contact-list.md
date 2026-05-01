---
id: FEAT-027
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-013, FEAT-017, FEAT-018, FEAT-024, FEAT-028, FEAT-029]
last_reviewed: 2026-05-01
---

# FEAT-027: Trip-shared contact list

## Summary

Each trip has its own **shared contact list**, separate from any troop's master list (FEAT-017) and separate from any individual profile's contacts (FEAT-013/FEAT-016). Trip-shared contacts are visible to every profile that is a trip member across all joined troops, in a distinct **"Trip contacts: [Trip name]"** segment of their contact list. The mechanic exists so that real external people relevant to the trip (the campground host, a guide, the friend-of-a-friend who's giving everyone rides) can be surfaced once and seen by all attendees, without merging anyone's master contact lists.

## Roles & permissions

- **Read** (every trip member with `trip_profile_visibility.visible=true`): sees the trip-shared contact list as a segment of their own contact list. Sees `display_name` and `phone_hash` (for matching), never raw upload metadata.
- **Write** (any troop leader on the trip — creator, co-leader, or simply a joined-troop leader): can flick "Share with this trip" on contacts in their own master list (FEAT-028). Multiple leaders can share into the same trip; the segment shows the union.
- **Sub-profiles**: cannot write into the trip-shared list. Read-only.
- **Profiles outside the trip**: no visibility.

## Surfaces

- **Trip detail screen**: dedicated "Shared contacts" sub-section showing the trip-shared list. Shows who shared each contact ("Shared by [Leader display name]"). *(Open question 2.)*
- **Each trip member's main contact list screen**: when they're in the active trip context, an additional segment titled "Trip contacts: [Trip name]" appears alongside "My contacts" (FEAT-016) and "Shared by [Leader]" (FEAT-017). If the member is on multiple active trips, multiple trip-contact segments appear, one per trip. *(Open question 4.)*
- **Forward picker** (FEAT-061): trip-contact members surface as recipients for trip members with appropriate forwarding gates.

## Behaviour

1. A troop leader who is a trip member toggles "Share with this trip" on a contact (FEAT-028).
2. Server inserts `trip_shared_contacts (trip_id, contact_id, shared_by_profile_id, shared_at)`.
3. Realtime broadcast to all trip members; their clients re-fetch the trip-shared segment within seconds.
4. Each trip member's main contact list screen renders the union of:
   - Their own contacts ("My contacts" — FEAT-016).
   - Their troop's leader-shared contacts ("Shared by [Leader]" — FEAT-017).
   - Each active trip's trip-shared contacts ("Trip contacts: [Trip name]" — this feature).
5. Mutual-discovery (FEAT-014) treats trip-shared contacts as candidate-pool members for each trip member, exactly the same as own-uploaded and troop-shared contacts. A *match* still requires both sides registered + mutual upload.
6. **End-of-trip** (FEAT-022 → ended): trip-shared contacts go read-only. They remain visible to historical participants but no new shares accepted; the segment stays in the read-only archive view per FEAT-018 RLS.
7. **Dedup across segments**: if a contact appears in both the leader-shared and trip-shared segments, both segments render the contact independently — clarifying *the source* of visibility. *(Open question 1 — same as FEAT-018 OQ 2.)*

## Data

Reads:
- `trip_shared_contacts` (the trip's shared rows, scoped to trips this profile is on).
- `contacts` (joined for display name + phone_hash; uploader's profile_id determines who shared).
- `trip_troops` + `trip_profile_visibility` for visibility scoping (FEAT-018 RLS).
- `profiles` (display name of the sharing leader for the "Shared by" attribution).

Writes:
- `trip_shared_contacts` (insert/delete via FEAT-028 toggle).

## Edge cases

- **Multiple leaders share the same external person**: the contact appears in the trip-shared segment with multi-attribution: "Shared by [Leader A], [Leader B]." *(Open question 3.)*
- **One sharer leaves the trip**: their share rows are auto-deleted (per FEAT-024 OQ 4). If another leader had shared the same contact, that share survives; the contact remains visible.
- **Trip-shared contact also matches a profile**: the contact appears in the segment with the standard direct-contact border on cards from that profile (subject to mutual-discovery rules).
- **Empty segment**: no contacts have been shared with the trip yet → segment is hidden (don't show an empty header).
- **Sub-profile with `trip_profile_visibility.visible=false`**: trip-shared contacts are not visible to them.
- **Block on a trip-shared contact**: per-profile block hides the contact from THAT profile's view but the contact remains shared to other trip members. The block is per-profile, share is per-trip.
- **Slow refresh**: when a leader shares a contact, other members may have a few seconds of lag before seeing it. UI may offer a manual refresh action.
- **Storage growth**: highly-shared trips with hundreds of contacts. Default v1: no cap. *(Open question 5.)*

## Out of scope

- **Sharing other types of resources** (cards, sensor history, etc.) into a trip. Only contacts in v1.
- **Trip-shared contacts for non-members** (e.g., "open to anyone who finds the trip"). Trips are invitation-only in v1; trip-shared contacts inherit that scope.
- **Annotation on trip-shared contacts** ("This is the campground host" labels). Default: just the contact's display name as the sharer saved it. *(Open question 7.)*
- **Contact-list export from a trip**. Privacy-sensitive; not v1.

## Open questions

1. **Both-shared dedup rule.** Same as FEAT-018 open question 2. Default: render in both segments. *(design)*
2. **"Shared by [Leader]" attribution always shown** vs. only on long-press / detail. Default: always shown — transparency wins, leaders are accountable. *(design)*
3. **Multi-attribution display.** When multiple leaders share the same contact, show "Shared by A and B" (combined) or "Shared by A" with the most-recent / first sharer? Default: show all — gives visibility into who's involved. *(design)*
4. **Multiple active trips → multiple contact-list segments.** Default: yes, one segment per active trip. Could become unwieldy with 5+ active trips. Could collapse under "Trip contacts" with sub-headers. *(design)*
5. **Cap on trip-shared contacts per trip.** Default: no cap. *(ops)*
6. **Trip-end retention.** Trip-shared contacts persist forever in the read-only archive vs. auto-purged after N months. Default: persist forever. *(legal, ops)*
7. **Free-form annotation on trip-shared contacts.** Sharers add a "context note" ("Campground host, has the gate code"). Not v1; v1.x or v2 add. *(product)*

## Cross-platform notes

- **Web**: contact list on each profile is a long scrollable list with section headers for each segment. Sticky headers as the user scrolls.
- **iOS / Android**: native sectioned list (UITableView / RecyclerView) with section headers.

## Verification

Trip-specific:

- **Step 21**: "Leader B toggles 'Share with this trip' on a contact in B's master contact list. The contact appears in the trip's shared contact list, visible to every trip member across both joined troops, under the segment 'Trip contacts: Wind River 2026.'"
- **Step 22**: "Leader B unshares the same contact; it disappears from the trip's shared list within one refresh cycle."
- **Step 23**: "Sub-profile B1 with `Trip visibility = off` does not see the trip-shared contacts."
- **Step 25**: "A trip-shared contact appears as a *match* (dark-green direct-contact border) only when both that contact and the viewing trip member have uploaded each other and are both registered."

Automated tests:

- "Unit tests for the trip-shared-contacts visibility rule (visible only to trip members across joined troops; invisible to sub-profiles whose leader has set `trip_profile_visibility = false`; goes read-only when trip ends)."

Proposed additions:

- Multi-sharer test: two leaders share the same contact; segment shows multi-attribution.
- One-sharer-leaves test: a sharer leaves the trip; their shares auto-delete; the contact disappears (or remains, if another sharer also shared it).
- Trip-end read-only test: end the trip; existing rows remain visible; new insert attempts are rejected.
