---
id: FEAT-113
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-111, FEAT-119, FEAT-120]
last_reviewed: 2026-05-04
---

# FEAT-113: Wire protocol & crypto envelope

## Summary

The on-the-wire byte layout, encryption, and decryption rules for every offline-mesh message. Holds the cleartext header (version + flags, key-epoch, truncated MessageID), the AES-CCM-encrypted blob (full MessageID, sender/recipient MemberIDs, TTL, message_type, dictionary index + params, optional geolocation), and the multi-service-UUID chaining + reassembly rules used for messages that exceed the per-service-UUID payload budget. Reviewable by a security engineer; **single FEAT for wire format + crypto** because they are co-designed and round-tripped together.

## Roles & permissions

- This is a protocol-internal FEAT; no user-facing roles.
- Encoders / decoders run on every Trip-member device that has both `Mesh send` (FEAT-007 row) and `Mesh receive` enabled, respectively.

## Surfaces

- Library / module-internal — no UI. Implementations live in:
  - iOS: `MeshProtocol` Swift module (Camp King app).
  - Android: `mesh.protocol` Kotlin package (Camp King app).
  - Optional cross-platform reference test vectors live in `packages/mesh-protocol-test-vectors/` (test asset).

## Behaviour

### Cleartext header (5 bytes, in-the-clear)

```
Offset  Bytes  Field
0       1      version + flags
                 bits 0-3: version (currently 1)
                 bit 4:    has-geolocation flag
                 bit 5:    is-continuation flag (multi-UUID chaining)
                 bit 6:    is-final-fragment flag
                 bit 7:    reserved (must be 0 in Mesh-v1)
1       1      key_epoch (current TripKey generation; 0 invalid; receivers reject epoch < current-1)
2       3      truncated MessageID (low 24 bits of the full 48-bit MessageID; full inside the encrypted blob)
```

### Encrypted blob (AES-CCM with TripKey at indicated epoch)

Plaintext layout, total ~12-21 bytes depending on message type, plus the AES-CCM 4-byte MAC:

```
Offset  Bytes  Field
0       6      full MessageID (random per message; primary dedup key)
6       1      sender MemberID
7       1      recipient MemberID (0xFF = broadcast)
8       1      TTL (default 5; decremented on relay; drop at 0)
9       1      message_type
                 0x01 TEXT          (dictionary entry + optional params)
                 0x02 ACK           (carries original MessageID)
                 0x03 LOCATION      (dictionary index = location preset; geolocation in payload)
                 0x04 PRESENCE      (heartbeat; broadcast only)
                 0x05 REVOKE_AND_ROTATE   (FEAT-119; multi-UUID chained)
                 0x06 EXTENSION     (reserved for v1.x in-protocol extensions)
10      2      dictionary_index (0..1023 base, 1024..1279 extension)
12      2      param1
14      2      param2
16      6      geolocation (lat 3B + lon 3B, ~5m resolution; present iff has-geolocation flag set)
```

For `REVOKE_AND_ROTATE` (`message_type=0x05`), the encrypted blob's payload after the common header is replaced with the rotation envelope set; see FEAT-119.

### AES-CCM parameters

- **Key**: TripKey at the epoch indicated in the cleartext header.
- **Nonce**: 13 bytes constructed as `MemberID (1B) || MessageID (6B) || epoch (1B) || fragment_seq (1B) || zero (4B)`. Uniqueness derives from MessageID being random per message and epoch being monotonic.
- **MAC length**: 4 bytes (CCM's M parameter = 4). Tradeoff: short MAC is appropriate for short ephemeral messages over BLE; FEAT-118 / FEAT-119 may upgrade to 8-byte MAC for the rotation message specifically. *(Open question 1.)*
- **AAD**: the 5-byte cleartext header.

### Service-UUID encoding

Each 128-bit service UUID carries 16 bytes of payload (the full UUID *is* the payload, with no further service-UUID semantics). With the 5-byte cleartext header, **~11 bytes of encrypted-blob plaintext fit in a single service UUID after the 4-byte MAC**. Most Mesh-v1 messages chain across 2-3 service UUIDs.

iOS supports advertising multiple service UUIDs simultaneously in one advertisement payload; Android does too. A device emits up to ~6 UUIDs per advertisement before LE advertising data overflow. Longer messages (`REVOKE_AND_ROTATE` at ~1 KB / 64 UUIDs) chain across multiple advertise cycles.

### Multi-UUID chaining + reassembly

When a message is too large for a single service UUID:

1. Sender splits the message into N fragments, where each fragment fits in one service UUID's encrypted-blob budget.
2. Each fragment carries a `fragment_seq` byte (0..N-1) in the AES-CCM nonce. Fragments share the same `MessageID` (in the cleartext header truncated form, and in the first fragment's encrypted blob full form).
3. The is-continuation flag is set on fragments 1..N-1; the is-final-fragment flag is set on fragment N-1.
4. Receiver collects fragments by truncated MessageID; reassembles when all sequence numbers 0..N-1 are present; *then* runs AES-CCM verification on the reassembled plaintext.
5. Reassembly buffer per (sender MemberID, MessageID): max 64 fragments, 30-second timeout. Drop on timeout.

### Dedup logic

- Receiver maintains a sliding-window dedup cache keyed by full MessageID.
- Cache size: 4,096 entries (LRU). At Mesh-v1 scale (20 members × ~1 message/minute average), this is many minutes of history.
- Drop on cache hit before relay or delivery.

### TTL semantics

- Default TTL = 5 hops (covers a 5-device daisy chain, ample for 20-device Trips).
- On relay, decrement TTL by 1 (in the encrypted blob). Re-encrypt the blob (CCM is not malleable on the TTL byte without the key — relay devices do hold the key, so re-encryption is straightforward).
- TTL = 0 → drop without relay or delivery.
- TTL = 7 maximum on transmit (allow oversized for extreme conditions; receivers still drop at 0).

## Data

Reads:
- TripKey at current epoch (Keychain / Keystore).
- Sender Ed25519 private key (only for FEAT-119 `REVOKE_AND_ROTATE` issuance).

Writes:
- Outbound queue (FEAT-117).
- Receive dedup cache (in-memory).
- Reassembly buffer (in-memory, with 30 s TTL).

## Edge cases

- **Cleartext header validation failure** (version > 1, reserved bit set, etc.): drop without attempting decryption.
- **Stale epoch** (`key_epoch < current_epoch - 1`): drop without attempting decryption.
- **In-flight epoch lag** (`key_epoch == current_epoch - 1`): allow once during the eventual-consistency window after a rotation; receiver must hold the previous epoch's TripKey for at least the rotation-broadcast-cycle period (FEAT-119).
- **MAC failure**: drop. Multiple consecutive MAC failures from a single peer are not flagged as suspicious in v1 — mesh radios are noisy and casual MAC failures are expected. *(Open question 2.)*
- **Reassembly timeout**: 30s; partial fragments are evicted. The original sender will rebroadcast if the message was important enough (FEAT-117 store-and-forward).
- **Fragment loss**: triggers reassembly timeout above. Sender retries whole message.
- **MessageID collision**: 48-bit random space; collision probability is ~2^-24 within a single Trip's lifetime even at high message volumes. Acceptable. *(security review item)*

## Out of scope

- Application-layer presentation (rendering dictionary entries with their parameters) — handled by FEAT-114 / FEAT-115 UI surfaces.
- Cross-Trip message handling — there is no such thing; each Trip's mesh is isolated by TripKey.
- Web-platform mesh participation — web does not participate.
- Wi-Fi Aware / NAN as alternative transport — Mesh-v2.

## Open questions

1. **AES-CCM MAC length tradeoff.** 4 bytes is short. Acceptable for ephemeral messages, debatable for `REVOKE_AND_ROTATE`. Default: 4 bytes uniformly; revisit if security review pushes back. *(security)*
2. **Suspicious-peer detection.** Consecutive MAC failures from a peer could indicate jamming, replay, or malicious activity. Should the receiver track and surface? Default v1: no; relay anyway. *(security)*
3. **Reassembly timeout tuning.** 30s is a guess; depends on advertise duty cycle and BLE radio variability. Tune in field-test phase. *(eng)*
4. **TTL hard ceiling.** 7 vs. 5 vs. 10. Default: 7 transmit max, 5 default. *(eng)*
5. **Endianness.** All multi-byte fields little-endian (default for protocol cleanliness on x86 + ARM); confirm before locking. *(eng)*
6. **Test vectors.** Maintain a `packages/mesh-protocol-test-vectors/` with N round-trip test vectors (plaintext, key, expected ciphertext) for cross-platform conformance. Recommend: yes. *(eng)*

## Cross-platform notes

- **iOS**: AES-CCM via `CryptoKit` (specifically `AES.GCM.SealedBox`'s sibling — check exact API; may need `CommonCrypto` for CCM-specific). Service-UUID advertising via `CBPeripheralManager`; scanning via `CBCentralManager`. See `20-ios.md` § BLE mesh.
- **Android**: AES-CCM via `Cipher.getInstance("AES/CCM/NoPadding")` (Conscrypt). BLE 5 extended advertising path is FEAT-120 / Android-group-mode-only. See `30-android.md` § BLE mesh.
- **Endianness**: Locked to little-endian on the wire regardless of platform.

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification:

- **Step 31 (Cross-platform test)**: directly verifies wire-protocol interop.
- **Automated test floor**: TripKey lifecycle, key-epoch monotonic + stale rejection, sealed-box envelope round-trip — all rely on this FEAT's correctness.

Proposed additions:

- Cross-platform test-vector conformance: iOS encoder ↔ Android decoder round-trip on a battery of 50 vectors (every message type × representative parameters × geolocation on/off).
- Stale-epoch rejection: send message at epoch=2 to a receiver still at epoch=4 (current epoch is 5; 2 < 5-1 = 4, so reject). Confirm drop-without-decrypt.
- Reassembly happy path: send a `REVOKE_AND_ROTATE` (~1 KB / ~64 UUIDs); receiver reassembles correctly within timeout.
- Reassembly partial: drop one fragment; verify timeout triggers eviction; verify subsequent rebroadcast succeeds.
- TTL decrement: relay a TTL=3 message through a 4-device chain; verify final receiver sees TTL=0 and the message is delivered (or relay dropped at TTL=0, depending on the rule — confirm).
- Dedup test: receive the same message twice via two different relay paths; verify only one delivery.
