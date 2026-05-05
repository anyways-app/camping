# Camp King — iOS App Addendum

Extends `00-core.md`. Only iOS-specific decisions live here.

## Stack

- **React Native + Expo** (managed workflow, Expo SDK ≥ 51).
- Shares `packages/ui` and `packages/api-client` with the Android app.
- **Expo Router** for navigation, with the swipe-card surface as a custom gesture handler over a flat list.
- **Reanimated 3** + **react-native-gesture-handler** for the swipe / long-press gestures.

## Distribution

- TestFlight for beta, App Store for production.
- Bundle ID: `app.campking.ios` (placeholder — confirm at Apple Developer setup).

## Auth

- **Sign in with Apple is mandatory** if Google Sign-In is offered (App Store Review Guideline 4.8). Implemented via `expo-apple-authentication`.
- Google OAuth via `expo-auth-session`.
- Phone OTP via Supabase Auth.

## Sensor integration (v1)

| Sensor / capability | iOS API | Card field populated | Notes |
|---|---|---|---|
| GPS / location | Core Location (`CLLocationManager`) | `geo_point` | Request "while in use" first; "always" only if the user opts into a v2 background-tracking feature. |
| Barometer / altitude | `CMAltimeter.relativeAltitude` + Core Location absolute altitude | `elevation_m` | Available iPhone 6+. |
| Pedometer / motion | `CMPedometer` + HealthKit (steps + distance) | `trail_length_m` | "Trail mode" UI: tap to start at trailhead, tap to stop and attach distance to the next card created. HealthKit prompts on first use. |
| Compass + gyroscope | `CMMotionManager` (magnetometer + device motion) | `compass_heading_deg` | Snapshot the heading at the moment of capture. |
| Camera | `AVFoundation` via Expo Camera | `image_url` (origin = `camera`) | Standard photo capture path. |
| Microphone | `AVAudioRecorder` via `expo-av` | `voice_clip_url` | Optional 15-second ambient/voice clip attached to a card. |
| **Ambient temperature** | **Not available on iOS — no public API exposes the device's internal thermal sensors as ambient temperature.** | `ambient_temp_c`, `ambient_temp_source = weather_api` | Fallback: query Apple WeatherKit (`WeatherService`) for the card's `geo_point`. UI labels it as "ambient temp (weather)" so users aren't misled. |

## LiDAR fantastical mode (iOS Pro only — premium fun feature)

A genuinely novel image-creation path that justifies bringing AI image generation back into v1 scope, **gated to LiDAR-equipped iPhones**.

- **Hardware gate.** At runtime, check `AVCaptureDevice.default(.builtInLiDARDepthCamera, for: .video, position: .back)`. If absent, hide the entry point. Available on iPhone 12 Pro / Pro Max and all later Pro / Pro Max models, plus iPad Pro.
- **Capture.** Take an RGB photo + a synchronized depth map via `AVDepthData`. Render a composed source image: RGB on one side, depth visualization on the other, OR an RGB image with depth-driven stylization (e.g., depth-based posterization).
- **AI render.** POST the composed source + a camping-themed system prompt ("transform this LiDAR-aware capture into a fantastical campsite scene; preserve the spatial composition") to **nano banana** (Gemini 2.5 Flash Image). The output replaces the source as the card image. `image_origin` is set to `lidar_ai`.
- **Card decoration.** A small "Made with LiDAR" badge appears on cards with `image_origin = lidar_ai`.
- **Cost guard.** v1 limit: 5 LiDAR-fantastical generations per user per day. Counter resets at local midnight. Server-side enforced via a Supabase Edge Function that gates the nano banana call.
- **Failure path.** If nano banana fails or moderation rejects the output, the user is offered the original RGB photo to post instead, with no charge counted against the daily limit.
- **Scope of nano banana in v1.** This is the **only** v1 use of nano banana. The general "describe an image and generate" flow remains deferred per core.

## LiDAR Night Sight (iOS Pro only — safety / utility feature)

A pure utility feature that uses LiDAR's ability to see in zero light (it emits its own IR) to give campers a usable view of their immediate surroundings at a dark campsite. Same hardware gate as fantastical mode, but a different code path — real-time render, no AI, no card creation in v1.

- **Why this matters for camping.** Campsites are often poorly lit; the iPhone's regular camera is useless in real darkness; flashlights destroy night vision. LiDAR is the only on-device sensor that produces a usable image in zero light because it actively emits IR pulses and measures return time.
- **Hardware gate.** Same runtime check as fantastical mode (`builtInLiDARDepthCamera`). Hide the entry point on non-LiDAR devices.
- **What the user sees.** Full-screen real-time render of the LiDAR depth field, artificially colored (proposed default: distance-banded palette — close = warm yellow, mid = cyan, far = deep blue, beyond range = black). Optional alternate palettes (high-contrast monochrome for accessibility, "campfire" warm gradient).
- **Implementation.** Custom Expo native module wrapping a SwiftUI / Metal / RealityKit view that consumes the `AVCaptureSession` LiDAR stream. Cannot be done in pure RN. Estimate: 1–2 weeks of focused iOS native work, beyond the RN baseline used elsewhere in v1.
- **Session-based, never always-on.** Big "Start Night Sight" button; "Stop" button to exit. Auto-timeout after 5 minutes of continuous use to limit battery drain. Per-session battery-impact telemetry to a private analytics table so we can tune.
- **Range disclosure (mandatory UX).** A persistent on-screen badge reads "LiDAR range ≈ 5m" so users don't trust it for distant hazards. First-launch dialog: "Night Sight reveals your immediate surroundings (within about 5 metres). It is not a substitute for a flashlight when scanning for wildlife or distant terrain."
- **Auto-suggest trigger (nice-to-have).** When the ambient light sensor (`AVCaptureDevice.iso` or the dedicated ambient light reading) falls below a darkness threshold, surface a non-blocking "Night Sight available" toast on the feed. Easy add on top of the core feature.
- **No card creation in v1.** Night Sight is a navigation tool, not a content tool. v2 candidates (see core deferred list items 12 and 13): a Night-Sight → fantastical bridge for posting; a **Gaussian Splatting** upgrade that accumulates LiDAR + RGB into an incremental on-device splat for a much wider perceived FOV than raw point-cloud. The bridge and the splat upgrade are **not** in v1.
- **Permissions.** Camera permission only (`NSCameraUsageDescription`). Already declared for the regular capture flow.
- **Reject for App Store review risk.** Be explicit in the App Store description that Night Sight is a short-range visualization aid, not a safety device — pre-empt any "your app told me I could see in the dark and I got hurt" complaint.

## Casting (v1)

- **Screen Mirroring to AirPlay receiver only.** No app-side AirPlay code; users initiate via Control Center → Screen Mirroring.
- App should keep the screen awake (`useKeepAwake` from Expo) while in slideshow so casting doesn't drop.
- v2 may build a true AirPlay receiver protocol implementation.

## Push notifications

- APNs via `expo-notifications` and Expo Push Service.
- Categories: `new_card_from_friend`, `forwarded_to_you`, `moderation_decision`, `system_announcement`.

## Privacy strings (Info.plist usage descriptions)

These must be set or the app is rejected at App Store review:

- `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`
- `NSLocationWhenInUseUsageDescription`
- `NSMotionUsageDescription`
- `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`
- `NSContactsUsageDescription` (for the contact-import flow if reading the device address book directly; if only CSV import, this is not needed)

## App Store review risk areas

- Sign in with Apple parity (resolved by including it).
- Contact-import privacy: ensure the policy clearly states uploaded contacts are not exposed to anyone but the uploader; reciprocal-only matching.
- Moderation: pre-mod queue must demonstrably block adult content before App Store reviewers see the production feed.
- AI image generation (LiDAR mode): include in the app description that posts may be AI-generated.

## iOS-only verification additions

In addition to cross-platform checks in core:
- Sign in with Apple works and returns to the app.
- A card created on a LiDAR-equipped iPhone Pro shows the "Made with LiDAR" badge and the AI-rendered image.
- A card created on a non-Pro iPhone hides the LiDAR entry point entirely.
- Elevation field is populated by barometer when posting outdoors.
- Trail-mode start → walk → stop → next card has `trail_length_m` set correctly.
- Ambient temp is `weather_api`-sourced and labelled accordingly.
- Daily LiDAR generation limit is enforced server-side (try 6 in a day → 6th rejected).
- AirPlay screen mirroring keeps the slideshow running without the screen dimming.

## BLE mesh (Mesh-v1 track)

This section captures the iOS-specific surface for the offline BLE mesh capability scoped to Trips. The cross-platform contract lives in [`40-offline-mesh.md`](40-offline-mesh.md); this addendum covers what's iOS-only.

### Hardware / OS floor

- **iOS 16.0+.** Devices below this floor fall back to online-only Trips (no offline capability offered, clear UX message).
- Required for: CoreBluetooth maturity, MultipeerConnectivity stability for iPhone-group mode.

### API surface

- **CoreBluetooth** — central + peripheral roles for the Mixed-mode (service-UUID-encoded) baseline:
  - `CBPeripheralManager` for advertising (`startAdvertising(_:)`).
  - `CBCentralManager` for scanning (`scanForPeripherals(withServices:options:)`).
  - Service UUIDs as the payload carrier per FEAT-113 wire protocol.
- **MultipeerConnectivity** — used for the iPhone-group optimization mode (FEAT-120). Richer transport, larger payloads. Falls back to Mixed mode if any Android peer joins.
- **CryptoKit** — TripKey AES-CCM (`AES.GCM` is the iOS-canonical AEAD; AES-CCM availability via `CryptoKit.SymmetricKey` + custom CCM via `CommonCrypto` is the v1 path; see FEAT-113 OQ on AEAD-mode parity with Android). Ed25519 signatures via `Curve25519.Signing`. X25519 sealed-box via `Curve25519.KeyAgreement` + AES-GCM.
- **Keychain Services** (`Security.framework` via `kSecAttr…`) for at-rest persistence of TripKey + Ed25519 private key.

### Background-mode behaviour (load-bearing)

iOS strips manufacturer data and moves service UUIDs into a special **overflow area** when the app is backgrounded. Android peers cannot decode the overflow representation. Practical consequence: **backgrounded iOS devices effectively become iOS-only nodes.** Either the product accepts this (the brief flags this as ambiguity 4 / FEAT-120 OQ 8), OR the Trip-active UX keeps the app foregrounded — a screen-on persistent indicator is the likely v1 path.

`Info.plist` `UIBackgroundModes`: include `bluetooth-central` and `bluetooth-peripheral`. Even with these, the overflow-area constraint above still applies for cross-platform interop in background.

### Permissions / Info.plist usage descriptions

Add to `Info.plist`:

- `NSBluetoothAlwaysUsageDescription` (iOS 13+) — required for any Bluetooth use. User-facing string: *"Camp King uses Bluetooth to keep your Trip group connected when there's no internet at the campsite."*
- `NSBluetoothPeripheralUsageDescription` (iOS 12 and earlier; for forward compatibility) — same rationale string.
- Background mode entitlements as above.

No additional permission strings needed beyond the existing FEAT-074..076 location / camera / microphone / contacts entries.

### Battery mode (FEAT-120) on iOS

iOS gives less control over scan duty cycle than Android. The "Minimal" and "Boost" modes will look slightly different across platforms (FEAT-120 OQ 9):

- **Minimal:** rely on `CBCentralManager` default scan with `CBCentralManagerScanOptionAllowDuplicatesKey: false`; advertising at 2s ON / 28s OFF as a software-controlled duty cycle on top of the OS's own throttling.
- **Boost:** `CBCentralManagerScanOptionAllowDuplicatesKey: true`; advertising at 2s ON / 8s OFF. Still subject to the OS's eventual throttling if backgrounded.

### Acceptance test additions

Cross-platform acceptance tests in `00-core.md` § Mesh-specific verification apply. iOS-only additions:

- Verify `Info.plist` Bluetooth-usage strings render correctly at first prompt on iOS 16, 17, and the latest iOS major.
- Verify backgrounded iOS device stops advertising in a way Android can decode (overflow-area observation).
- Verify Keychain persistence survives app reinstall *without* iCloud Keychain enabled (TripKey should be local-only).
