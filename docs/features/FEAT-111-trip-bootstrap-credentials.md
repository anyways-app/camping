---
id: FEAT-111
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-002, FEAT-019, FEAT-020, FEAT-021, FEAT-024]
last_reviewed: 2026-05-04
---

# FEAT-111: Trip bootstrap & credential provisioning

## Summary

When a Trip is created or joined while online and `trips.offline_mesh_enabled = true` (FEAT-021), each member's device is provisioned with the credentials it will need to participate in the offline BLE mesh once the Trip starts (FEAT-112). Provisioning is server-side, distributed via authenticated channel, and persists encrypted-at-rest on each device. Credentials are scoped to a single Trip; bootstrap is the *only* moment those credentials enter the device — there is no offline path to obtain them.

## Roles & permissions

- **Server (Camp King backend)**: sole issuer. Generates the per-Trip TripKey, assigns each member a Trip-scoped 8-byte MemberID, generates the Ed25519 keypair (private key delivered once, public key kept in roster), and pins the dictionary version at Trip start.
- **Trip member's device**: receives credentials and persists them in Keychain (iOS) / Keystore (Android). Does not generate any of them locally.
- **Account holder / trip creator's troop leader**: the *issuer of authority* — their Ed25519 signature is what validates `REVOKE_AND_ROTATE` messages later (FEAT-119).
- **Sub-profiles with both `Mesh send` and `Mesh receive` gates off (FEAT-007)**: do **not** receive credentials. They remain Trip members but are absent from the mesh.

## Surfaces

- Server-side: Trip creation flow (FEAT-020) and accept-invite flow (FEAT-024) trigger bootstrap.
- Client-side: silent — no UI of its own. The user sees "Trip is ready for offline mode" as a status indicator after bootstrap completes.

## Behaviour

1. Trigger: Trip creation by leader (FEAT-020) sets `offline_mesh_enabled=true`. Or: accept-invite (FEAT-024) on an already-mesh-enabled Trip.
2. **Server credential generation**:
   - Generate a 32-byte TripKey via CSPRNG.
   - For every Trip-member profile (across all joined troops) where the profile's `Mesh send` OR `Mesh receive` gate (FEAT-007) is on:
     - Assign an 8-byte MemberID, unique within this Trip. (See FEAT-018 / glossary OQ on whether MemberID is independent or a Trip-scoped derived alias of `profile_id`.)
     - Generate an Ed25519 keypair. Private key is held server-side only until delivery; public key is persisted in the Trip roster.
   - Compose the Trip roster: list of {MemberID, profile_id, display_name, public_key, family_relationship}.
   - Pin the dictionary version: base 1,024 entries plus any user extensions added before this moment via FEAT-121.
3. **Per-device delivery**:
   - Authenticated channel (Supabase Realtime over the troop's auth session, or a dedicated bootstrap edge function).
   - Payload to each device: TripKey, that device's MemberID, that device's Ed25519 keypair, the full roster, the dictionary version pin.
   - Account holder's device additionally receives the issuer-signing private key — used only for `REVOKE_AND_ROTATE` (FEAT-119).
4. **Per-device persistence**:
   - TripKey + Ed25519 private key stored in Keychain (iOS) / Keystore (Android), tagged with `trip_id`.
   - Roster + dictionary pin stored in encrypted local DB, tagged with `trip_id`.
5. **Status broadcast**: server marks `trip_troops.bootstrap_completed_at` per troop. Trip detail screen shows a "Ready for offline mode" indicator once all participating profiles' devices have ACK'd bootstrap completion.

## Data

Reads:
- `trips`, `trip_troops`, `trip_profile_visibility`, `profiles`, `profile_feature_gates` (to determine eligible profiles and gate state).

Writes:
- `trip_credentials (id, trip_id, profile_id, member_id, public_key, bootstrap_at, bootstrap_completed_at NULL)` — server-side. The TripKey and private keys themselves are NOT persisted server-side after delivery (zero-knowledge posture); only public keys and member-id assignments persist.
- Per-device: Keychain / Keystore (TripKey + Ed25519 private key); encrypted local DB (roster, dictionary pin).

## Edge cases

- **Bootstrap to an offline device.** Member's device is offline at the moment of trigger. Bootstrap is queued; on next online session, device pulls credentials. Trip cannot transition to offline-active (FEAT-112) until bootstrap is complete on every participating device.
- **Trip-mesh-enabled flipped *after* invite-accept.** Existing accepted-troop members whose devices are online get bootstrapped immediately; offline ones queue. The Trip cannot start offline until everyone is bootstrapped.
- **Sub-profile gate flipped on after bootstrap.** Server triggers a delta-bootstrap for that profile. Adds a new MemberID + Ed25519 keypair without rotating the TripKey (TripKey rotation is FEAT-119, only on revocation).
- **Sub-profile gate flipped off after bootstrap.** Server treats this as a revocation of that MemberID — invokes FEAT-119 `REVOKE_AND_ROTATE`. Forward secrecy guaranteed.
- **Server compromise.** Since TripKey is generated server-side, server compromise means TripKey compromise. Mitigation: TripKey is per-Trip (blast radius bounded); revocation can be triggered by the account holder (FEAT-119); future Mesh-v2 may move to an MLS-style group key agreement that doesn't require a trusted server. *(Open question 2.)*
- **Restoration after device loss.** Device lost / wiped. New device authenticates the troop / profile, re-fetches credentials via re-bootstrap. Server's record of the public key + MemberID assignment lets it re-issue the same MemberID with a freshly-generated Ed25519 keypair. The TripKey is re-delivered. Old device's now-orphaned credentials still work until the next rotation; if the old device is feared compromised, the user invokes FEAT-119. *(Open question 3.)*
- **Dictionary edit during bootstrap window race.** Member adds a custom dictionary entry (FEAT-121) just before bootstrap kicks off; another member's device bootstraps with the older version pin. Resolve via dictionary-extension sync semantics — out of scope here (FEAT-121 OQ).

## Out of scope

- The *use* of credentials in mesh operations — covered by FEAT-114 / FEAT-115 / FEAT-116 / FEAT-119.
- Online-only Trips (`offline_mesh_enabled=false`). No bootstrap runs.
- Pre-Trip bootstrap before any troop has accepted. Bootstrap fires per-accept (FEAT-024 hook); the creator's troop is bootstrapped at create-time as a special case.
- MLS / Signal-protocol-style group key agreement. Mesh-v2+.

## Open questions

1. **MemberID identity model.** Is MemberID an independent identifier issued by the server, or a Trip-scoped derived alias of `profile_id` (e.g. `truncate(HMAC(trip_key_seed, profile_id), 8 bytes)`)? Latter is simpler and avoids a new identity. Default proposed: derived alias. Resolve in glossary lock. *(product, backend)*
2. **Server-trust posture.** TripKey is server-generated; server compromise = TripKey compromise. Acceptable for v1 given the consumer-trip threat model? Mesh-v2 candidate: MLS group-key agreement removes server from the trust path. *(security, product)*
3. **Device-loss / re-bootstrap policy.** Default: re-bootstrap re-issues the same MemberID with a new Ed25519 keypair; old keypair becomes orphaned. Should the old keypair be auto-revoked on first re-bootstrap to close the orphan window? Default proposed: yes, server-initiated `REVOKE_AND_ROTATE` for the orphaned keypair. *(security)*
4. **COPPA / GDPR-K stance for minors' credentials.** 13+ ToS attestation (FEAT-008) covers this — sub-profiles are leader-attested 13+. No additional consent step at bootstrap. *(legal — confirm)*
5. **Dictionary version pin reproducibility.** When two members add custom entries pre-bootstrap, what version is pinned? Tied to FEAT-121 sync semantics. *(product)*

## Cross-platform notes

No fundamental divergence in the bootstrap protocol; transport channel for credential delivery is the same Supabase Realtime / edge function path used elsewhere. Per-device persistence differs:

- **iOS**: TripKey + Ed25519 private key in Keychain (`kSecClassKey`, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` to prevent iCloud Keychain sync).
- **Android**: Same in Keystore (`KeyGenParameterSpec.Builder` with `setUserAuthenticationRequired(false)` so unattended re-keying works).

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification:

- **Step 30 (Revocation test)** depends on bootstrap having succeeded so that revocation has something to revoke.

Proposed additions:

- Bootstrap-eligibility test: profile with `Mesh send` and `Mesh receive` both off → no `trip_credentials` row issued; profile remains Trip member.
- Offline-bootstrap-queue test: member offline at trigger time → bootstrap queues; member comes online → bootstrap completes; Trip remains blocked from offline-active until completion.
- Re-bootstrap test: wipe device, re-authenticate, re-fetch credentials → same MemberID, fresh Ed25519 keypair; old keypair flagged for orphan-revocation.
- Zero-knowledge server posture test: confirm TripKey is not persisted server-side after delivery (only public keys + assignments).
