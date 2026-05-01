---
id: FEAT-061
area: Card Interactions
release: v1
status: Spec'd
dependencies: [FEAT-014, FEAT-017, FEAT-027, FEAT-039, FEAT-060]
last_reviewed: 2026-05-01
---

# FEAT-061: Forward picker modal

## Summary

When a profile swipes up on a card to forward it (FEAT-060), a modal contact picker opens so they can choose a recipient. The recipient receives a new card row with the white-dotted forwarded border (FEAT-064) and the original sender's username pinned. The picker is the v1 destination chooser for forwarding; no inline forwarding, no multi-recipient broadcast in v1.

## Roles & permissions

- **Any profile with feed access** can swipe up on a card to trigger the picker, *subject to the per-sub-profile* "Forward outside the troop" *gate* (FEAT-007).
- **Sub-profile with the gate OFF**: picker still opens, but the recipient list is filtered to *in-troop profiles only* — other profiles in the same troop. External contacts and trip members are hidden, with an explanatory empty-state if the in-troop list is also empty.
- **Sub-profile with the gate ON**: full picker — in-troop profiles, direct contacts (mutual matches), trip members on currently active trips.
- **Leader profile**: full picker; the gate doesn't apply to leaders.
- **Block / report**: a profile blocked by the recipient is silently filtered from showing as a forward destination. A profile blocked by the *sender* never appears in the sender's picker either.

## Surfaces

- **Modal overlay on top of the feed view.**
  - Mobile: bottom sheet that slides up from the bottom edge, takes ~75% of screen height, dismissible by swipe-down or backdrop tap.
  - Desktop / web: centred dialog, ~480px wide, dismissible by Esc or backdrop click.
- Triggered exclusively by the swipe-up gesture on a card (FEAT-060). Not reachable from the long-press menu — gesture XOR menu rule.

## Behaviour

1. Profile swipes up on a card. The card UI shows a brief "Forward" pulse / preview animation (currently a toast in the M1 web shell).
2. The picker modal opens. Top of the modal:
   - The card being forwarded shown as a small thumbnail (image + author name + first ~40 chars of caption) so the user knows what they're sending.
   - A search field below the thumbnail, autofocused. Typing filters the recipient list live by display-name substring.
3. Recipient list, segmented in this order:
   1. **In your troop** — other profiles in the same troop, alphabetised. Always visible regardless of any feature gate.
   2. **Direct contacts** — registered profiles the sender has a mutual match with (FEAT-014). Hidden if "Forward outside the troop" gate is off.
   3. **Trip contacts** — registered profiles on a currently *active* trip the sender is a member of. Hidden if "Forward outside the troop" gate is off, since trip contacts count as "outside the troop" per the strict-gate rule (FEAT-031).
4. Each row: avatar + display name + a small badge indicating the segment ("Troop", "Friend", "Trip: Wind River 2026"). Tap a row.
5. Confirmation: "Forward to Sam? [Cancel] [Forward]" centred over the dimmed list.
   - On `Forward`:
     - Server: insert a new row into `cards` with `author_id = sender's profile_id`, `forwarded_from_profile_id = original card's author_id`, and the original card's `image_url`, `caption_text`, `caption_mode`, `overlay_layout`, `image_origin`, `tags`, `flair_template_id` carried over verbatim. Increment `forward_count` on the original card.
     - Realtime: recipient's feed channel fires; recipient sees the card on next refresh (or immediately if subscribed).
     - Client: modal closes, brief confirmation toast "Forwarded to Sam."
   - On `Cancel`: returns to the recipient list.
6. Recipient sees the forwarded card with the white-dotted border (FEAT-064 forwarded border kind) and a header pin "↪ via [sender display name]". Tapping the pin reveals a sheet with the original author's display name + the forward chain length.

## Data

Reads:
- `profiles` (in-troop roster, display names, avatars).
- `contact_matches` for direct-contact list.
- `troop_shared_contacts` and `trip_shared_contacts` for visibility into shared lists (informational only — these *don't* appear in the picker; only registered profiles do).
- `trip_troops` + `trip_profile_visibility` for trip-member roster.
- `profile_blocks` to filter blocked relationships.
- The card being forwarded (full row).

Writes:
- New row in `cards` with `forwarded_from_profile_id` set.
- `cards.forward_count` increment on the original card (atomic via Edge Function or SQL increment).

No new schema implied.

## Edge cases

- **Empty picker.** Sub-profile with gate off and only one other profile in the troop (or zero), and no in-troop overlap: empty state — "No recipients available. Ask your troop leader to enable forwarding outside the troop." Provides one tap action: "Open settings" → deep-link to the sub-profile's settings panel showing the gate (visible to the leader only).
- **Search returns no matches.** Empty search-result state: "No matches" + "Add contact" hint linking to FEAT-016 contact import.
- **Recipient is offline.** Forward is a server-side write; recipient sees the card on next sync. No client-side delivery guarantee.
- **Network failure mid-forward.** Client retries with small exponential backoff (3 attempts). On persistent failure: error toast "Forward failed — try again." Modal re-opens at the confirmation step. No card row created.
- **User backs out of the modal between steps 4 and 5.** No card created. The original card's `forward_count` is unchanged.
- **Card is deleted by the original author between the time the user opens the picker and confirms.** Server returns a 404 on the forward attempt; client shows "This card is no longer available" and closes the modal. No row created.
- **Recipient blocks the sender after the picker opens but before confirm.** Server enforces the block on insert and returns a soft error. Client shows "Cannot forward to this recipient" and dims the row.
- **Forward of a forwarded card.** Allowed. The new card's `forwarded_from_profile_id` references *the most recent author* (the one who forwarded to the current sender), not the original. The forward chain is reconstructable via repeated joins. *(Open question 4.)*
- **Long captions or large images on slow networks.** The picker shows the thumbnail at low res from a cached version of the card; the actual forward writes the canonical `image_url` reference, which is unchanged.
- **Rate limit / spam protection.** A profile attempting >N forwards/minute is throttled with a soft error. *(Open question 3 — N TBD.)*

## Out of scope

- **Multi-recipient forward** (forward to several profiles in one action). Default v1: single recipient only. *(Open question 1.)*
- **Forward with annotation** (commenting on the forward). Tied to DMs (FEAT-063, deferred).
- **Forward to non-Camp-King contacts via SMS / Apple Messages / Android Share Sheet.** Not v1. Recipient must be a registered Camp King profile that's already discoverable to the sender.
- **Scheduled forwarding** (forward later). Not planned.
- **Forwarding edits** (recipient sees a modified caption / overlay). Not v1; the forwarded card is identical to the original modulo border and pin.

## Open questions

1. **Multi-recipient.** Should v1 allow forwarding to N recipients in one action? Default: no, single only. *(product)*
2. **Confirmation step required, or per-user preference?** Default: required for v1 to prevent accidental forwards. Could become a sub-profile gate later. *(product)*
3. **Forward rate limit.** N forwards/minute beyond which a profile is throttled. Default proposed: 10/minute soft, 60/hour hard. *(product, ops)*
4. **Forward chain length cap.** Should there be a maximum chain depth? Default: no cap in v1, but `forwarded_from_profile_id` only ever names the most recent forwarder; the full chain isn't user-visible. *(product)*
5. **What lives in the "↪ via" pin reveal sheet?** Original author display name + chain length, or full chain history with avatars? *(design)*
6. **Trip-segment label.** When the sender is on multiple active trips, do trip recipients group under "Trip contacts" or split per-trip with the trip name as a header? Default: split per-trip; one header per trip. *(design)*
7. **Sort order within each segment.** Alphabetical, or recency-of-interaction first? Default: alphabetical for v1; recency comes with usage data later. *(product)*

## Cross-platform notes

- **Web**: dialog component (Radix UI primitive per `10-web.md`). Keyboard nav: arrow keys move selection, Enter confirms forward, Esc cancels at any step. Right-click on a card does NOT open the picker — right-click is reserved for the long-press menu.
- **iOS**: half-modal (UIModalPresentationStyle.formSheet equivalent in React Native). Drag handle at top. Swipe-down dismisses. Haptic tap on confirm.
- **Android**: bottom sheet (Material Components). Hardware Back button dismisses. No haptic on confirm by default.

## Verification

References from [`00-core.md` Verification](../spec/00-core.md#verification-cross-platform-end-to-end):

- **Step 5** of cross-platform verification: "Profile B sees the card with dark-green border + double-line pattern. Long-press shows firewood / match / bookmark / block / report. Swipe-down logs LOL; *swipe-up opens forward picker*."
- **Step 6**: "Profile B forwards the card to profile C (leader of a third troop). C sees it with white-border dotted pattern and B's username pinned."

Trip-specific:

- **Step 25** (trip verification): "Confirm a trip-shared contact appears as a *match* (dark-green direct-contact border) only when both that contact and the viewing trip member have uploaded each other and are both registered — not merely because the contact is in the trip-shared list." (Forwarding behaviour to trip-shared contacts is gated identically.)

Proposed additions (not yet in spec, surface for next spec sync):

- Sub-profile with "Forward outside the troop" gate off attempts to forward to a fellow trip member: confirm the recipient does NOT appear in the picker, even though they're a trip co-member.
- Forward chain test: forward a card three times A → B → C → D; confirm each recipient sees the white-dotted border and the most-recent-forwarder's display name pinned.
- Empty-state test: sub-profile with gate off and zero in-troop peers — picker shows the "Ask your troop leader" empty state; no other recipients are revealed.
- Rate-limit test: forward 11 cards within 60 seconds; confirm the 11th is throttled with a soft error.
