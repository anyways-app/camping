---
id: FEAT-117
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-114, FEAT-115, FEAT-116]
last_reviewed: 2026-05-04
---

# FEAT-117: Store-and-forward persistence

## Summary

All sent and relay-queued mesh messages persist to encrypted local storage on the device. Messages survive app kill, device sleep, and out-of-range periods. Eviction is bounded by three triggers: TTL-in-time = 24 hours from last attempt, OR ACK received, OR LRU when the queue exceeds 1,000 entries. Persistence is what makes the mesh tolerant of the realities of a campsite — devices wander out of range, batteries die, apps get killed by the OS.

## Roles & permissions

- This is a device-internal subsystem; no user-facing roles.
- Encrypted at rest using a key derived from the device's secure enclave (iOS Keychain / Android Keystore). The key is per-device, not per-Trip — rotation of the TripKey does NOT require re-encrypting the local store; the TripKey is itself a row in the encrypted store.

## Surfaces

- No direct UI. Surfaces indirectly via:
  - The Trip activity log showing recently-sent + received messages (queries the local store).
  - Per-message UI status (sending / sent / delivered / delivery-uncertain) reflecting the store's record of each message's state.
  - A "Mesh history" debug screen (developer-only or hidden behind a long-press on the trip name) showing the full local store contents for diagnostics.

## Behaviour

### Schema (per Trip member device)

Encrypted SQLite table (or equivalent on each platform), keyed for fast ID lookup and recency queries:

```
mesh_messages (
  trip_id           TEXT,
  message_id        BLOB(6) PRIMARY KEY,    -- the full 48-bit MessageID
  direction         TEXT,                   -- 'outbound', 'inbound', 'relay'
  message_type      INTEGER,                -- 1=TEXT, 2=ACK, 3=LOCATION, 4=PRESENCE, 5=REVOKE_AND_ROTATE
  sender_member_id  INTEGER,
  recipient_member_id INTEGER,              -- 0xFF for broadcast
  ttl               INTEGER,
  dictionary_index  INTEGER,
  param1            INTEGER,
  param2            INTEGER,
  geolocation       BLOB(6) NULL,
  created_at        TIMESTAMP,              -- when first seen / sent
  last_attempt_at   TIMESTAMP,              -- last time advertised (relay or original)
  status            TEXT,                   -- 'pending', 'sent', 'pending_ack', 'delivered', 'failed', 'evicted'
  ack_received_at   TIMESTAMP NULL
);
CREATE INDEX idx_status_attempt ON mesh_messages (status, last_attempt_at);
CREATE INDEX idx_trip_recency ON mesh_messages (trip_id, created_at DESC);
```

The DB file is encrypted using a key sourced from the secure enclave. Specific implementations:
- iOS: SQLCipher with a key from Keychain.
- Android: Room + SQLCipher (or AndroidX Security `EncryptedFile` for the DB blob).

### Lifecycle of an outbound message

1. **Insert at compose** (FEAT-114): `direction=outbound`, `status=pending`.
2. **Advertise**: status flips to `sent` after first successful advertise; `last_attempt_at` updates each cycle (each re-broadcast is a fresh attempt).
3. **Re-broadcast cadence**: every advertise cycle for the first 5 minutes; exponential backoff to once per hour after that. Stop after 24h (eviction threshold) or on ACK.
4. **ACK arrival** (FEAT-116): `status=delivered`, `ack_received_at=now`. Stop re-broadcasting.
5. **24h-TTL**: if `now() - last_attempt_at > 24h` AND `status` not in (`delivered`, `evicted`): flip to `failed`. Stop re-broadcasting.

### Lifecycle of an inbound (delivered) message

1. **Insert at receive** (FEAT-115 step 6): `direction=inbound`, `status=delivered` (delivery is the receive itself for inbound).
2. **Eviction**: same 24h TTL as outbound, OR LRU at the 1,000-entry total cap.

### Lifecycle of a relay message

1. **Insert at receive** (FEAT-115, recipient ≠ self, TTL > 0): `direction=relay`, `status=pending`.
2. **Advertise**: same cadence as outbound.
3. **Eviction**: same 24h TTL. Relays do not get ACKs (only the final recipient does); relay rows are evicted purely on age or LRU.

### Eviction rules

Three triggers, evaluated in priority order:

1. **ACK received**: outbound message moves to `delivered` and is retained until normal age-eviction (no early eviction on ACK; users may want to see delivered history).
2. **24h-TTL**: any row where `now() - last_attempt_at > 24h` and not already `delivered` flips to `failed`. Failed rows are retained until LRU eviction (so users can see delivery-uncertain history for a while).
3. **LRU at 1,000 entries**: when total row count would exceed 1,000, evict the oldest by `created_at`. Relays evict before originals when ages are tied. Status `failed` rows evict before `delivered` when ages are tied.

### Replay on relaunch

On app launch:

1. Open the encrypted DB.
2. Query `SELECT * FROM mesh_messages WHERE status IN ('pending', 'sent', 'pending_ack') AND trip_id = current_trip_id`.
3. Re-populate the in-memory advertisement queue.
4. Resume the re-broadcast cadence based on `last_attempt_at`.
5. Repopulate the dedup cache (FEAT-115) from recent inbound rows.

### Persistence across Trip end

When a Trip ends (FEAT-022 / FEAT-112 teardown):

- Outbound queue is drained with one final advertise pass.
- TripKey + Ed25519 private key are wiped from Keychain / Keystore.
- The mesh_messages rows for that Trip are **retained** (not wiped) for the read-only archive view. The rows are no longer transmittable since the TripKey is gone, but they're still readable in the activity log.

## Data

Reads:
- Encrypted SQLite (above schema).

Writes:
- Encrypted SQLite (insert / update on every send / receive / state change).

## Edge cases

- **Disk full**: if the encrypted DB cannot accept a new row, the new row is dropped and a debug-log entry is recorded. v1 does NOT proactively evict on near-full conditions; LRU at the 1,000-entry cap should keep the file under ~1 MB. *(Open question 1.)*
- **Corruption**: SQLite-level corruption (rare). On detection, the DB file is moved to `.corrupt` and a fresh empty DB is created. The user sees an empty mesh history; functional state recovers on next bootstrap. *(Open question 2.)*
- **Force-kill mid-write**: WAL / journal mode protects against partial writes. Worst case: the most recent message is rolled back on next open.
- **Trip end while messages are in `pending` state**: drained on Trip end (one final advertise pass). After Trip end, drained but undelivered messages remain in the local store as `failed`.
- **Multi-Trip on one device**: rows are partitioned by `trip_id`. A device active on two simultaneous Trips holds two TripKeys, one per Trip; the encrypted DB intermixes rows but they're filterable.
- **Device clock skew**: `created_at` and `last_attempt_at` are local-clock timestamps. If the user manually changes the device clock backwards, eviction rules behave erratically. v1 accepts this; production may use a monotonic clock for ages. *(Open question 3.)*

## Out of scope

- Cross-device sync of mesh history (e.g. seeing your own sent messages from another device). Mesh-v1 is per-device. Online resume eventually reconciles via the regular online card flow but mesh-history-per-se is not synced.
- Backup / export of mesh history. Out of scope.
- Forensic analysis tools. Debug-log only.

## Open questions

1. **Disk-full handling.** Drop silently vs. surface a UI warning. Default: silent drop with debug log; surface only if it happens repeatedly. *(eng, product)*
2. **Corruption-recovery UX.** Show a "Mesh history was lost due to storage corruption" warning, or silent. Default: silent — user did nothing wrong. *(product)*
3. **Monotonic-clock for ages.** Use `mach_absolute_time` (iOS) / `SystemClock.elapsedRealtime` (Android) for elapsed-since vs. wall clock for created_at. Default: yes for ages; no for created_at (display purposes). *(eng)*
4. **Eviction priority within 1,000-cap LRU.** Failed and relay rows evict first; broadcasts evict before direct messages. Refine as needed. *(eng)*
5. **Encrypted-DB key rotation.** The DB-encryption key is sourced from secure enclave; if the secure enclave migrates (rare), should we re-encrypt or just re-create? Default: re-create (lose history) since secure-enclave migration is itself rare. *(eng, security)*

## Cross-platform notes

- **iOS**: SQLCipher with key from `Security.framework` Keychain (per-device key, not iCloud-synced).
- **Android**: SQLCipher with key from Android Keystore (`KeyGenParameterSpec.Builder`).
- **WAL journal mode** on both platforms for crash safety.

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification:

- **Step 32 (Persistence test)**: directly verifies. Force-kill mid-Trip on 3 devices; relaunch; queued messages resume delivery without user action.

Proposed additions:

- 24h-TTL eviction test: create messages, fast-forward clock 25h, verify failed-status flip and eventual LRU eviction.
- LRU-cap test: insert 1,200 messages; verify 200 oldest are evicted, with relays + failed evicting first.
- Encryption-at-rest test: extract the DB file from the device; verify it cannot be opened without the secure-enclave key.
- WAL crash safety: kill the app mid-write; relaunch; verify either complete commit or full rollback.
- Trip-end retention test: Trip ends; verify mesh_messages rows for that Trip remain readable in the archive UI but are not retransmittable (TripKey is gone).
