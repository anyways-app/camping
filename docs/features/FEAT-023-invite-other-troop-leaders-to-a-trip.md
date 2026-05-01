---
id: FEAT-023
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-002, FEAT-020, FEAT-024, FEAT-026]
last_reviewed: 2026-05-01
---

# FEAT-023: Invite other troop leaders to a trip

## Summary

The trip creator (FEAT-025) and any trip co-leader (FEAT-026) can invite **other troop leaders** to a trip. Invitation is by phone number / username — the recipient must be an existing leader of an existing troop on Camp King. The invited troop appears in `trip_troops` with `status='invited'` until that troop's leader accepts (FEAT-024) or declines. Invitations are leader-to-leader only, never to sub-profiles directly.

## Roles & permissions

- **Trip creator**: can invite. No quota in v1 beyond a per-trip rate limit (e.g., 5 invites / minute) for spam prevention.
- **Trip co-leader**: can invite, same rate limit.
- **Other trip members** (joined-troop sub-profiles or non-co-leader joined-troop leaders): cannot invite. The Invite action is hidden from their UI.
- **Invited troop's leader**: can accept or decline. No one else in the invited troop can accept (FEAT-024) — the leader is the gatekeeper for their troop's participation.

## Surfaces

- **Trip detail screen → "Invite troops"** action: visible to creator + co-leaders only.
- **Invite picker** modal: search field at top, list of plausible recipients drawn from the inviter's contact list (only registered Camp King profiles surface as picker rows). "Add by phone number" entry as a fallback if the recipient isn't in the inviter's contacts yet.
- **Pending invitations section** within the trip detail: shows currently-invited troops with `status='invited'`. Inviter can withdraw a pending invite.
- **Recipient's Trips list** (FEAT-019): the trip appears in the "Invited" group with the inviter's troop name and trip metadata.

## Behaviour

1. Inviter (creator or co-leader) navigates to trip detail → "Invite troops" → picker opens.
2. Picker contents:
   - Recent contacts who are registered leaders of troops not yet on this trip.
   - Search by display name or phone number.
   - "Add by phone number" affordance: enter the leader's verified phone → if a troop with that leader exists, send invite; if not, show "No Camp King leader matches that number" (no SMS / external invitation flow in v1).
3. Inviter taps a recipient → confirmation: "Invite [Leader display name]'s troop to [Trip name]? They'll be able to share contacts, see other members, and (if you allow) become a co-leader."
4. On confirm:
   - Server validates (rate limit; recipient is a leader; recipient's troop not already in `trip_troops`).
   - Insert `trip_troops (trip_id, troop_id=recipient's_troop, joined_by_profile_id=null_until_accept, status='invited', invited_at=now, invited_by_profile_id=inviter)`.
   - Realtime broadcast: recipient's Trips list refreshes with the new invitation.
   - Push notification: "New trip invitation from [Inviter display name]" to the recipient leader (FEAT-092 / FEAT-096).
5. **Withdraw invite**: inviter taps a pending invite → "Withdraw" → server deletes the `trip_troops` row. Recipient's invitation entry vanishes from their Trips list on next refresh.
6. **Bulk invite**: inviter selects multiple recipients in the picker → "Invite all." Server inserts N rows + sends N notifications. *(Open question 2.)*

## Data

Reads:
- `profiles` (recipients' display names / avatars).
- `troops` (recipient's troop).
- `trip_troops` (current trip membership, to filter already-invited from picker).
- Inviter's `contacts` + `contact_matches` (registered-profile-only contacts for the picker).

Writes:
- `trip_troops` (insert with `status='invited'`).
- Push notification payload (server-side; no client write).

## Edge cases

- **Invitee already on the trip** (accepted previously): picker hides them; if forced via direct API, server rejects with "Already a member."
- **Invitee is a leader of multiple troops** (currently impossible in v1 — see FEAT-001 open question 1). When v2 introduces multi-troop identities, this becomes "pick which troop the invitation is for."
- **Invitee declines** (FEAT-024): `trip_troops.status='declined'`. Inviter can re-invite, but a soft hint warns "[Leader] previously declined this invitation. Try anyway?" *(Open question 3.)*
- **Invitee blocks the inviter on a separate axis** (long-press block on a card from inviter): does the invitation still go through? Default: yes — block hides cards in feed but doesn't sever trip invitation paths in v1. *(Open question 4.)*
- **Network down at invite time**: inviter sees "Couldn't send invite. Try again." Insert is server-atomic; no half-state.
- **Trip ends while an invite is pending**: server auto-cleans pending `trip_troops` rows for ended trips; recipient sees "This trip ended before you could respond" briefly on next refresh, then the entry is gone.
- **Recipient leader changes phone number** between invitation and acceptance: invitation is keyed to `troop_id`, not phone, so it survives.
- **Rate limit**: 5 invites / minute / inviter, 50 / day / trip. Soft errors guide the user.

## Out of scope

- **Inviting non-registered users via SMS** (a "join Camp King to accept this invitation" link). Not v1; would require an external messaging integration. *(Open question 5.)*
- **Inviting individual sub-profiles directly** (without going through the leader). Not v1; preserves the leader-controls-troop-participation invariant.
- **Public / discoverable trips** that any troop can self-join. FEAT-033 (deferred).
- **Group invitations** ("invite all troops attending Wind River 2026"). Not v1.

## Open questions

1. **Invitation expiry.** Should pending invitations auto-expire after N days? Default: 30 days. After that, recipient sees the entry with "Expired" and inviter can re-invite. *(product)*
2. **Bulk invite.** v1 yes or v1 no? Default: yes — common case is "invite the same 4 troops we always camp with." *(product, design)*
3. **Re-invite friction after a decline.** Block re-invite for N days vs. soft-warn vs. no friction. Default: soft-warn. *(product)*
4. **Block ⊕ trip invitation interaction.** Default: block does not prevent invites. Could be revisited if abuse patterns emerge. *(product)*
5. **External (non-registered) invite flow.** Tied to a broader "growth via invitation" question; out of scope for v1. *(product, growth)*
6. **Picker source.** Inviter's contacts (registered only) + free-form phone number lookup. Should we also include past trip co-attendees? Default: yes — a "Recent trip mates" section for convenience. *(design)*

## Cross-platform notes

- **Web**: invite picker is a modal dialog. Phone-number entry is a tel-type input.
- **iOS / Android**: invite picker is a presented bottom sheet. Native phone-number keyboard. Optionally: tap-to-add from system contacts (with permission), but only after matching against registered Camp King profiles to avoid leaking unregistered phone numbers.

## Verification

Trip-specific:

- **Step 20**: "Leader A invites troop 2 (whose leader is B). B sees an invitation entry in B's Trips list."

Proposed additions:

- Withdraw test: send invite, withdraw before accept; recipient's invitation entry disappears.
- Re-invite-after-decline test: B declines; A re-invites; soft-warn shown; B sees the new invitation.
- Rate-limit test: send 6 invites in 60 seconds → 6th rejected with rate-limit error.
- Auto-expire test: send invite, fast-forward 30 days (test harness) → invitation marked expired.
