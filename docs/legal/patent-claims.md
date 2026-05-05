# Camp King — Patent boundary

This document captures the patent-relevant boundary between **what Camp King intends to claim as novel** and **what is acknowledged prior art**, distinct from the product spec (`docs/spec/`) which describes *what we build*. This separation is intentional: the spec is the binding contract for engineering; this file is the input for legal strategy and patent attorney engagement.

Source brief carrying this boundary: [`docs/briefs/offline-mesh-engineering-brief.md`](../briefs/offline-mesh-engineering-brief.md), Constraint C, received from vividConsulting.info on 2026-05-04.

## Contributor

Boundary documentation contributed by **vividConsulting.info** (SKrishnan Media Enterprises Inc., DBA), 2310 N Henderson Ave Ste B Unit 1591, Dallas, TX 75206. See repo-root `NOTICE`.

## Application-layer claims (novel; candidate for patent filing)

The following are believed novel and worth examining for patent filing. None of these is a transport-layer mechanism standing alone — each is a specific composition of existing primitives within the consumer family-trip context.

| # | Claim | Brief-section anchor | Spec / FEAT anchor |
|---|-------|----------------------|--------------------|
| C1 | **Trip lifecycle as a first-class domain object.** Online bootstrap → user-initiated transition to offline-active → online resume — applied to a consumer family-trip context with parent-owned account holding multiple per-member profiles. | FR-1, FR-2 | `docs/spec/00-core.md` § Trips; FEAT-022 lifecycle; FEAT-111 bootstrap; FEAT-112 offline-active transition |
| C2 | **Dictionary-extension UX with version-pinning per Trip.** A platform-bundled base vocabulary (1,024 entries) plus a Trip-scoped user-extension layer (up to 256 entries) frozen at Trip start, sync'd to all members during the online bootstrap window. | FR-12, Constraint A | FEAT-121 dictionary extension editor |
| C3 | **Family-account integration with mesh.** Parent-owned account, per-member profiles, hierarchical permissions (mesh send / mesh receive gates) imposed by the parent-tier account holder; revocation authority structurally tied to account-holder role rather than to any device or peer. | FR-9; ambiguity 7, 10 | `docs/spec/00-core.md` § Troops & profiles; FEAT-007 gate matrix (with new mesh send / mesh receive rows); FEAT-119 revocation authority |
| C4 | **Silent-delete-with-coordinated-rotation revocation primitive.** A single broadcast that (a) silently instructs an excluded device to delete its credentials and (b) delivers a new TripKey to every remaining member via per-recipient public-key sealed-box envelopes — enforcing forward secrecy independent of the excluded device's cooperation with the delete instruction. **Generic key rotation is acknowledged prior art; the novel claim is the *unified* silent-revocation + coordinated-rotation primitive in a consumer family-trip context** with a privileged-account-holder issuer. | FR-9; Constraint C bullet 4 | FEAT-119 (primary patent-claim FEAT) |
| C5 | **Key-epoch-tagged messages enabling graceful eventual-consistency in an offline mesh.** Every message header carries its key-epoch in cleartext; receivers reject messages from epochs older than (current − 1); rotation broadcasts re-emit on backoff cadence until ACK'd by every remaining member. The novel claim is the application of monotonic-epoch tagging to the offline-store-and-forward case, where members may legitimately be out of range during the rotation window. | FR-9 (eventual-consistency caveat) | FEAT-113 wire protocol (cleartext key_epoch field); FEAT-119 |
| C6 | **"Connected disconnected" UX patterns.** Status visibility, trip lifecycle indicators, family-role displays, and synchronizing-indicator UX during the eventual-consistency window — surfacing the offline-mesh state to a consumer audience without leaking technical details. | FR-9 (synchronizing indicator); product context | `docs/spec/00-core.md` § Trips; FEAT-019..034 trip surfaces |

## Transport-layer prior art (acknowledged, not claimed)

The following are explicitly acknowledged as prior art and **not** claimed by Camp King. Combinations of these primitives are likewise acknowledged as standard composition in the BLE-mesh / secure-group-messaging space.

- BLE mesh networking generally (advertising, scanning, GATT, BLE 5 extended advertising).
- Service-UUID payload encoding (using a 128-bit service UUID as a payload carrier).
- Store-and-forward messaging.
- Multi-hop relay with TTL decrement.
- AES-CCM authenticated encryption.
- Ed25519 digital signatures.
- Sealed-box public-key encryption (X25519-derived ECDH + AES-GCM).
- Generic key rotation schemes (epoch-incrementing, per-recipient envelopes considered in isolation).
- MultipeerConnectivity (Apple).
- Wi-Fi Aware / NAN (Android).
- Foreground services (Android).
- Keychain / Keystore credential persistence (iOS / Android).

## Reading order for the patent attorney

1. Start with `docs/briefs/offline-mesh-engineering-brief.md` (canonical source).
2. Read this file (`docs/legal/patent-claims.md`) for the novel-vs-prior-art split.
3. Read `docs/features/FEAT-119-revocation-and-key-rotation.md` for the highest-stakes single claim (C4).
4. Read `docs/features/FEAT-113-wire-protocol-and-crypto-envelope.md` for the protocol surface that enables C5 (key-epoch tagging).
5. Read `docs/spec/40-offline-mesh.md` for the integrated cross-platform behaviour.
6. Read `docs/features/FEAT-007-per-sub-profile-feature-gate-matrix.md` (with the mesh-send / mesh-receive rows added) for the family-account-integration claim (C3).

## Out of scope of this file

- **Code licensing.** That lives in the repo-root `LICENSE` file (when added). NOTICE captures inbound attribution; LICENSE captures outbound terms.
- **Patent application drafts.** The attorney engagement produces those; this file is upstream of that work.
- **Trademark strategy.** Brand naming review (e.g. "Camp King" vs. "CAMPKING", "Camp Atlas" placeholder, "LiDAR Night Sight" trademark conflict) is tracked separately in `docs/glossary.md`.
