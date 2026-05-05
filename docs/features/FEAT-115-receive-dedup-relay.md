---
id: FEAT-115
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-007, FEAT-113, FEAT-117, FEAT-119]
last_reviewed: 2026-05-04
---

# FEAT-115: Receive, dedup, multi-hop relay, TTL

## Summary

The receive-side counterpart to FEAT-114. On scanning a matching service UUID payload, the device parses the cleartext header, decrypts with the appropriate-epoch TripKey, deduplicates against the local cache, and either delivers (if the recipient is self or broadcast) and / or relays (if recipient ≠ self and TTL > 0). Every Trip device with `Mesh receive` (FEAT-007) on participates as a relay. Multi-hop relay is automatic — no user action.

## Roles & permissions

- **Any Trip member's device with `Mesh receive` gate (FEAT-007) on AND a MemberID issued at bootstrap (FEAT-111)**: receives. If `Mesh receive` is off but `Mesh send` is on, the device can transmit but ignores all incoming traffic — niche but valid.
- **Devices acting as relays**: any device that's a Trip member with `Mesh receive` on. Relay is automatic and does not require `Mesh send` (relay is a separate behaviour from authorship — confirm).
- *(Open question 1: should relay require `Mesh send`?)*

## Surfaces

- No direct UI surface — receive runs as a background service per FEAT-112.
- Received messages surface in:
  - Trip detail screen activity log (timeline of recent mesh messages).
  - Per-message detail sheet with sender, dictionary entry, parameters, optional location on a mini-map.
  - Optional system-level notification (configurable per FEAT-007 / per-Trip notification preferences — *Open question 2*).

## Behaviour

On scanning a service UUID matching the Camp King mesh advertisement profile:

1. **Parse cleartext header** (5 bytes per FEAT-113):
   - Reject if `version > 1` (forward-incompatible).
   - Reject if `key_epoch < current_epoch - 1` (too stale; rotation already replaced this).
   - Reject if any reserved bit set.
2. **Locate the right TripKey**:
   - If `key_epoch == current_epoch`: use current TripKey.
   - If `key_epoch == current_epoch - 1`: use previous TripKey (kept in memory for the eventual-consistency window after a rotation, FEAT-119).
3. **Multi-fragment reassembly** (per FEAT-113):
   - If is-continuation flag set, buffer this fragment by truncated MessageID and `fragment_seq`.
   - Reassemble when all fragments 0..N-1 are present.
   - 30-second buffer timeout.
4. **AES-CCM decrypt** the (reassembled) blob with the located TripKey:
   - On MAC failure: drop. Not for this Trip, or stale-epoch we couldn't locate the right key.
5. **Dedup**:
   - Look up the full MessageID (from the now-decrypted blob) in the dedup cache (LRU 4,096).
   - If hit: drop. Already seen.
   - If miss: insert into cache.
6. **Deliver / relay decision**:
   - If `recipient_member_id == self_member_id` OR `recipient_member_id == 0xFF` (broadcast):
     - Deliver to UI (Trip detail activity log).
     - Persist to local store (FEAT-117).
     - If the message is a direct (non-broadcast) message AND its `requires_ack` flag is set (encoded in the message_type bits or a header flag — *confirm in FEAT-113*), emit an ACK (FEAT-116).
     - If the message is `REVOKE_AND_ROTATE` (`message_type=0x05`), invoke the revocation handler (FEAT-119).
     - If `recipient == self_member_id` (i.e. addressed specifically to me, not broadcast), do NOT relay further (the message has reached its destination).
     - If `recipient == 0xFF` (broadcast), continue to relay (broadcasts must reach all members).
   - If `recipient_member_id != self_member_id` (a direct message addressed to someone else):
     - If `TTL > 0`:
       - Decrement TTL by 1.
       - Re-encrypt the blob with the current TripKey at current epoch (CCM is not malleable on the TTL byte without the key; relay devices do hold the key).
       - Add the re-encrypted blob to the outbound advertisement queue.
     - If `TTL == 0`: drop without relay.
7. **Relay queue management**:
   - Relayed messages cycle through the device's outbound queue (FEAT-117) alongside originally-authored messages.
   - Relays do NOT generate ACKs (only the final receiver does, and only for direct messages).

## Data

Reads:
- Inbound BLE advertisements (continuous scan; FEAT-120 governs duty cycle).
- Local TripKey storage (Keychain / Keystore). May hold up to 2 epochs concurrently (current + previous).
- Dedup cache (in-memory LRU).
- Reassembly buffer (in-memory, with 30s TTL).
- `profile_feature_gates` for the local active profile (`Mesh receive` gate must be on).

Writes:
- Dedup cache: insert on miss.
- Reassembly buffer: insert on continuation fragment, evict on completion or timeout.
- Outbound advertisement queue (relay path).
- Local store (FEAT-117): persist on delivery.
- ACK emission via FEAT-116.

## Edge cases

- **Replay attack**: same MessageID broadcast multiple times. Caught by dedup (step 5). MessageID is 48-bit random; collisions inside a Trip's lifetime are negligible.
- **Re-broadcast by sender** (FEAT-117 store-and-forward retry path): same MessageID; receivers dedup on first instance.
- **Reassembly partial**: 30s timeout. Sender-side store-and-forward will retry the full message.
- **Relay loop**: TTL prevents infinite loops. Worst case: a TTL=5 message visits up to 5 relays before drop.
- **Relay without `Mesh send` gate**: depends on the open question; default proposed is "relay requires only `Mesh receive`," because relay is not authorship — the relayed bytes are the original sender's authored bytes. Clarify per OQ 1.
- **Relay overload**: a device near many active senders may queue messages faster than it can advertise. FEAT-117 LRU eviction at 1,000 entries handles this; lower-priority broadcasts evict first if collision.
- **Stale-epoch decryption** during the eventual-consistency window: legitimate; explicitly allowed for `current_epoch - 1`.
- **Decryption succeeds at stale epoch but the message is from a now-revoked member**: the message is processed normally for delivery (the receiving honest device hasn't yet learned the sender was revoked). After rotation propagates, future messages from that sender fail (epoch mismatch). This is the documented FEAT-119 eventual-consistency limit.
- **Local-receiver crash mid-relay**: the persisted relay queue (FEAT-117) survives; on relaunch, relay continues from where it left off.

## Out of scope

- ACK emission and propagation — FEAT-116.
- Revocation message handling — FEAT-119 (handled when `message_type == 0x05`).
- Application-layer dictionary rendering — the receive path delivers the raw decoded message to FEAT-114's activity log; rendering is FEAT-114's UI surface.
- Cross-Trip relay — there is no such thing; `TripKey` mismatch causes MAC failure, which causes drop at step 4.

## Open questions

1. **Does relay require `Mesh send` gate, or only `Mesh receive`?** Default: only `Mesh receive`. Rationale: relay is forwarding-without-authorship; the user has consented to mesh participation by joining the Trip with `Mesh receive` on, and forwarding doesn't expose new data. *(product, security)*
2. **Per-message system notifications.** Should incoming messages surface as system push-style notifications, or only inside the Trip activity log? Default: in-app log only; an opt-in "notify me on direct messages" toggle in Trip settings. *(product, design)*
3. **Relay queue prioritisation.** All messages equal, or are direct messages prioritised over broadcasts at relay time? Default: FIFO. *(eng)*
4. **MAC-failure suspicion threshold.** Repeated MAC failures from a particular peer signature. Default v1: not tracked. (Cross-references FEAT-113 OQ 2.) *(security)*
5. **Receive-while-paused-for-foreground.** If the user navigates away from the Trip detail (but the foreground service is still running), do receives still register in the activity log? Default: yes — service runs regardless of UI navigation; UI just renders cached state. *(eng)*

## Cross-platform notes

- **iOS**: scan via `CBCentralManager.scanForPeripherals(withServices:)` with the Camp King mesh service UUID prefix. CCM decryption via `CryptoKit` / `CommonCrypto`. Receive runs as part of the mesh foreground/background-mode service.
- **Android**: scan via `BluetoothLeScanner.startScan(filters, settings, callback)`. Foreground service required for sustained scan. CCM via Conscrypt.

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification:

- **Step 28 (Range test)**: depends on relay correctness for messages to traverse the 150m line.
- **Step 29 (Group churn test)**: backlogged broadcasts must reach new joiners — depends on receive + dedup.
- **Step 30 (Revocation forward-secrecy)**: depends on stale-epoch rejection.

Proposed additions:

- Replay-drop test: same MessageID broadcast 3× rapidly; only one delivery.
- TTL-decrement-and-re-encrypt test: relay through device B; receiver C sees TTL=N-1 and decrypts cleanly (CCM nonce uniqueness preserved through re-encryption).
- Stale-epoch reject test: receiver at epoch=5, message at epoch=3 → drop without decrypt attempt.
- Relay-without-Mesh-send-gate test: device with Mesh receive on but Mesh send off; verify it still relays incoming messages.
- Reassembly-timeout test: drop one of N fragments; verify 30s timeout evicts the buffer.
- Direct-message-no-relay test: receiver is the recipient; verify it does NOT add a relay copy to its outbound queue.
