---
id: FEAT-120
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-112, FEAT-113]
last_reviewed: 2026-05-04
---

# FEAT-120: Battery & platform optimization modes

## Summary

Two user-facing radio-tuning toggle surfaces, collapsed into a single FEAT because they tune the same subsystem (BLE radio duty cycle and transport):

1. **Battery modes** — Minimal (default; advertise 2s ON / 28s OFF, 10% scan duty) vs. Boost (advertise 2s ON / 8s OFF, continuous scan). User toggles in Trip settings; persists per Trip.
2. **Platform optimization modes** — Mixed (default; service-UUID-encoded ~16-byte payloads, lowest common denominator) vs. iPhone-group (MultipeerConnectivity for richer transport when all peers are iOS) vs. Android-group (BLE 5 extended advertising for ~255-byte payloads when all peers are Android with capable hardware). At Trip start, the app surveys peer platforms via initial presence beacons and proposes a mode; the user accepts or overrides.

## Roles & permissions

- **Any Trip member** can toggle battery mode for *their own device*. Battery mode is per-device, per-Trip; not a Trip-wide setting.
- **Trip creator** can recommend a Trip-wide platform-optimization mode based on the surveyed peer mix; each member's device honours their own per-device override.
- The leader has no special authority over battery mode beyond their own profile; a sub-profile's battery mode is the sub-profile's choice (on the device they're using).

## Surfaces

- **Trip detail screen → "Mesh settings"** (per-device, per-Trip): battery-mode toggle and optimization-mode picker.
- **Trip start flow** (FEAT-112) shows a one-time "We see this Trip is all iPhones — switch to iPhone-group mode for faster delivery?" or equivalent prompt.

## Behaviour

### Battery modes

| Mode | Advertise on | Advertise off | Scan |
|---|---|---|---|
| Minimal (default) | 2 s | 28 s | LOW_POWER (Android) / OS-default (iOS); 10% duty cycle target |
| Boost | 2 s | 8 s | LOW_LATENCY (Android) / continuous (iOS) |

- User toggles in Trip settings; persists in local DB tagged by `(trip_id, device_id)`.
- Mode change applies on the next advertise cycle (no restart of the foreground service).
- iOS gives less control over scan duty cycle; "Minimal" and "Boost" will look slightly different across platforms (FEAT-120 OQ 9 below — kept as a known divergence).
- **Battery test acceptance** (`00-core.md` step 27): 10-device Trip in Minimal mode, 8 hours simulated camping, p95 device battery drain ≤ 24% (3%/hr idle).

### Platform optimization modes

#### Survey

At Trip start, every device emits an initial **presence beacon** (FEAT-115) containing a single byte indicating its platform: `0x01` iOS, `0x02` Android, `0x03` Android with BLE 5 extended advertising hardware support. The survey runs for the first 60 seconds of `offline-active` state.

After 60s:

- **All `0x01`**: app surfaces "Switch to iPhone-group mode?" suggestion.
- **All `0x02` or `0x03` with all `0x03` capable**: surfaces "Switch to Android-group mode?".
- **Any mix**: stays in Mixed mode silently.

Trip creator (issuer) accepts or dismisses; on accept, the suggestion broadcasts as an `EXTENSION` message type (FEAT-113 `0x06` reserved for in-protocol extensions) telling all peers to switch.

#### Mode behaviour

| Mode | Transport | Per-message payload budget | Reverts to Mixed when |
|---|---|---|---|
| Mixed (default) | Service-UUID-encoded ~16 bytes per service UUID; chained for longer messages | ~16B per UUID; chain for longer | always usable |
| iPhone-group | MultipeerConnectivity over BLE + Wi-Fi peer-to-peer | ~256+ KB per message (effectively unlimited for our use) | any non-iOS peer joins |
| Android-group | BLE 5 extended advertising (`AdvertisingSetParameters` with `setLegacyMode(false)`) | ~255 bytes per message | any iOS peer or Android-without-BLE-5 peer joins |

#### Mode transitions

- **Mode upgrade** (Mixed → iPhone-group / Android-group): on issuer's command after survey + acceptance.
- **Mode downgrade** (group → Mixed): triggered automatically when a peer joins whose presence beacon doesn't match the current mode. Transition is graceful: every device re-encodes its outbound queue using the Mixed-mode wire protocol within one advertise cycle.
- **Iceberg case**: a backgrounded iOS device may not be visible to the survey but is still a Trip member. The active mode applies to *currently-active* devices; the iceberg device joins the mesh in whatever mode is active when it foregrounds. *(Open question 1.)*

## Data

Reads:
- Local battery-mode state (`(trip_id, device_id)` keyed).
- Trip-level platform-optimization-mode state (server-side; broadcast as an EXTENSION message).
- Inbound presence beacons (platform survey).

Writes:
- Battery mode: local DB, per-device.
- Platform optimization mode: server-side `trips.platform_optimization_mode`, propagated to every device via Realtime + via in-mesh EXTENSION message for offline propagation.

## Edge cases

- **Survey misses a backgrounded iOS device**: the device is in iOS overflow-area land; Android peers can't see it; the survey thinks "all visible peers are Android" and may suggest Android-group mode. Transition to Android-group works; when the iOS device foregrounds and starts visible advertising, mode auto-downgrades to Mixed. Acceptable.
- **Issuer leaves before accepting a mode suggestion**: stays in Mixed. Co-leader can re-trigger a new suggestion if conditions warrant.
- **Mode downgrade mid-conversation**: in-flight messages encoded for Android-group's wider payload will be retransmitted using Mixed-mode chaining. No data loss.
- **All peers are iOS at survey, but one Android peer arrives 10 minutes in**: auto-downgrade to Mixed when the Android device's presence beacon arrives.
- **BLE 5 extended advertising hardware variability** (Samsung A-series may not support; Pixel does; OEM-specific): the device's presence-beacon platform byte (`0x02` vs `0x03`) declares its own capability honestly. Mode survey reads accurately.
- **iOS battery throttling under sustained Boost mode**: iOS may eventually throttle the app's BLE advertising regardless of "Boost" setting. UX: Boost is best-effort on iOS; document this in the Trip settings explainer.
- **Background-mode interaction**: backgrounded iOS device falls back to overflow-area UUIDs regardless of battery mode. Cross-platform interop in background is, in practice, only possible while every iOS device is foregrounded. (See `20-ios.md` § BLE mesh.)

## Out of scope

- **Wi-Fi Aware / NAN as alternative transport**: Mesh-v2.
- **Device-class-aware optimization** (e.g. "iPhone Pro can do X, regular iPhone cannot"): Mesh-v1 treats all iOS devices equally. Detail emerges in iPhone-group mode based on what each device's MultipeerConnectivity supports.
- **Adaptive battery mode** that auto-switches based on battery level: Mesh-v1 is user-toggle-only. *(Open question 2.)*
- **Latency-driven optimization** ("if delivery is slow, switch to Boost automatically"): Mesh-v1 is user-toggle-only.

## Open questions

1. **Backgrounded-iOS survey iceberg**. Default: ignore at survey time; downgrade auto-triggers when the iOS device foregrounds. Sufficient? *(eng)*
2. **Adaptive battery mode**: auto-Boost when battery > 50% / auto-Minimal when battery < 30%. Default: not in v1; user-toggle only. *(product)*
3. **Tech stack confirmation**: is the existing app native iOS / Android, RN Expo, or Flutter? Implementation strategy differs significantly. **This is the highest-priority pre-build OQ.** *(product, eng)*
4. **iOS background advertising**: the overflow-area constraint means backgrounded iOS effectively becomes iOS-only. Either accept (current default) or design a UX that keeps the app foregrounded during Trip-active periods. *(product, design)*
5. **iOS / Android battery-mode parity**: the Minimal and Boost modes will behave slightly differently across platforms because iOS gives less control over scan duty cycle. Document in user-facing settings UI. *(eng, design)*
6. **Manufacturer quirks for Boost on Android**: Samsung One UI / Xiaomi MIUI battery savers may suppress sustained Boost. Whitelisting guidance per OEM. *(eng, ops)*
7. **Mode-suggestion UX dismissal**: if the issuer dismisses a mode-suggestion prompt 3 times in one Trip, stop suggesting. Default: yes. *(design)*
8. **Initial-survey duration tuning**: 60 seconds. Long enough? Short enough? *(eng)*

## Cross-platform notes

- **iOS** (`20-ios.md` § BLE mesh): `CBPeripheralManager` for advertise; `CBCentralManager` for scan; `MultipeerConnectivity` for iPhone-group transport. Battery mode tunes advertise / scan parameters; Boost is best-effort under iOS background throttling.
- **Android** (`30-android.md` § BLE mesh): `BluetoothLeAdvertiser` with `AdvertiseSettings.ADVERTISE_MODE_BALANCED` (Minimal) / `LOW_LATENCY` (Boost). `BluetoothLeScanner` with `SCAN_MODE_LOW_POWER` / `LOW_LATENCY`. BLE 5 extended advertising via `AdvertisingSetCallback` for Android-group mode.
- **Web**: web does not participate in the mesh.

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification:

- **Step 27 (Battery test)**: directly verifies Minimal-mode 8-hour drain is ≤ 24% p95.
- **Step 31 (Cross-platform test)**: 5 iOS + 5 Android in Mixed mode validates the lowest-common-denominator path.

Proposed additions:

- Mode upgrade test: 10 iOS devices; survey identifies all-iOS; issuer accepts iPhone-group; verify MultipeerConnectivity transport activates.
- Mode downgrade test: in iPhone-group mode, an Android device joins; verify auto-downgrade to Mixed within one advertise cycle; verify in-flight messages re-encode.
- Boost-mode iOS battery: 10 iOS devices in Boost mode, 8 hours; document the iOS battery-throttling behaviour in field-test notes.
- Manufacturer-quirk test: Samsung Galaxy + Xiaomi Mi devices in Boost mode for 8 hours; document any user-action required to keep foreground service alive.
- Survey-iceberg test: backgrounded iOS device exists during initial survey; verify Mode survey + auto-downgrade behaves correctly when iOS foregrounds.
