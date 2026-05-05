---
id: FEAT-112
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-022, FEAT-111, FEAT-120]
last_reviewed: 2026-05-04
---

# FEAT-112: Trip start / offline-active transition

## Summary

The user-initiated "Start Trip" action that transitions a `mesh-enabled` Trip from plain `active` to `active + offline-active` (FEAT-022 substate). At this transition, BLE advertising and scanning begin, the device starts broadcasting a presence beacon every duty cycle, and the dictionary is frozen for the Trip's offline lifetime. This is the moment the offline mesh actually goes live; until now, credentials exist (FEAT-111) but no radio activity has occurred.

## Roles & permissions

- **Trip creator (FEAT-025) or any trip co-leader (FEAT-026)**: can fire "Start Trip" for the Trip as a whole. The Trip-level transition flips `offline-active` for everyone simultaneously.
- **Each individual Trip member's device**: independently starts its own BLE advertising / scanning subsystem on receiving the start signal. A member whose device is offline at start-time begins mesh activity when they next launch the app and find the Trip in offline-active state.
- **Sub-profiles with both `Mesh send` and `Mesh receive` gates off**: no radio activity on their device regardless of Trip state.

## Surfaces

- **Trip detail screen → "Start Trip" CTA**: visible only to the trip creator + co-leaders, only when (a) Trip is `active`, (b) `offline_mesh_enabled=true`, and (c) bootstrap (FEAT-111) is complete for every participating device.
- **Persistent foreground status**: once offline-active, every member's app shows a persistent indicator ("Mesh active — Wind River 2026") in the trip detail and in the device's notification surface. On Android this is a **foreground-service notification** (mandatory per FEAT-120 platform requirements). On iOS this is a status bar / banner.

## Behaviour

1. Trip creator or co-leader taps "Start Trip" on a bootstrap-complete Trip.
2. Confirmation: "Starting offline mesh for Wind River 2026. Each member's device will begin advertising on Bluetooth. Continue?"
3. On confirm, server flips `trips.offline_active_started_at = now()`. Realtime broadcast fires.
4. Each member's device, on receiving the broadcast (or on next app launch if offline at the time):
   - Marks the local Trip state as `offline-active`.
   - Starts BLE peripheral advertising at the duty cycle set by the current battery mode (FEAT-120).
   - Starts BLE central scanning at the corresponding duty cycle.
   - Begins emitting a presence beacon (`message_type=PRESENCE`, broadcast, dictionary index 0) every advertise cycle.
   - On Android: starts a foreground service with the `connectedDevice` foreground-service-type and a persistent notification.
   - On iOS: registers `bluetooth-central` and `bluetooth-peripheral` background modes (already declared in `Info.plist`); shows a persistent in-app banner.
   - Freezes the dictionary at the version pin set by FEAT-111.
5. **Per-device dictionary freeze**: any pending dictionary edits not delivered to all members at bootstrap are dropped. The active dictionary for the rest of the Trip is exactly what was pinned.
6. **Trip-end (FEAT-022 ended) tears down**: stops advertising, stops scanning, terminates the foreground service, drains the queued-but-unsent message queue with one final attempt, then deletes TripKey + Ed25519 private key from Keychain / Keystore. Roster + dictionary remain in encrypted local DB for the Trip's read-only archive.

## Data

Reads:
- `trips.offline_mesh_enabled`, `trips.status`, `trip_credentials` (per-device).

Writes:
- `trips.offline_active_started_at` (server-side, on Trip start).
- `trips.offline_active_ended_at` (server-side, on Trip end).
- Per-device local state: `trip_state.offline_active_locally` boolean.

## Edge cases

- **Battery saver / Doze mode.** On Android, manufacturer battery savers (Samsung One UI, Xiaomi MIUI) may suppress the foreground service. Acceptance: provide UX guidance ("If you're not seeing other members, please add Camp King to your battery exception list"). See `30-android.md` § BLE mesh.
- **Background advertising on iOS.** When the app is backgrounded, iOS moves service UUIDs to the overflow area; Android peers can't decode. Acceptance: persistent banner encouraging foreground; explicit UX message if backgrounding is detected ("Mesh is paused while in background"). See `20-ios.md` § BLE mesh.
- **Network connectivity returns mid-Trip.** Offline-active does NOT preclude online; if the device gets cellular / Wi-Fi back, normal online operation resumes alongside the mesh. The mesh is still useful (fast local delivery; messages relay through devices outside cellular coverage).
- **A bootstrapped device is missing at Trip start.** Trip starts anyway for the present devices. The missing device joins the mesh whenever it next launches the app online (to receive the start signal) or comes back into BLE range of a present member.
- **Hardware-floor non-compliant device.** iOS < 16 or Android < 12 (API < 31). Device cannot participate in mesh; the user sees "Your device is too old for offline mesh — you'll see Trip messages once you're online again." The device remains a Trip member, just not a mesh member.
- **Re-start after Trip end.** Not supported in Mesh-v1. A trip moves once into offline-active and once out (at Trip end). Restart is implementation-deferred. *(Open question 2.)*
- **Permission revocation mid-Trip.** User toggles off Bluetooth or revokes the BLUETOOTH_SCAN permission mid-Trip. Mesh stops cleanly on that device; UX shows "Mesh paused — please re-enable Bluetooth."

## Out of scope

- The wire protocol details — FEAT-113.
- Per-message send / receive logic — FEAT-114 / FEAT-115.
- Battery-mode switching during offline-active — FEAT-120 (allowed; transition is graceful).
- Re-entering offline-active after Trip end (effectively "Trip resume") — not in Mesh-v1.

## Open questions

1. **Trip-end transition triggers.** What ends a Trip and tears down mesh? User action (creator/co-leader marks ended)? Geofence (everyone's left the trip area)? Time elapsed (end_date passed)? All? Ties to FEAT-022 OQ. Default: user action only in v1; geofence and time-elapsed are nice-to-have for v1.x. *(product)*
2. **Mesh restart within the same Trip.** If the creator marks Trip ended then realises a few hours of camping remain, can mesh be re-started? Default: no; ended is final per FEAT-022. Workaround: create a new Trip. *(product)*
3. **Pre-flight check.** Should the Start-Trip confirmation surface a pre-flight summary ("All 14 members' devices are ready" / "2 members not yet ready — wait or start anyway?") to set expectations? Default: yes, surface it. *(design)*
4. **Battery mode default at start.** Minimal (default per FEAT-120), or is there a smarter default based on Trip duration / member count? Default: Minimal. *(product)*

## Cross-platform notes

- **iOS**: foreground via in-app banner; background via `UIBackgroundModes` `bluetooth-central` + `bluetooth-peripheral` (with the overflow-area caveat).
- **Android**: foreground via a `foregroundServiceType="connectedDevice"` service with persistent notification.
- **Web**: web does not participate in the mesh; web users see a "Mesh is active on the trip" indicator and any cards / messages that get to the cloud, nothing more.

## Verification

Cross-platform:

- **Step 27 (Battery test)** through **Step 32 (Persistence test)** all depend on offline-active being correctly entered.

Proposed additions:

- Foreground-service-survives-screen-off test: start the Trip, lock the screen on Android, verify foreground service persists for at least 8 hours.
- iOS-background-degradation test: start the Trip on iOS, background the app, verify the persistent banner / state indicator is unambiguous about the degradation.
- Hardware-floor reject test: install on iOS 15 / Android 11, attempt to join an offline-mesh Trip, verify clean fallback message.
- Trip-end-teardown test: end the Trip, verify TripKey + Ed25519 private key are removed from Keychain / Keystore within the teardown window.
