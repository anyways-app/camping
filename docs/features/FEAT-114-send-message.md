---
id: FEAT-114
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-007, FEAT-113, FEAT-117, FEAT-118, FEAT-121]
last_reviewed: 2026-05-04
---

# FEAT-114: Send a message

## Summary

The user-facing path for composing and transmitting a single offline-mesh message during an active Trip. The user picks a dictionary entry (with optional parameters), optionally attaches their current GPS, optionally targets a specific recipient (broadcast is default), and optionally requests an acknowledgment. The device composes the wire-format payload (FEAT-113), encrypts with the current-epoch TripKey, queues for advertisement, and persists to local store (FEAT-117).

## Roles & permissions

- **Any active profile** with `Mesh send` (FEAT-007) gate on AND a MemberID issued at bootstrap (FEAT-111). If both `Mesh send` and `Mesh receive` are off, the profile has no MemberID and cannot send.
- **The active profile is the *sender***, regardless of which troop's device the user is on. The sender MemberID in the encrypted blob is set from the active profile, not the device's owner.
- **Recipient**: any other Trip member's MemberID, OR `0xFF` for broadcast. The picker (FEAT-114 UI) lists eligible recipients drawn from the Trip roster (FEAT-111).

## Surfaces

- **Compose surface**: a dedicated "New mesh message" sheet inside the Trip detail screen. Distinct from the regular card creation flow (FEAT-043) — the mesh compose surface has no image, no flair, no overlay editor; just a dictionary picker and recipient/ACK/geo toggles.
- **Quick-send shortcuts**: presence-broadcast and "On my way" / "I'm here" / "Dinner ready" type pre-selected dictionary entries available as one-tap buttons in the Trip detail screen.

## Behaviour

1. User opens the Trip detail screen (FEAT-019). Trip is in `offline-active` substate (FEAT-022 / FEAT-112).
2. User taps "New message" or a quick-send shortcut.
3. **Compose sheet** opens:
   - **Dictionary picker**: searchable list of the 1,024 base + ≤256 user-extension entries pinned at this Trip. Most-recently-used entries surface first.
   - **Parameter inputs** (when the selected entry takes parameters; e.g. "I'm running [N] minutes late" needs a number 1-60). Numeric inputs render a stepper; enum inputs render a picker.
   - **Recipient selector**: defaults to "Everyone (broadcast)"; tap to change to any specific Trip member's display name → resolves to their MemberID.
   - **Attach my location** toggle: default off; FEAT-118 governs the privacy implications. Greyed out if the active profile's "Geo capture on posts" gate (FEAT-007) is off.
   - **Require ACK** toggle: default off for broadcast (ACKs would flood — FEAT-116); default off for direct messages but user-toggleable.
4. User taps "Send."
5. **Compose-time validation**:
   - Dictionary entry exists in the pinned dictionary version (FEAT-121).
   - Parameters are within bounds (per the entry's parameter spec).
   - Recipient MemberID is in the current Trip roster.
   - User's profile has `Mesh send` gate on (FEAT-007) — server-enforced via the bootstrap-credentials check (no MemberID = no send).
6. **Compose & encrypt**:
   - Generate 6-byte random MessageID.
   - Compose the encrypted-blob plaintext per FEAT-113 wire layout.
   - AES-CCM encrypt with TripKey at current epoch.
   - Build cleartext header (version 1, key_epoch, truncated MessageID, has-geolocation flag).
   - If the message is larger than one service-UUID's payload budget (mostly when geolocation is attached + parameters are full), fragment per FEAT-113 chaining rules.
7. **Queue for transmission**:
   - Add fragments to the outbound advertisement queue.
   - Persist to local store (FEAT-117) tagged with the Trip-id, MessageID, and "pending-ACK" flag if ACK was requested.
8. **UI feedback**:
   - Optimistic UI: the sent message appears in the Trip's local activity log immediately, with a "sending…" indicator.
   - On confirmed transmission (next advertise cycle), indicator updates to "sent."
   - On ACK received (for direct messages), indicator updates to "delivered to [recipient display name]" — see FEAT-116.

## Data

Reads:
- `trips.offline_active_started_at` (must be set; otherwise mesh is not active).
- `trip_credentials` for the active profile (TripKey via Keychain/Keystore lookup, MemberID from local store).
- Trip roster (recipient MemberID resolution).
- Dictionary version pin (FEAT-121).
- `profile_feature_gates` for the active profile (Mesh send, Geo capture).

Writes:
- Outbound advertisement queue (in-memory + persisted via FEAT-117).
- Local store: persistent record of the sent message keyed by `(trip_id, message_id)`.

## Edge cases

- **Trip not offline-active** (just `active`, mesh not started): compose sheet is hidden / disabled with "Trip needs to be started for offline mode."
- **No mesh receivers nearby**: send still happens (advertise begins on next duty cycle); UI does not block on confirmation. Persistence (FEAT-117) ensures the message survives until a receiver enters range.
- **Profile `Mesh send` gate off mid-compose**: server-side check at send-time rejects with "Sending disabled for this profile by your troop leader." Client also hides the New-message CTA when gate is off, so this only fires on a stale UI.
- **Dictionary entry not in the pinned dictionary**: should be impossible because the picker only shows pinned entries; defensive: server rejects.
- **Parameter out-of-bounds**: client validates before send; defensive: server rejects.
- **Recipient is the sender**: client filters the picker to exclude self; defensive: server rejects.
- **Recipient has been revoked** (FEAT-119) but the sender hasn't yet received the rotation broadcast: message is encrypted under the old epoch; the (now-excluded) receiver can decode it during the eventual-consistency window. This is the documented limitation of the rotation eventual-consistency (FEAT-119). Once the sender receives the rotation, future messages use the new epoch; the excluded device's decryption fails.
- **Network-down during compose**: irrelevant; compose / send is fully offline-capable.
- **Battery low**: no special handling in v1. The OS will eventually throttle BLE if battery is critical. *(Open question 3.)*
- **Geolocation toggle on but device hasn't acquired a recent fix**: client requires a fix newer than 5 minutes; if not, surface "Acquiring location…" with a 30-second timeout. If timeout, send without geolocation and flag in the activity log.

## Out of scope

- Free-text messaging — explicitly out per the dictionary-only invariant.
- Multi-recipient direct send (one message to N specific MemberIDs without broadcasting). Default Mesh-v1: not supported; the user picks one recipient or broadcast. Multi-recipient is a Mesh-v1.x candidate. *(Open question 1.)*
- Image / media attachments — out of scope; mesh is text+geo only. Photos go through the standard online card flow when connectivity returns.
- Reply chains / threads — Mesh-v1 messages are flat. Threading is a Mesh-v2 candidate.
- Edit / delete after send — not supported. Once sent, a message is in the mesh; it propagates by relay and persists in receivers' local stores.

## Open questions

1. **Multi-recipient direct send.** Compose once, deliver to N members without broadcast flood? Default: not in Mesh-v1 — broadcast or single direct only. *(product)*
2. **Family-member message authorship.** Can a sub-profile send under their own MemberID, or only the leader? Brief flagged this. Default: each profile with mesh gates on gets their own MemberID and signs as themselves. *(product)*
3. **Send-while-battery-critical.** Should the app refuse to send (or warn) when battery < 10%? Default: no v1 special handling. *(product)*
4. **Quick-send shortcuts list.** Which 4-6 dictionary entries get one-tap buttons? Suggestion: "I'm here," "On my way," "Dinner ready," "Help needed," "Heads up." *(design)*
5. **Optimistic-UI rollback.** If send fails after compose-time validation, do we roll back the local activity log entry, or mark it failed? Default: mark failed with a retry affordance. *(design, eng)*

## Cross-platform notes

- **iOS**: compose sheet is a presented modal; recipient picker is a sheet within. Quick-send shortcuts are buttons in the trip detail.
- **Android**: same shape; bottom-sheet pattern; Material Search for the dictionary picker.
- **Web**: not applicable — web does not participate in the mesh.

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification:

- **Step 31 (Cross-platform test)**: 5 iOS + 5 Android, all message types verified bidirectionally — covers send-from-each-platform.
- **Automated test floor**: per-sub-profile feature-gate matrix tests cover Mesh-send-off rejection.

Proposed additions:

- Mesh-send-gate-off test: profile with Mesh send off attempts to compose; server rejects; client hides the CTA.
- Optimistic-UI rollback test: simulate send failure post-compose; verify local activity log entry shows "failed" with retry.
- Geo-capture-fix-stale test: toggle geolocation on with no recent GPS fix; verify acquisition prompt and 30s timeout behaviour.
- Per-trip dictionary pin test: send using an entry that exists in the local dictionary but NOT in the pinned version; verify rejection.
- Recipient-revoked race test: send to a recipient who's been revoked but rotation hasn't propagated yet; verify message goes out under old epoch (documented limitation), and after rotation propagation, future sends fail.
