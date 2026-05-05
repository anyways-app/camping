---
id: FEAT-119
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-002, FEAT-111, FEAT-113]
last_reviewed: 2026-05-04
---

# FEAT-119: Revocation and key rotation (REVOKE_AND_ROTATE)

## Summary

The single-broadcast primitive that simultaneously (a) silently instructs an excluded device to delete its credentials AND (b) delivers a new TripKey to every remaining member via per-recipient sealed-box envelopes. **Forward secrecy is guaranteed by the rotation, regardless of the excluded device's cooperation with the delete instruction.** This is the **primary patent claim** for the offline-mesh featureset (`docs/legal/patent-claims.md` § C4) — generic key rotation is prior art; the *unified silent-revocation + coordinated-rotation primitive in a consumer family-trip context* is the novel mechanic.

## Roles & permissions

- **Issuer** (account holder = trip creator's troop leader): sole authority to issue `REVOKE_AND_ROTATE` in Mesh-v1. Their Ed25519 signature on the rotation message is what every remaining member verifies. *(Open question 1: extend to co-leaders / any troop leader on the trip?)*
- **Excluded member**: receives the rotation message; cooperative behaviour deletes credentials silently; uncooperative behaviour is *neutralised* by the rotation (the excluded device cannot decrypt new traffic).
- **Remaining members**: each receives a per-recipient sealed-box envelope inside the rotation message; decrypts with their own Ed25519 private key; recovers the new TripKey; atomically swaps to the new epoch.

## Surfaces

- **Issuer's UI** (account holder's Trip detail screen): "Manage trip members" → per-member detail → "Remove from trip" action. Confirmation: "Removing [Name] will end their access to this trip's mesh. Their device will silently delete the trip's credentials. Their personal data on Camp King is unaffected. Continue?"
- **Status indicator** (issuer's UI only): "Synchronizing trip key (5/19 members confirmed)" while the eventual-consistency window converges. Auto-clears once all remaining members have ACK'd the rotation.
- **All other members**: no UI at all. The rotation is silent; the user just continues using the trip's mesh under the new key.
- **Excluded member's UI** (cooperative case): the trip silently disappears from their device's Trips list. No notification. *(Per design — silent deletion.)*

## Behaviour

### Issuer side

1. Issuer (account holder) navigates to Trip detail → Manage members → selects the member to remove.
2. Confirmation as above.
3. **Compose `REVOKE_AND_ROTATE` message**:
   - Generate a new 32-byte TripKey via CSPRNG.
   - Compute the next key-epoch (`current_epoch + 1`).
   - For every remaining member (everyone except the excluded MemberID), construct a sealed-box envelope:
     - `recipient_member_id`, `recipient_pubkey` (from local roster).
     - X25519 ephemeral keypair; ECDH with recipient's pubkey → shared secret.
     - AES-GCM encrypt the new TripKey under the shared secret. Output: ephemeral pubkey || nonce || ciphertext || GCM-tag.
     - Envelope size: ~48 bytes.
   - Bundle: `excluded_member_id` (1B), `new_epoch` (1B), envelope count (1B), envelopes (~48B × N).
   - Ed25519 sign the bundle with the issuer's private key. Signature: 64 bytes.
   - Total payload: 3 + 48*N + 64 bytes. At Mesh-v1 (20 members → N=19), ≈ 1 KB.
4. **Wrap in a `REVOKE_AND_ROTATE` (`message_type=0x05`) message**: AES-CCM encrypt the bundle + signature with the **current** TripKey at the **current** epoch (so all remaining members can decrypt — the excluded member can also decrypt the outer layer, but cannot decrypt their own envelope inside since there isn't one).
5. **Fragment** across multiple service UUIDs per FEAT-113 chaining rules (~64 fragments at v1).
6. **Broadcast** with priority — every advertise cycle for the first 5 minutes after issuance.
7. **Wait for ACKs** from each remaining member (FEAT-116 ACK applied to the rotation's MessageID). Each ACK is itself encrypted with the *new* TripKey at the new epoch — proving the recipient successfully decrypted their envelope and switched keys.
8. **Backoff**: after first 5 minutes, drop to once-every-5-minutes for the next hour, then once per hour until everyone has ACK'd.
9. **Status converges**: when all remaining members have ACK'd, issuer's UI clears the synchronizing indicator. The previous epoch's TripKey is wiped from the issuer's device.

### Remaining-member side (non-excluded)

1. Receive the `REVOKE_AND_ROTATE` message via FEAT-115 (multi-fragment reassembly + AES-CCM decrypt with current TripKey).
2. **Verify the issuer's Ed25519 signature** over the bundle. Reject on signature failure.
3. **Locate own envelope**: linear-scan the envelope list for one with `recipient_member_id == self_member_id`.
4. **Decrypt own envelope**: ECDH with the envelope's ephemeral pubkey + own Ed25519 private key (converted to X25519 form), AES-GCM decrypt to recover the new TripKey.
5. **Atomic key swap**:
   - Persist the new TripKey at the new epoch in Keychain / Keystore (alongside the previous TripKey, retained for the eventual-consistency window).
   - Update local `current_epoch` to the new value.
6. **Emit ACK** for the rotation message (FEAT-116) — encrypted with the new TripKey + new epoch.
7. **Continue normal operation**. Subsequent messages use the new key + new epoch.
8. **After 1 hour at the new epoch**: wipe the previous TripKey from Keychain. The eventual-consistency window is closed.

### Excluded-member side (cooperative)

1. Receive the message; AES-CCM decrypt the outer layer with current TripKey (still works — the excluded member still has the old key).
2. Verify issuer's signature: passes.
3. **Locate own envelope**: scan envelope list. **Find none** (excluded member is not in the recipient set).
4. **Recognise the exclusion**: the absence of an envelope addressed to self IS the silent-delete signal.
5. **Cooperative behaviour**: silently delete TripKey, Ed25519 private key, dictionary, roster from the device. Wipe from Keychain / Keystore. Remove the Trip from the local Trips list. **No notification to the user.** Log a local event for upload on next online session ("the trip removed me from its mesh at [timestamp]").

### Excluded-member side (uncooperative — instrumented to ignore)

1. Receive the message; decrypt outer layer.
2. Verify signature; pass.
3. Locate own envelope: find none.
4. **Ignore the delete instruction; retain old TripKey + Ed25519 private key.**
5. **Subsequent messages from honest members**: encrypted under the new TripKey at the new epoch. The excluded device's old TripKey decryption attempts fail (MAC failure). Drop.
6. **Subsequent messages from the excluded device**: encrypted under the old TripKey at the old epoch. Honest receivers reject at the FEAT-115 stale-epoch check (`key_epoch < current - 1` after one rotation cycle).
7. **Outcome**: forward secrecy is preserved. The excluded device cannot decrypt new traffic and cannot inject accepted traffic. Its only remaining capability is to passively listen to messages encrypted with the old key during the eventual-consistency window — see below.

### Eventual-consistency window

A remaining member who is **out of BLE range** during the rotation broadcast continues operating under the old TripKey until they receive the rotation message:

- During this window, messages they send are encrypted with the old key, which the excluded device can still decrypt.
- Mitigations:
  - Issuer rebroadcasts on backoff schedule until ACK'd by every remaining member.
  - Every message header carries its `key_epoch` in cleartext; receivers reject `key_epoch < current_epoch - 1`. In-flight messages from one-epoch-behind senders are accepted; older are dropped.
  - The synchronizing indicator on the issuer's UI gives them visibility.

The window is **bounded by the rotation-broadcast retry cadence**: in the worst case, a member who's gone for hours catches up the next time they're in range, and the issuer continues to retry indefinitely.

## Data

Reads:
- Local TripKey at current epoch (Keychain / Keystore).
- Issuer's Ed25519 private key (issuer side only).
- Trip roster (recipient member IDs and public keys).

Writes:
- Issuer side: outbound advertisement queue with the rotation message.
- Remaining-member side: new TripKey written to Keychain / Keystore at the new epoch; previous epoch's TripKey retained for 1 hour.
- Excluded-member side (cooperative): all Trip credentials wiped from Keychain / Keystore + local DB.

## Edge cases

- **Issuer's signature key compromise**: catastrophic; an attacker can issue arbitrary rotations, locking out members. Mitigation: signature key sits in Keychain / Keystore; if compromised, the trip itself is compromised (issuer's own profile must be re-established via the broader account-recovery flow). v1 accepts this; v2 may use an MLS-style group key agreement to remove the single signing key as a SPOF.
- **Multiple rotations in flight** (issuer rotates twice in quick succession): each carries its own epoch; receivers process in epoch order. If a member is missing in epoch 5 but present in epoch 6, they pick up from epoch 6 and miss the epoch-5 envelope (not addressed to them anyway since they were absent). Practical: this happens only if the issuer is doing staged removals; behaviour is monotonic and safe.
- **Rotation message lost in flight**: rebroadcast on backoff (5min / 5min-cadence-for-next-hour / hourly thereafter) until ACK'd by every member. The issuer's UI surfaces the synchronizing indicator until convergence.
- **Excluded device receives the rotation but its app is killed during cooperative-delete**: on next launch, the device sees that it cannot decrypt the latest traffic (stale-epoch). The app detects the orphan-credential state and completes the delete on launch.
- **Excluded device is offline at rotation time**: it never receives the rotation message. It still has the old TripKey, but all honest members have rotated; future inbound traffic is on the new epoch and rejected. The excluded device is effectively offline until the issuer broadcasts the rotation in its presence (which the issuer keeps doing on backoff).
- **Issuer's troop leaves the trip mid-rotation**: per FEAT-022, the trip ends if the creator's troop leaves. Rotation is moot at trip-end.
- **Co-parents in the issuer troop**: only ONE leader per troop in v1 (FEAT-002). Co-leadership is FEAT-011 deferred. So issuer is unambiguous.
- **Revocation of multiple members in one operation**: not supported in v1; each revocation is its own rotation. Multiple in flight serialize via the epoch counter. *(Open question 2.)*
- **Race: member A is in the process of being revoked while broadcasting their own message**: A's message gets out under the old epoch and is delivered to honest members during the window. After rotation propagates, A's old-epoch transmissions are rejected.

## Out of scope

- The patent claim itself — captured in `docs/legal/patent-claims.md` § C4.
- Migration to MLS / Signal-style group key agreement — Mesh-v2 candidate.
- Visible-removal UX (notifying the excluded user that they were removed) — out by design (silent deletion is the load-bearing property).
- Re-admission of a previously revoked member — they re-bootstrap as a new MemberID via FEAT-111 if the issuer re-adds them.

## Open questions

1. **Issuer authority among co-parents** — only the trip creator's troop leader in v1, or extended to any joined-troop leader / co-leader of the trip? Default: trip creator's troop leader only in Mesh-v1. *(product, legal)*
2. **Multi-member-revocation**: revoke 3 members at once via one rotation. Default: not in v1; each is its own rotation. Performance fine; UX could improve. *(product, eng)*
3. **Eventual-consistency window upper bound**: after how long do we *force* removal of the previous-epoch TripKey from honest members' devices, even without explicit ACK? Default proposed: 1 hour. Tradeoff: shorter = stricter forward secrecy guarantee; longer = more tolerance for out-of-range members. *(security, product)*
4. **Notification-on-removal for the excluded user**: silent delete is the design, but does the excluded user *eventually* get notified (e.g. on next online sync, "you were removed from a trip on [date]")? Default: yes, in their account log, but not as a push notification. *(product, legal)*
5. **Issuer's signing key rotation**: separate from TripKey rotation. If the issuer's Ed25519 keypair is suspected compromised, what's the recovery? Default v1: the issuer's troop leader resets via the account-recovery flow (FEAT-005), which generates a new keypair and re-bootstraps all current trips. *(security)*
6. **MLS as a Mesh-v2 path**: should the v1 design be MLS-compatible from the outset to ease the v2 migration? Default: no — Mesh-v1 is intentionally simple. *(eng)*

## Cross-platform notes

- **iOS**: Ed25519 signatures via `CryptoKit.Curve25519.Signing`. Sealed-box ECDH via `Curve25519.KeyAgreement` + `AES.GCM`. See `20-ios.md` § BLE mesh.
- **Android**: Ed25519 / X25519 via Conscrypt. AES-GCM via `Cipher.getInstance("AES/GCM/NoPadding")`. See `30-android.md` § BLE mesh.
- **Endianness**: all multi-byte fields little-endian; signature is over the canonical little-endian byte representation of the bundle.

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification:

- **Step 30 (Revocation test)**: directly verifies. Account holder revokes member B; B's device deletes credentials within 60s of receipt and shows no user-visible indication; surviving Trip continues to operate; B's device, instrumented to ignore the delete and retain the old TripKey, must be unable to (a) decrypt subsequent Trip traffic or (b) inject any messages accepted by remaining members; all remaining members converge on the new key-epoch within the eventual-consistency window.

Proposed additions:

- Multi-fragment reassembly for the ~1 KB rotation message: send under simulated lossy radio conditions; verify reassembly succeeds within reasonable retry counts.
- Backoff cadence test: instrument the issuer; verify rebroadcast cadence matches spec (every advertise cycle for 5 min, then every 5 min for an hour, then hourly).
- Out-of-range member catches up: simulate a member out of BLE range during initial rotation; bring them back; verify they receive the rotation, decrypt their envelope, and ACK.
- Issuer-signature-failure test: alter the signature byte; verify all receivers drop the message at signature verification.
- Sealed-box envelope tampering: alter one byte of an envelope; verify only that recipient's decryption fails (others succeed); verify the tampering does not silently corrupt anyone else's TripKey.
- Forward-secrecy formal test: instrumented excluded device retains old TripKey; assert (a) zero successful decryptions of post-rotation traffic, (b) zero accepted injections at any honest receiver.
