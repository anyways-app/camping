# Camp King — Offline BLE Mesh Addendum (Mesh-v1)

Extends `00-core.md`. Captures the offline mesh capability scoped to Trips. The mesh capability ships on a **standalone "Mesh" track** — its own release cadence (Mesh-v1, Mesh-v2…) decoupled from the main-app v1/v2 versioning. The main-app v1 ships unaffected.

This document is the cross-platform addendum. Platform-specific BLE concerns live in `20-ios.md` (CoreBluetooth + MultipeerConnectivity) and `30-android.md` (BluetoothLeAdvertiser/Scanner + foreground service). Patent boundary lives in `../legal/patent-claims.md`. Canonical source brief: `../briefs/offline-mesh-engineering-brief.md`.

---

## Scope

**Mesh-v1 takes Trips fully offline-capable.** Once a Trip starts and the group leaves connectivity, members exchange dictionary-vocabulary status messages, locations, and acknowledgments via BLE mesh — no internet, cellular, or Wi-Fi infrastructure required. Trips are still **created online** (account holder forms the Trip per FEAT-019..024); the mesh capability begins at Trip start (FEAT-112).

Out of scope of Mesh-v1 (deferred to Mesh-v2 or never):
- Group sizes beyond 20 devices/Trip (Mesh-v2 design target: 100).
- Free-text messaging (dictionary-only is a hard invariant).
- Wi-Fi Aware / NAN as an alternate transport.
- Mesh use outside an active Trip (no troop-wide mesh; no "ambient mesh").

## Hard platform requirements

- **iOS 16.0+** (CoreBluetooth maturity, MultipeerConnectivity stability).
- **Android 12+ (API 31+)** (`BLUETOOTH_SCAN`/`BLUETOOTH_ADVERTISE`/`BLUETOOTH_CONNECT` permission model, `neverForLocation` flag, modern foreground service semantics).
- Devices below these floors fall back to **online-only mode** with a clear UX message; no offline capability is offered.

## Cross-platform binding invariants

These hold on every client implementing Mesh-v1. Platform addenda may extend but may not contradict:

- **TripKey scope = a single Trip.** A 32-byte symmetric key generated server-side per Trip, distributed at bootstrap, used for AES-CCM encryption of every message in that Trip's mesh.
- **Revocation = silent-delete + coordinated rotation.** A `REVOKE_AND_ROTATE` broadcast simultaneously instructs the excluded device to silently delete credentials AND delivers a new TripKey to every remaining member via per-recipient sealed-box envelopes. Forward secrecy is guaranteed by the rotation, regardless of the excluded device's cooperation. See FR-9 below.
- **Key-epoch tagged on every message.** A 1-byte cleartext `key_epoch` field selects the decryption key. Receivers reject messages from epochs older than (current − 1).
- **Dictionary frozen at Trip start.** The dictionary version is pinned at Trip start; the user-extension layer (up to 256 entries) is editable only during the online bootstrap window before Trip start.
- **Group size cap = 20 devices per Trip in Mesh-v1.** Server-side enforced at Trip creation and at member-add. Mesh-v2 raises to 100.

---

## Functional requirements

The 12 functional requirements below mirror the engineering brief one-to-one. Each maps to a FEAT-NNN file with full behaviour, edge cases, and open questions. This doc captures the binding cross-platform contract.

### FR-1. Trip bootstrap (online) — FEAT-111

When a Trip is created or joined while online, each member's device receives:

- A **32-byte TripKey** (`tripkey`), generated server-side, distributed via authenticated channel.
- A unique **8-byte MemberID** within the Trip. (Note: `MemberID` ≠ `profile_id`; MemberID is Trip-scoped, profile_id is global. Glossary flagged for reconciliation.)
- An **Ed25519 keypair** (private key on-device, public key in roster).
- The **Trip roster** (MemberID → display name, public key, family relationship).
- The **dictionary version pin** for this Trip (base 1,024 entries + any user extensions added before departure).

### FR-2. Trip start — FEAT-112

A user-initiated "Start Trip" action transitions the Trip to **offline-active** state (a substate of `active` per FEAT-022; offline-active does not preclude online connectivity, it just means mesh is enabled):

- BLE advertising and scanning begin.
- The device begins broadcasting a presence beacon every duty cycle (per battery mode; FR-10).
- The device persists Trip credentials encrypted at rest (Keychain on iOS, Keystore on Android).

### FR-3. Send a message — FEAT-114

User selects a dictionary entry (with optional parameters), optionally attaches current GPS, optionally selects a recipient (broadcast by default), optionally selects "Require ACK." The device:

1. Composes the wire-format payload (see Wire Protocol below).
2. Encrypts with `TripKey` at the current key-epoch using AES-CCM.
3. Adds to the outbound advertisement queue.
4. Persists to local store (FR-7).

Authorship: the `sender MemberID` corresponds to the **active profile** at send time (the profile selected via the picker FEAT-004). If the active profile is a sub-profile and either of the **Mesh send** or **Mesh receive** feature gates is off (FEAT-007 amendment), the gate is enforced server-side at Trip-bootstrap (no MemberID issued for that profile) — so a gated sub-profile cannot send mesh messages.

### FR-4. Receive a message — FEAT-115

On scanning a matching service UUID:

1. Read cleartext header. Reject if `key_epoch < current − 1`.
2. Decrypt with `TripKey` at the indicated epoch. Drop on MAC failure (not for this Trip, or stale-epoch).
3. Check `MessageID` against dedup cache. Drop if seen.
4. If recipient = self or broadcast: deliver to UI, persist, and emit ACK if requested (FR-6).
5. If recipient ≠ self and TTL > 0: add to relay queue with TTL−1.
6. If TTL = 0: drop.

### FR-5. Multi-hop relay — FEAT-115

Every Trip device acts as a relay. Relayed messages cycle through the device's advertisement queue with reduced TTL. Default TTL = 5 hops. Relay is automatic; no user action.

### FR-6. Acknowledgments — FEAT-116

ACK is its own `message_type` carrying the original `MessageID`. ACK propagates back through the mesh and updates the sender's UI ("Delivered to Maya"). **Broadcast messages do not generate ACKs** (would flood the network); direct messages do, when sender requested.

### FR-7. Persistence and store-and-forward — FEAT-117

- All sent and relay-queued messages persist to encrypted local storage (Keychain / Keystore-protected key + at-rest-encrypted SQLite or equivalent).
- Messages survive app kill, device sleep, and out-of-range periods.
- Eviction policy:
  - TTL-in-time = 24 hours from last attempt, OR
  - ACK received (for direct messages with ACK requested), OR
  - LRU when queue exceeds 1,000 entries.

### FR-8. Geolocation piggyback — FEAT-118

Per-message opt-in. When attached, the message payload includes 6 bytes of compact lat/lon (3 bytes each, ~5m resolution at the equator). Receivers display this on a Trip map.

Privacy controls:
- **Per-message opt-in** is the default — sender chooses at compose time.
- A **Trip-wide opt-out** for an individual sub-profile is governed by the new "Geo capture on posts" feature gate (FEAT-007, already exists; this addendum extends its semantics to mesh messages).
- A **per-trip override** for a sub-profile sits in `trip_profile_visibility` (FEAT-029) — if a leader has opted a sub-profile out of a trip, no mesh messages from that profile are even possible (no MemberID issued).

### FR-9. Revocation and key rotation — FEAT-119 *(primary patent claim)*

**Threat model:** an excluded member's device may be compromised, malicious, or simply ignore commands. The design must guarantee **forward secrecy** — the excluded device cannot read or send valid Trip messages after revocation — *without* relying on the excluded device to honestly cooperate.

**Mechanism (single broadcast does both jobs):**

A privileged Trip member (the account holder, i.e. the trip creator's troop leader; see open question 7 in FEAT-119) issues a `REVOKE_AND_ROTATE` message containing:

- The MemberID being revoked.
- A new TripKey, encrypted **separately for each remaining member** under that member's Ed25519 public key (using X25519-derived ECDH + AES-GCM, sealed-box style).
- A monotonically increasing **key-epoch number** (e.g., `epoch=1` is initial, `epoch=2` after first rotation).
- An Ed25519 signature from the account holder's private key over all of the above.

**On receipt by remaining members:**
- Verify account-holder signature. Drop on failure.
- Locate own envelope (indexed by MemberID), decrypt with own Ed25519 private key, recover the new TripKey.
- Atomically swap to new TripKey at the new epoch number.
- Continue normal operation under the new key.

**On receipt by the excluded member (cooperative):**
- The device silently deletes its TripKey, Ed25519 private key, dictionary, and roster.
- The device exits Trip mode.
- The user is **not** notified that this happened (per design — silent deletion).
- A local event is logged for upload on next online session.

**On receipt by the excluded member (uncooperative — ignores delete instruction):**
- The device retains the old TripKey, but no envelope addressed to it in the rotation message — it cannot recover the new key.
- All subsequent traffic from honest members is encrypted under the new key + new epoch; the excluded device's old-epoch decryption fails.
- Any messages the excluded device transmits use the old key + old epoch and are rejected by all honest receivers (epoch mismatch).
- **Outcome: forward secrecy is guaranteed by the rotation, regardless of the excluded device's cooperation with the delete instruction.**

**Eventual-consistency window:**
A Trip member out of BLE range during the rotation broadcast continues operating under the old key until they receive the rotation message. During this window, messages they send are readable by the excluded device. Mitigations:

- The account holder's device re-broadcasts the rotation message on backoff (every advertising cycle for the first 5 minutes; exponential backoff to once per hour) until ACK'd by every remaining member.
- Every message header carries its key-epoch in cleartext; receivers reject messages from epochs older than (current − 1) — allowing one-epoch lag for in-flight messages, no more.
- The Trip UI shows a "synchronizing" indicator on the account holder's device until all members have ACK'd the rotation.

**Envelope size budget:**
- Mesh-v1 (20 members): rotation message contains 19 envelopes × ~48 bytes each ≈ 1 KB total. Chains across multiple service UUIDs / multiple advertisement cycles. Receivers reassemble before processing.
- Mesh-v2 (100 members): ~5 KB. Still tractable; design must support reassembly across many cycles.

### FR-10. Battery modes — FEAT-120

- **Default (Minimal):** advertise 2s ON / 28s OFF; scan in low-latency mode 10% duty.
- **Boost:** advertise 2s ON / 8s OFF; continuous scan.
- User toggle in Trip settings; persists per Trip.

### FR-11. Platform optimization modes — FEAT-120

At Trip start, the app surveys peer device platforms (via initial presence beacons) and offers:

- **Mixed (default):** service-UUID-encoded payloads, lowest common denominator, ~16-byte per-message payload.
- **iPhone group:** if all peers are iOS, switch to MultipeerConnectivity for richer transport; revert to Mixed if any Android peer joins.
- **Android group:** if all peers are Android with BLE 5 extended advertising support, use ~255-byte payloads; revert to Mixed if any iOS peer or unsupported Android joins.

User chooses; app enforces; transitions are graceful.

### FR-12. Dictionary extension — FEAT-121

- In-app editor lets a Trip member add up to 256 custom entries before Trip start.
- Extensions sync to all Trip members during the online bootstrap window.
- Once Trip is offline-active, dictionary is frozen for that Trip.

---

## Wire protocol (Mixed-mode baseline)

Captured in full in FEAT-113. Summary:

Each message is encoded into the BLE advertisement as a **128-bit service UUID**, with 8 bytes reserved as a fixed protocol prefix and 8 bytes as encrypted payload. Long messages chain across multiple service UUIDs in the same advertisement.

**Cleartext header (5 bytes, in-the-clear):**

```
[1B] version + flags
[1B] key_epoch (current TripKey generation; receivers reject epoch < current-1)
[3B] truncated MessageID (full 6B inside encrypted blob)
```

**Encrypted blob (AES-CCM with TripKey at indicated epoch, ~12 bytes + 4-byte MAC):**

```
[6B]  full MessageID (random per message)
[1B]  sender MemberID
[1B]  recipient MemberID (0xFF = broadcast)
[1B]  TTL (default 5, decremented on relay)
[1B]  message_type (TEXT / ACK / LOCATION / PRESENCE / REVOKE_AND_ROTATE / EXTENSION)
[2B]  dictionary_index
[2B]  param1, param2 (dictionary entry parameters)
[6B]  geolocation (optional; flag in header)
```

For longer messages — `REVOKE_AND_ROTATE` carrying N−1 envelopes (~1 KB at v1), multi-param dictionary entries, geolocation-tagged messages — chain across multiple service UUIDs with sequence and continuation flags. Receivers reassemble before MAC verification.

---

## Mesh-specific verification

Mirrors the structure of Trip-specific verification in `00-core.md`. Run on each platform before declaring Mesh-v1 done.

1. **Battery test** — 10-device Trip, Minimal mode, 8 hours simulated camping. p95 device battery drain ≤ 24% (3%/hr idle).
2. **Range test** — 5 devices spread across 150m line-of-sight at a real campsite. Direct message from device 1 to device 5 delivered within 300s p95 via mesh relay.
3. **Group churn test** — During an active Trip, 3 of 10 devices power off and 2 new devices join. Mesh continues operating; new devices receive backlogged broadcasts within their TTL window.
4. **Revocation test** — Account holder revokes member B. Member B's device deletes credentials within 60s of receipt and shows no user-visible indication. Surviving Trip continues to operate. **Forward-secrecy verification:** member B's device, instrumented to ignore the delete instruction and retain the old TripKey, must be unable to (a) decrypt any subsequent Trip traffic or (b) inject any messages accepted by remaining members. All remaining members must converge on the new key-epoch within the eventual-consistency window.
5. **Cross-platform test** — 5 iOS + 5 Android devices in one Trip, Mixed mode, all message types verified bidirectionally.
6. **Persistence test** — App force-killed mid-Trip on 3 devices. On relaunch, queued messages resume delivery without user action.

Automated test floor (extends `00-core.md` § Verification automated test floor):

- TripKey lifecycle unit tests (bootstrap → persist → load → rotate → re-persist).
- Key-epoch monotonic increment + stale-epoch rejection.
- Sealed-box envelope round-trip (sender's pubkey → receiver decrypt with privkey → recovered TripKey matches).
- Dictionary version-pin invariance during offline-active state (attempts to extend mid-Trip rejected).
- Foreground-service lifecycle test on each platform (start, persist through screen-off, terminate cleanly on Trip end).

---

## Cross-platform interop matrix

| Capability | iOS 16+ | Android 12+ | Notes |
|---|---|---|---|
| BLE advertising (foreground) | ✓ | ✓ | Foundation; required. |
| BLE scanning (foreground) | ✓ | ✓ | Foundation; required. |
| BLE advertising (background) | Limited (UUID overflow area) | ✓ (foreground service) | **Cross-platform interop in background only via Mixed mode and only with both peers foregrounded; see FEAT-120 OQ.** |
| MultipeerConnectivity | ✓ | ✗ | iPhone-group mode only; auto-falls-back to Mixed if any Android peer joins. |
| BLE 5 extended advertising | ✗ (iOS does not expose) | Variable (device-dependent) | Android-group mode only; falls back to Mixed otherwise. |
| Foreground service | N/A (different model) | ✓ (required for sustained scan) | Android requires explicit foreground service; iOS uses background-mode entitlement. |
| Keychain / Keystore | ✓ | ✓ | TripKey + Ed25519 private key persistence at rest. |

---

## Out of scope (this addendum)

- **Camp Atlas (FEAT-090)** — different offline mode for different purpose. Camp Atlas is platform-owned 3DGS site captures with cloud GPU training; Mesh-v1 is per-Trip ephemeral messaging. They share the iOS-Pro hardware floor in places but are otherwise independent.
- **Online resume after Trip end.** When a Trip ends (FEAT-022 ended state), mesh credentials are torn down. Online resume of the Trip's posts is the standard online card flow; not mesh's concern.
- **Mesh-v2 features.** 100-device Trips, Wi-Fi Aware, dictionary localization at the protocol layer, etc.

---

## Open questions

These are deferred to per-FEAT files. Each is tagged with the FEAT-NNN where it lives and the owner.

1. **Tech stack confirmation.** RN Expo vs. native iOS / Android. Implementation strategy differs significantly. → FEAT-120 *(product, eng)*.
2. **Dictionary-extension sync semantics.** Last-write-wins, merged, or conflict-resolved when two members add entries pre-Trip-start? → FEAT-121 *(product)*.
3. **Geolocation Trip-wide opt-out.** Per-child opt-out for parents managing kid sub-profiles? → FEAT-118 + FEAT-007 *(product, legal)*.
4. **Trip-end transition triggers.** User action / geofence / time elapsed / all? → FEAT-022 amendment *(product)*.
5. **Family-member profile message authorship.** Can a child profile send messages independently? Affects MemberID assignment. → FEAT-114 + FEAT-007 *(product)*.
6. **COPPA / GDPR-K stance** for minors' BLE-radio location. (Largely subsumed by 13+ ToS attestation in FEAT-008.) → FEAT-111 *(legal)*.
7. **Revocation authority** among co-parents. Limited to the trip-creator's troop leader? Or any parent-tier account? → FEAT-119 *(product, legal)*.
8. **iOS background advertising.** UUID overflow area means backgrounded iOS effectively become iOS-only nodes. → FEAT-120 *(product)*.
9. **iOS / Android battery-mode parity.** iOS gives less control over scan duty cycle than Android. → FEAT-120 *(eng)*.
10. **Dictionary localization.** Language-independent indexes vs. per-locale entries. → FEAT-121 *(product)*.

## Cross-references

- Source brief: [`../briefs/offline-mesh-engineering-brief.md`](../briefs/offline-mesh-engineering-brief.md)
- Patent boundary: [`../legal/patent-claims.md`](../legal/patent-claims.md)
- Trip lifecycle: [`00-core.md` § Trips](00-core.md#trips), FEAT-022.
- Trip privacy boundaries: [`00-core.md` § Trips → Privacy boundaries](00-core.md#privacy-boundaries), FEAT-032.
- Per-sub-profile feature gates: FEAT-007 (with new Mesh send / Mesh receive rows).
- iOS BLE specifics: [`20-ios.md` § BLE mesh](20-ios.md).
- Android BLE specifics: [`30-android.md` § BLE mesh](30-android.md).
