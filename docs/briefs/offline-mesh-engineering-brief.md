---
do_not_edit: true
source: vividConsulting.info (SKrishnan Media Enterprises Inc., DBA)
source_address: 2310 N Henderson Ave Ste B Unit 1591, Dallas, TX 75206
document_title: Offline BLE Mesh Capability — Implementation Prompt
document_version: 0.2 draft (revocation/rotation design locked)
receipt_date: 2026-05-04
canonical_for: patent-attorney engagement
---

> **Provenance notice.** This file is the verbatim engineering brief
> received from vividConsulting.info on 2026-05-04. It is preserved as
> the canonical source for the patent attorney engagement that follows
> the application-layer claims described below. **Do not edit.** Any
> revisions must come as a new dated brief, preserved alongside this one.

---

# Offline BLE Mesh Capability — Implementation Prompt
**Product:** Camp King app
**Owner:** vividConsulting.info (SKrishnan Media Enterprises Inc., DBA)
**Document type:** Engineering brief for the implementation session
**Version:** 0.2 draft (revocation/rotation design locked)

---

## Role you should adopt

You are a **senior mobile platform architect** with deep specialization in:
- Bluetooth Low Energy (advertising, scanning, GATT, BLE 5 extended advertising)
- Offline-first mobile architecture and store-and-forward messaging
- Mobile cryptography (AES-CCM, Ed25519, key derivation, group key management)
- iOS CoreBluetooth + MultipeerConnectivity
- Android BluetoothLeAdvertiser/Scanner, foreground services, and Wi-Fi Aware (NAN)

You are advising a small mobile engineering team that will implement this feature. Your output is an architecture and implementation brief, not a full codebase. You are expected to flag ambiguities back to the product owner before writing production code.

---

## Product context

The Camping App is a social platform for families on camping trips, framed as **"connected disconnected."** Parent-owned accounts host per-family-member profiles (Netflix-style). Target users are families with kids; peak usage is summer.

A **Trip** is a first-class concept in the app: a defined group of members, a date range, a campsite location, and shared trip state (location pings, status updates, "on my way" / "dinner ready" type signals). Trips are **created online** (account holder forms the trip, invites members, members accept) and then **executed offline** at the campsite.

The feature you are designing: **make Trips fully offline-capable.** Once a Trip starts and the group leaves connectivity, members must still be able to exchange status messages, locations, and acknowledgments via BLE mesh — with no internet, no cellular, no Wi-Fi infrastructure.

---

## Decisions already locked (do not re-litigate)

| # | Decision | Value |
|---|----------|-------|
| 1 | Group size, v1 | 20 devices/Trip max |
| 2 | Group size, future | 100 devices/Trip (v2 design target) |
| 3 | Group concept | "Trip" — already exists in the app data model |
| 4 | Message vocabulary | Dictionary-only (no free-text in offline mode) |
| 5 | Dictionary base size | 1,024 entries, bundled with app, version-pinned per Trip |
| 6 | Dictionary extension | Trip-scoped, up to 256 user-added entries, edited in-app |
| 7 | Message addressing | Both broadcast (whole Trip) and direct (one member) |
| 8 | Acknowledgment | Per-message: sender chooses fire-and-forget or ack-required at transmit time |
| 9 | Geolocation | Each message MAY carry sender's last-known GPS (sender-controlled per message) |
| 10 | Privacy | Trip-scoped encryption; non-Trip devices cannot decrypt |
| 11 | Persistence | Store-and-forward; messages survive offline windows |
| 12 | Battery default | Minimal duty cycle; user-toggleable "Boost" mode |
| 13 | Bootstrap | Online (cloud-issued Trip credentials); offline operation begins after Trip start |
| 14 | Revocation | In-band command broadcast on Trip channel instructs device to delete its own credentials |
| 15 | Cross-platform | iOS and Android peers must interoperate by default |
| 16 | Platform optimization | User-selectable "Optimize for iPhone group" / "Optimize for Android group" / "Mixed" modes |
| 17 | Patent strategy | Novelty claimed at the **application layer only** (Trip lifecycle, dictionary UX, family-account integration). BLE mesh transport itself is acknowledged prior art. |

---

## Hard platform requirements

- **iOS 16.0+** (CoreBluetooth maturity, MultipeerConnectivity stability)
- **Android 12+ (API 31+)** (`BLUETOOTH_SCAN`/`BLUETOOTH_ADVERTISE`/`BLUETOOTH_CONNECT` permission model, `neverForLocation` flag, modern foreground service semantics)
- Devices below these floors fall back to **online-only mode** with a clear UX message; no offline capability is offered.

---

## Functional requirements

### FR-1. Trip bootstrap (online)
When a Trip is created or joined while online, each member's device receives:
- A **32-byte Trip symmetric key** (`TripKey`), generated server-side, distributed via authenticated channel
- A unique **8-byte MemberID** within the Trip
- An **Ed25519 keypair** (private key on-device, public key in roster)
- The **Trip roster** (MemberID → display name, public key, family relationship)
- The **dictionary version** pinned to this Trip (base + any user extensions added before departure)

### FR-2. Trip start
A user-initiated "Start Trip" action transitions the Trip to **offline-active** state:
- BLE advertising and scanning begin
- The device begins broadcasting a presence beacon every duty cycle
- The device persists Trip credentials encrypted at rest (Keychain/Keystore)

### FR-3. Send a message
User selects a dictionary entry (with optional parameters), optionally attaches current GPS, optionally selects a recipient (broadcast by default), and optionally selects "Require ACK." The device:
- Composes the wire-format payload (see Wire Protocol section)
- Encrypts with `TripKey` using AES-CCM
- Adds to the outbound advertisement queue
- Persists to local store

### FR-4. Receive a message
On scanning a matching service UUID:
- Decrypt with `TripKey`. Drop on MAC failure (not for this Trip).
- Check `MessageID` against dedup cache. Drop if seen.
- If recipient = self or broadcast: deliver to UI, persist, and emit ACK if requested.
- If recipient ≠ self and TTL > 0: add to relay queue with TTL−1.
- If TTL = 0: drop.

### FR-5. Multi-hop relay
Every Trip device acts as a relay. Relayed messages cycle through the device's advertisement queue with reduced TTL. Default TTL = 5 hops. Relay is automatic; no user action.

### FR-6. Acknowledgments
ACK is its own message type carrying the original `MessageID`. ACK propagates back through the mesh and updates the sender's UI ("Delivered to Maya"). Broadcast messages do not generate ACKs (would flood the network); direct messages do, when sender requested.

### FR-7. Persistence and store-and-forward
- All sent and relay-queued messages persist to encrypted local storage.
- Messages survive app kill, device sleep, and out-of-range periods.
- Eviction: TTL-in-time = 24h, OR ACK received, OR LRU when queue exceeds 1,000 entries.

### FR-8. Geolocation piggyback
Per-message opt-in. When attached, the message payload includes 6 bytes of compact lat/lon (3 bytes each, ~5m resolution at the equator). Receivers display this on a Trip map.

### FR-9. Revocation and key rotation (locked design)

**Threat model:** an excluded member's device may be compromised, malicious, or simply ignore commands. The design must guarantee forward secrecy — meaning that after revocation, the excluded device cannot read or send valid Trip messages — *without* relying on the excluded device to honestly cooperate.

**Mechanism (single broadcast does both jobs):**

A privileged Trip member (account holder) issues a `REVOKE_AND_ROTATE` message. This message contains:
- The MemberID being revoked
- A new TripKey, encrypted **separately for each remaining member** under that member's Ed25519 public key (using X25519-derived ECDH + AES-GCM, sealed-box style)
- A monotonically increasing **key-epoch number** (e.g., `epoch=1` is initial, `epoch=2` after first rotation, etc.)
- An Ed25519 signature from the account holder's private key over all of the above

**On receipt by remaining members:**
- Verify account-holder signature. Drop on failure.
- Locate own envelope (indexed by MemberID), decrypt with own Ed25519 private key, recover new TripKey.
- Atomically swap to new TripKey at new epoch number.
- Continue normal operation under new key.

**On receipt by the excluded member:**
- The device is silently instructed to delete its TripKey, Ed25519 private key, dictionary, and roster.
- The device exits Trip mode.
- The user is **not** notified that this happened (per design requirement — silent deletion).
- A local event is logged for upload on next online session.

**On receipt by the excluded member if it ignores the command:**
- It still has the old TripKey, but no envelope addressed to it in the rotation message — it cannot recover the new key.
- All subsequent traffic from honest members is encrypted under the new key + new epoch; the excluded device's old-epoch decryption fails.
- Any messages the excluded device transmits use the old key + old epoch and are rejected by all honest receivers (epoch mismatch).
- **Outcome: forward secrecy is guaranteed by the rotation, regardless of the excluded device's cooperation with the delete instruction.**

**Eventual-consistency caveat (must be documented in delivered spec):**
A Trip member who is out of BLE range during the rotation broadcast continues operating under the old key until they receive the rotation message. During this window, messages they send are readable by the excluded device. Mitigations:
- Account holder's device re-broadcasts the rotation message periodically (every advertising cycle for first 5 minutes, then exponential backoff to once per hour) until ACK'd by every remaining member.
- Every message header carries its key-epoch number; receivers reject messages from epochs older than the current minus one (allowing one-epoch lag for in-flight messages, no more).
- Trip UI shows a "synchronizing" indicator on the account holder's device until all members have ACK'd the rotation.

**Envelope size budget:**
At v1 (20 members): rotation message contains 19 envelopes × ~48 bytes each ≈ 1 KB total. Chains across multiple service UUIDs / multiple advertisement cycles. Receivers reassemble before processing.
At v2 (100 members): ~5 KB. Still tractable; design must support reassembly across many cycles.

**Wire-format implication:** add a 1-byte `key_epoch` field to every message header (in cleartext, since receivers need it to select the correct decryption key). New message type `REVOKE_AND_ROTATE` defined with multi-UUID chaining and reassembly.

### FR-10. Battery modes
- **Default (Minimal):** advertise 2s ON / 28s OFF; scan in low-latency mode 10% duty.
- **Boost:** advertise 2s ON / 8s OFF; continuous scan.
- User toggle in Trip settings; persists per Trip.

### FR-11. Platform optimization modes
At Trip start, app surveys peer device platforms (via initial presence beacons) and offers:
- **Mixed (default):** service-UUID-encoded payloads, lowest common denominator, ~16 byte per-message payload
- **iPhone group:** if all peers are iOS, switch to MultipeerConnectivity for richer transport; revert to Mixed if any Android peer joins
- **Android group:** if all peers are Android with BLE 5 extended advertising support, use ~255 byte payloads; revert to Mixed if any iOS peer or unsupported Android joins

User chooses; app enforces; transitions are graceful.

### FR-12. Dictionary extension
- In-app editor lets a Trip member add up to 256 custom entries before Trip start.
- Extensions sync to all Trip members during the online bootstrap window.
- Once Trip is offline-active, dictionary is frozen for that Trip.

---

## Wire protocol (Mixed-mode baseline)

Each message is encoded into the BLE advertisement as a **128-bit service UUID**, with 8 bytes reserved as a fixed protocol prefix and 8 bytes as encrypted payload. Long messages chain across multiple service UUIDs in the same advertisement (iOS supports advertising multiple service UUIDs simultaneously).

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

**Total cleartext payload budget:** ~15 bytes per service UUID after the 5-byte header. For longer messages — `REVOKE_AND_ROTATE` (carries N−1 pubkey-encrypted envelopes + signature, ~1 KB at v1), multi-param dictionary entries, geolocation-tagged messages — chain across multiple service UUIDs with sequence and continuation flags. Receivers reassemble before MAC verification.

---

## Three additional constraints (added per spec process)

### Constraint A — Acceptance test scenarios (must all pass)
1. **Battery test:** 10-device Trip, Minimal mode, 8 hours simulated camping. p95 device battery drain ≤ 24% (3%/hr idle).
2. **Range test:** 5 devices spread across 150m line-of-sight at a real campsite. Direct message from device 1 to device 5 delivered within 300s p95 via mesh relay.
3. **Group churn test:** During an active Trip, 3 of 10 devices power off and 2 new devices join. Mesh continues operating; new devices receive backlogged broadcasts within their TTL window.
4. **Revocation test:** Account holder revokes member B. Member B's device deletes credentials within 60s of receipt and shows no user-visible indication. Surviving Trip continues to operate. **Forward-secrecy verification:** member B's device, instrumented to ignore the delete instruction and retain the old TripKey, must be unable to (a) decrypt any subsequent Trip traffic or (b) inject any messages accepted by remaining members. All remaining members must converge on the new key-epoch within the eventual-consistency window.
5. **Cross-platform test:** 5 iOS + 5 Android devices in one Trip, Mixed mode, all message types verified bidirectionally.
6. **Persistence test:** App force-killed mid-Trip on 3 devices. On relaunch, queued messages resume delivery without user action.

### Constraint B — Boundary disclosures
The implementation brief must explicitly state:
- The exact iOS/Android API surfaces used (with version requirements)
- Permissions requested and the user-facing rationale string for each
- All third-party libraries (with license, last-update date, maintenance status)
- Any reflection-based or undocumented API usage (should be **zero**)

### Constraint C — Patent boundary documentation
The brief must clearly delineate:
- **Application-layer claims** (novel, candidate for patent filing):
  - Trip lifecycle (online bootstrap, offline-active state, online resume)
  - Dictionary-extension UX with version-pinning per Trip
  - Family-account integration with mesh (parent-owned account, per-member profiles, hierarchical permissions)
  - **Silent-delete-with-coordinated-rotation revocation**: a single broadcast that (a) silently instructs an excluded device to delete credentials and (b) delivers a new TripKey to all remaining members via per-recipient pubkey envelopes, enforcing forward secrecy independent of the excluded device's cooperation. This is the specific novel mechanic for the patent claim — not generic "key rotation" (prior art) but the unified silent-revocation + coordinated-rotation primitive in a consumer family-trip context.
  - Key-epoch-tagged messages enabling graceful eventual-consistency in the offline mesh
  - "Connected disconnected" UX patterns (status visibility, trip lifecycle, family roles)
- **Transport-layer prior art** (acknowledged, not claimed): BLE mesh, service-UUID payload encoding, store-and-forward, multi-hop relay, AES-CCM encryption, Ed25519 signatures, sealed-box pubkey envelopes, generic key rotation schemes.

This boundary is required input for the patent attorney engagement that will follow.

---

## Output format you must produce

Deliver, in order:

1. **Architecture overview** (1-2 pages): system diagram, data flow, key components, lifecycle states.
2. **Wire protocol specification** (formal): byte layout for every message type, encryption details, dedup logic, TTL semantics. Reviewable by a security engineer.
3. **iOS implementation plan**: CoreBluetooth class structure, MultipeerConnectivity integration for iPhone-group mode, permissions and Info.plist entries, foreground/background behavior, build and test approach.
4. **Android implementation plan**: BluetoothLeAdvertiser/Scanner usage, foreground service architecture, BLE 5 extended advertising path for Android-group mode, permissions and manifest entries, manufacturer-specific quirks (Samsung, Xiaomi, Pixel) to be tested.
5. **Cryptography spec**: TripKey lifecycle, key derivation, encryption/MAC choices with rationale, revocation-and-rotation mechanics per FR-9 (envelope construction, signature scheme, epoch handling, reassembly), and analysis of the eventual-consistency window.
6. **Persistence layer**: encrypted local store schema, queue management, eviction policy.
7. **Test plan**: how each acceptance scenario in Constraint A is exercised, including any hardware/lab setup needed.
8. **Open risks and decisions**: a numbered list of every ambiguity, every place you assumed something the brief didn't specify, and every place a senior reviewer must weigh in. (See "Ambiguities to flag" below — at minimum, address all of these.)
9. **Effort estimate**: t-shirt sizing per platform (S/M/L/XL), engineer-weeks, with assumptions stated.

Format: markdown document, suitable for review by a non-mobile-specialist product owner and a patent attorney.

---

## Ambiguities you must flag back before writing production code

1. **Tech stack** — is the existing app native iOS + Android, React Native, or Flutter? Implementation strategy differs significantly. Confirm before producing platform-specific code.
2. **Dictionary extension sync semantics** — what if member A and member B both add custom entries while online but before Trip start? Last-write-wins, merged, or conflict-resolved by trip owner?
3. **Geolocation privacy** — opt-in per message is specified. Is there a Trip-wide opt-out? Per-child opt-out (parents controlling kids' location broadcasts)?
4. **iOS background advertising** — iOS strips manufacturer data and moves service UUIDs into a special overflow area when backgrounded. Android can't see them. Confirm the product accepts that backgrounded iOS devices effectively become iOS-only nodes until foregrounded, OR specify a UX that keeps the app foregrounded during Trip-active periods.
5. **Trip end** — what triggers transition from offline-active back to online? User action, geofence, time elapsed, all of the above?
6. **Battery on iOS** — iOS gives less control over scan duty cycle than Android. Confirm acceptance that "Minimal" and "Boost" modes will look slightly different across platforms.
7. **Family-member profiles** — can a child profile send messages independently, or only the parent account? Affects MemberID assignment and revocation authority (can a parent revoke their own child's device while keeping the child's profile in the Trip via another device?).
8. **Dictionary localization** — entries are language-specific. If Trip members have different app languages, how is the dictionary represented? (Likely: language-independent indexes, localized rendering at receiver.)
9. **Compliance** — minors' location data crosses Bluetooth radio. Confirm COPPA/GDPR-K stance with legal before shipping.
10. **Revocation authority** — is revocation power limited to the account holder who created the Trip, or does any parent-tier account have authority? What if there are co-parents in the Trip? Affects Ed25519 keypair issuance at bootstrap.

---

## Definition of done for this brief

The receiving session's output is "done" when:
- All 9 sections of the Output Format are present
- All 10 ambiguities above are explicitly addressed (resolved with assumption or escalated to product owner)
- All 6 acceptance test scenarios are mapped to a verification approach
- Patent-boundary disclosure (Constraint C) is reviewable by a non-engineer

---

## Attribution

This work is performed under **vividConsulting.info** (SKrishnan Media Enterprises Inc., DBA), 2310 N Henderson Ave Ste B Unit 1591, Dallas, TX 75206. Output documents should be branded accordingly.
