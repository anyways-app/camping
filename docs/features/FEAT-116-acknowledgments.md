---
id: FEAT-116
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-113, FEAT-114, FEAT-115, FEAT-117]
last_reviewed: 2026-05-04
---

# FEAT-116: Acknowledgments

## Summary

Per-message ACK is its own message type (`message_type=0x02`) carrying the original `MessageID` of the message being acknowledged. ACKs propagate back through the mesh and update the original sender's UI ("Delivered to Maya"). **Broadcast messages do not generate ACKs** — that would flood the network at scale. **Direct messages generate ACKs only when the sender requests** (compose-time toggle per FEAT-114). ACK is fire-and-forget; ACKs themselves do not generate ACK-of-ACK.

## Roles & permissions

- **Receiver (final destination)**: emits the ACK upon delivering a direct message that requested ACK.
- **Sender (original)**: receives the ACK and updates UI to "delivered."
- **Intermediate relays**: relay ACKs by the same FEAT-115 rules as any other direct message, with the recipient field set to the original sender's MemberID.

## Surfaces

- No standalone UI. ACK status is rendered in the original sender's per-message UI:
  - "Sending…" (in outbound queue, not yet advertised).
  - "Sent" (advertised at least once).
  - "Delivered to [recipient display name]" (ACK received).
  - "Delivery uncertain" (no ACK after the FEAT-117 retention window — 24h).

## Behaviour

### ACK emission (receiver side)

1. Receiver finishes the FEAT-115 receive flow for a direct message addressed to self where the original sender requested ACK.
2. Compose an ACK message:
   - `message_type = 0x02` (ACK).
   - `recipient_member_id = original sender's MemberID`.
   - `dictionary_index = 0` (unused for ACKs; set to 0 for protocol cleanliness).
   - `param1 = upper 16 bits of the original full MessageID`.
   - `param2 = middle 16 bits of the original full MessageID`.
   - The remaining 16 bits of the original MessageID encoded as the ACK's own MessageID's lower 16 bits — *no, wait, this is fragile. Better: the ACK's encrypted blob carries the original 6-byte MessageID in a dedicated field overlapping the dictionary_index + param1 + param2 region.* The exact layout for ACK is locked in FEAT-113's `message_type=0x02` payload variant. *(Open question 1.)*
3. AES-CCM encrypt with current TripKey at current epoch.
4. Add to outbound queue (FEAT-117).
5. Persist tagged as "outbound ACK for `<original MessageID>`."

### ACK reception (original sender side)

1. Receiver of an inbound message where `message_type == 0x02` (ACK):
2. Decrypt and decode normally.
3. Read the original MessageID from the ACK's payload.
4. Look up the original message in local store (FEAT-117) by `(trip_id, original_message_id)`.
5. If found and currently in pending-ACK state: mark "delivered" with timestamp; trigger UI update.
6. If found but already delivered (e.g. duplicate ACK via two relay paths): no-op.
7. If not found (the original message was evicted from store before ACK arrived): log as "ACK for unknown message" — surface in debug log only, not UI.

### No ACK-of-ACK

- ACKs do not request ACKs. The `requires_ack` flag is reset to false on the ACK message.
- No retry on ACK loss — if the sender doesn't receive an ACK within the retention window (FEAT-117), they see "delivery uncertain" but the original message was already sent / persisted; the receiver got it (probably) and the next online sync will reconcile.

### Broadcast suppression

- Broadcasts (`recipient == 0xFF`) **never** trigger ACKs, regardless of any flag. At v1 (20 members), 20 ACKs per broadcast across the mesh would be tractable but not at v2 (100 members). Keeping the rule strict in Mesh-v1 simplifies relay logic.

## Data

Reads:
- Inbound message stream (decrypted, FEAT-115).
- Outbound queue + local store (FEAT-117).

Writes:
- Outbound advertisement queue (ACK messages).
- Local store: update original-message status from "pending-ACK" to "delivered," with delivered-at timestamp.
- UI state: trigger render of the sender's per-message status indicator.

## Edge cases

- **Duplicate ACK via two relay paths**: dedup by ACK's own MessageID at FEAT-115 level. The original-message status is updated only once.
- **ACK arrives after original message was evicted from local store** (FEAT-117 24h LRU): logged as orphan ACK; UI cannot update because the entry is gone. User experience: the message status was last seen as "Sent" before eviction; now it's not in the activity log. Acceptable given the 24h window.
- **ACK sent by receiver but receiver immediately leaves the trip / loses Trip credentials**: the ACK is in the outbound queue; if the receiver hasn't yet transmitted the ACK fragment, it's lost. Sender will see "delivery uncertain." Acceptable.
- **Receiver's `Mesh send` gate is off but `Mesh receive` is on**: receiver cannot emit the ACK (no MemberID for sending). Sender will never see "delivered." UI: graceful — show "Sent" indefinitely; do not promote to "delivery uncertain" if we know via roster that the recipient's send is gated off. *(Open question 2.)*
- **Original sender goes offline before ACK arrives**: ACK is delivered to the sender's local store on next BLE encounter; UI updates on next render of the activity log.
- **ACK reaches sender but sender's app was killed**: persisted ACK update applies on next app launch.
- **Relay storm at high message volume**: ACKs share queue with original messages; if queue fills (1,000 entries), LRU eviction may drop ACKs. Tradeoff: ACK delivery is best-effort. *(Open question 3.)*

## Out of scope

- Read receipts / "seen" indicators. Out of scope; the recipient's user reading the message is a UI event, not a wire event.
- Negative-ACK / NACK ("I rejected your message"). Mesh-v1 has no concept; rejection is silent (e.g. epoch-mismatch drops at FEAT-115 step 4).
- ACK aggregation / batching (one ACK confirming multiple messages). Mesh-v1 sends one ACK per requested-ACK message. Aggregation is a Mesh-v2 candidate.

## Open questions

1. **ACK payload byte layout.** The exact placement of the original 48-bit MessageID inside the ACK's encrypted blob. Default proposed: replace dictionary_index (2B) + param1 (2B) + param2 (2B) = 6 bytes with the original MessageID. Locks in FEAT-113. *(eng)*
2. **Send-gated recipients.** When the recipient's `Mesh send` gate is off, the sender will never see ACK. Should the UI be smart about this and show "Sent (no ACK possible — recipient cannot send)" instead of "Sent → delivery uncertain"? Default: yes; the roster carries this info. *(design)*
3. **Queue prioritisation under storm.** Should ACKs receive priority over broadcasts? Default: FIFO; revisit if field testing shows queue saturation. *(eng)*
4. **Default ACK toggle.** Default for direct messages: ACK off (fire-and-forget). Default for important system messages (e.g. revocation): the underlying message type encodes its own ACK requirements; user doesn't choose. Confirm. *(product)*

## Cross-platform notes

No platform divergence — ACK is a wire-protocol feature, not a UI feature. The UI status indicator follows each platform's standard chat-message-status pattern (single check, double check, etc.).

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification: covered indirectly by Steps 28 (Range), 29 (Churn), 31 (Cross-platform), 32 (Persistence) — all rely on functional ACKing for direct messages.

Proposed additions:

- ACK happy path: A sends direct to B with ACK-required; verify A's UI moves to "Delivered to B" after one mesh round-trip.
- Broadcast-suppresses-ACK test: A broadcasts with the ACK flag set; verify no ACK is emitted (the flag is silently ignored for broadcasts).
- Duplicate-ACK dedup: B emits ACK; A receives via two relay paths; verify only one UI status update.
- Send-gated-recipient test: A sends to B who has Mesh send off; verify A's UI shows the "no ACK possible" state without timing out to "delivery uncertain."
- Queue-eviction test: saturate the outbound queue; verify ACK drops are documented with a debug-log entry but don't crash.
