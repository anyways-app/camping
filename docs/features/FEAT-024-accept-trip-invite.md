---
id: FEAT-024
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-002, FEAT-023, FEAT-029, FEAT-030]
last_reviewed: 2026-05-01
---

# FEAT-024: Accept trip invite

## Summary

When a troop leader receives a trip invitation (FEAT-023), they can **accept**, **decline**, or **leave it pending**. On accept, the entire troop joins the trip — every profile in that troop becomes a trip member subject to the per-sub-profile "Trip participation" feature gate (FEAT-030) and the per-trip "Trip visibility" override (FEAT-029). The trip transitions to `status='active'` if it was the first acceptance (FEAT-022). The leader is the sole gatekeeper for their troop's participation; sub-profiles cannot accept on their own.

## Roles & permissions

- **Invited troop's leader**: sole writer for accept / decline. Must be the leader, not a sub-profile or co-leader of any other troop.
- **Sub-profiles in the invited troop**: read-only on the invitation; they may see "Your troop has been invited to [Trip name]" but cannot act on it.
- **Inviter** (creator or co-leader of the trip): notified of the response; can re-invite if declined (FEAT-023).

## Surfaces

- **Invited troop's Trips list** (FEAT-019, "Invited" group): each invitation row shows trip name, inviter troop name, dates, cover image, and "Accept" / "Decline" actions.
- **Push notification** on receipt of the invitation: tap to open the invitation in-app.
- **Confirmation dialog** on Accept: "Joining this trip will let everyone in your troop see other trip members and the trip-shared contact list. Continue?" Optional pre-flight: "Choose which sub-profiles see this trip" (defaults to all visible per FEAT-029) — *(Open question 2)*.

## Behaviour

1. Leader sees the invitation in the Invited section of their Trips list.
2. Tap the row → invitation detail screen with full trip metadata + "Accept" / "Decline" buttons.
3. **Accept flow**:
   - Confirmation dialog as above.
   - On confirm:
     - Server updates `trip_troops (trip_id, troop_id, status='accepted', joined_by_profile_id=leader, responded_at=now)`.
     - Server inserts `trip_profile_visibility (trip_id, profile_id, visible=true)` for **every profile in the accepting troop** that has the "Trip participation" gate ON in `profile_feature_gates`. Profiles with the gate off do NOT get a visibility row, effectively excluding them from the trip.
     - If `trips.status='draft'` and this is the first accept, server transitions to `status='active'` (FEAT-022).
     - **Mesh-v1 hook**: if `trips.offline_mesh_enabled = true` (FEAT-021), the bootstrap-credentials flow (FEAT-111) fires for every profile that is becoming a trip member with both `Mesh send` and / or `Mesh receive` gates on (FEAT-007). Each such profile is issued a per-Trip MemberID, a TripKey envelope, an Ed25519 keypair, and a copy of the dictionary version pin. Profiles with both mesh gates off do not get mesh credentials but remain Trip members for non-mesh purposes.
     - Realtime broadcast: trip detail updates with the new troop in the member roster; original inviter sees the response in their pending-invitations list.
4. **Decline flow**:
   - Confirmation: "Decline this trip invitation? You can be re-invited later."
   - Server updates `trip_troops.status='declined'`, `responded_at=now`.
   - Realtime broadcast: original inviter's pending-invitation row updates to "Declined."
5. **Leave-pending**: leader takes no action. The invitation sits indefinitely (until expiry per FEAT-023 open question 1, default 30 days).
6. **Leave the trip later** (after accepting): leader can navigate to the trip detail → "Leave trip" → confirmation → server updates `trip_troops.status='left'`. The troop's profiles are removed from the trip; their `trip_profile_visibility` rows are deleted. Trip-shared contacts that were *shared by* this troop's leader remain in the trip's shared list until explicitly unshared (or until the leader leaves and the system auto-unshares — *Open question 4*).

## Data

Reads:
- `trip_troops` (the invitation row).
- `trips` (metadata).
- `profile_feature_gates` (Trip participation gate per profile, to determine visibility default).

Writes:
- `trip_troops` (status update on accept / decline / leave).
- `trip_profile_visibility` (insert/delete on accept / leave / sub-profile-gate-flip).
- `trips.status` (update if first accept).

## Edge cases

- **Leader accepts then immediately leaves** (testing, change of heart). Both transitions are valid; server logs both `responded_at` and `left_at`. Trip-shared contacts shared during the brief membership are auto-cleaned per Open question 4.
- **Sub-profile in accepting troop has Trip participation gate Off**: no `trip_profile_visibility` row inserted on accept. Sub-profile does not see the trip. If leader later flips the gate On, the row is inserted then; if leader later flips it Off, the row is deleted.
- **Sub-profile created AFTER accept**: server hook inserts `trip_profile_visibility` rows for the new sub-profile across all active trips the troop is on, with `visible` matching the new sub-profile's Trip participation gate default (On per FEAT-007).
- **Trip ends between invitation and accept**: the invitation row is auto-cleaned (per FEAT-023 edge case). If the leader had it open, the screen shows "This trip has ended" and the action buttons disable.
- **Leader declines accidentally**: in v1, decline is final; the inviter can re-invite. *(Open question 3.)*
- **Mid-flight network failure on accept**: the accept is server-atomic across `trip_troops` + `trip_profile_visibility` + `trips.status`. If any insert fails, the whole accept is rolled back. Client retries with backoff.

## Out of scope

- **Per-sub-profile selective accept** at the moment of acceptance (e.g., "join, but only B1 and B2, not B3"). Default v1: accept brings the *whole troop* in (subject to per-sub-profile gates and the per-trip override). The per-trip override (FEAT-029) gives the same effect post-accept.
- **Conditional acceptance** ("I'll join if these other troops also join"). Not v1.
- **Joining a trip without an invitation** (public discovery). FEAT-033 (deferred).
- **Re-joining after a leave**: in v1 the leader must be re-invited.

## Open questions

1. **Decline confirmation friction.** Hard-confirm vs. soft (one-tap decline). Default: hard-confirm — accidental decline is high-cost given re-invite friction. *(design)*
2. **Pre-flight per-sub-profile visibility configuration on accept.** Show the leader the visibility list in the accept confirmation dialog so they can opt-out specific sub-profiles immediately? Default: yes — surfaces FEAT-029 at the natural moment, fewer steps later. *(product, design)*
3. **Undo decline.** v1: no in-app undo; re-invite required. Could add a 5-minute undo toast post-decline. *(product)*
4. **Leaving a trip mid-stream — what happens to contacts I shared?** Default: auto-unshare on leave (the contacts disappear from the trip's shared list within one refresh). Alternative: contacts stay (the leader's leaving is a personal-membership concern, not a contact-availability concern). v1 default: auto-unshare for cleanliness. *(product)*
5. **Re-invitation after leave** vs. **re-join self-serve**. Default: re-invite required. Self-serve re-join could be a v1.x add. *(product)*

## Cross-platform notes

- **Web**: confirmation dialog is a modal. Push notifications via web-push (PWA — FEAT-083).
- **iOS / Android**: native sheet-modal for the invitation detail screen. Push via APNs / FCM. The "Choose which sub-profiles" pre-flight is a sheet within a sheet.

## Verification

Trip-specific:

- **Step 20**: "B accepts; trip status flips to `active`. All sub-profiles in troop 2 with default `Trip participation = On` see the trip in their Trips list."
- **Step 23**: "Set 'Trip visibility' for sub-profile B1 to **off** for this trip. Switch to B1; confirm the trip does not appear in B1's Trips list."

Proposed additions:

- First-accept-flips-status test: trip starts draft; first accept → status active.
- Sub-profile-gate-off test: sub-profile in accepting troop has Trip participation off → no visibility row → trip not in their list.
- Decline test: B declines; status='declined'; A sees the response.
- Leave test: B accepts then leaves; trip_troops status='left'; sub-profiles removed from member roster; auto-unshare of contacts B shared.
- Sub-profile-after-accept test: leader creates a new sub-profile after accepting → new sub-profile auto-included in the trip (subject to gate).
