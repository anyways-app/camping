# Camp King — Android App Addendum

Extends `00-core.md`. Only Android-specific decisions live here.

## Stack

- **React Native + Expo** (managed workflow, Expo SDK ≥ 51).
- Shares `packages/ui` and `packages/api-client` with the iOS app.
- **Reanimated 3** + **react-native-gesture-handler** for swipe / long-press gestures.
- Target SDK 34+ at launch; min SDK 26 (Android 8.0).

## Distribution

- Google Play: Internal testing → Closed testing → Production tracks.
- Application ID: `app.campking.android` (placeholder — confirm at Play Console setup).

## Auth

- Phone OTP via Supabase Auth (Twilio/MessageBird routed).
- Google Sign-In via `expo-auth-session`.
- Apple Sign-In offered for parity with the iOS app's account migration story.

## Sensor integration (v1)

| Sensor / capability | Android API | Card field populated | Notes |
|---|---|---|---|
| GPS / location | `FusedLocationProviderClient` (Google Play Services) | `geo_point` | Request `ACCESS_FINE_LOCATION`. Foreground-only in v1. |
| Barometer | `Sensor.TYPE_PRESSURE` via `SensorManager` | `elevation_m` | Convert pressure → altitude with the standard atmospheric formula or use Google's Activity Recognition fused signal. Available on most modern Android phones. |
| Pedometer / motion | **Health Connect** (preferred) with **Google Fit fallback** for older devices | `trail_length_m` | "Trail mode" UI mirrors iOS. Health Connect requires Android 14+; fall back to Google Fit on older devices. |
| Compass + gyroscope | `Sensor.TYPE_ROTATION_VECTOR` (fused) — preferred over raw magnetometer + gyroscope | `compass_heading_deg` | Snapshot at capture moment. Calibrate-prompt UI if heading is noisy. |
| Camera | CameraX via Expo Camera | `image_url` (origin = `camera`) | Standard photo capture. |
| Microphone | `MediaRecorder` via `expo-av` | `voice_clip_url` | Optional 15-second clip attached to a card. |
| **Ambient temperature** | `Sensor.TYPE_AMBIENT_TEMPERATURE` if hardware present, else weather API | `ambient_temp_c`, `ambient_temp_source = sensor` or `weather_api` | At runtime: `sensorManager.getDefaultSensor(TYPE_AMBIENT_TEMPERATURE)`. If non-null, read it and set source = `sensor`. Otherwise query a weather API (e.g., Open-Meteo) for the card's `geo_point` and set source = `weather_api`. **Reality check:** native ambient-temp hardware is rare — only some Samsung Galaxy S/Note flagships ship it. Expect ~95% of users to receive the weather-API value. |

## LiDAR / depth

- Android does not have a direct equivalent to Apple's LiDAR sensor that's exposed uniformly across devices. Some flagships have ToF (time-of-flight) sensors, but coverage is fragmented and ARCore's depth API is software-derived on most devices.
- **v1 decision:** the LiDAR fantastical AI-render mode is iOS-Pro-only. Do not attempt an Android equivalent in v1. v2 may add an ARCore Depth-API path with the same nano banana flow if device coverage and depth quality justify it.

## Casting (v1)

- **Screen mirroring via Google Cast** only. Users initiate via the system Cast UI (or Quick Settings tile).
- Keep screen awake during slideshow via `expo-keep-awake`.
- v2 may build a Google Cast custom receiver for true streaming.

## Push notifications

- FCM via `expo-notifications` and Expo Push Service.
- Channels: `new_card_from_friend`, `forwarded_to_you`, `moderation_decision`, `system_announcement` (Android 8.0+ requires explicit channel registration).

## Permissions to declare

- `INTERNET`
- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
- `CAMERA`
- `RECORD_AUDIO`
- `READ_MEDIA_IMAGES` (Android 13+) / `READ_EXTERNAL_STORAGE` (Android 12 and below)
- `READ_CONTACTS` (only if reading the device address book directly; not required for CSV import)
- `ACTIVITY_RECOGNITION` (for pedometer)
- Health Connect permissions declared via the Health Connect SDK's permission flow (not in the manifest)
- `POST_NOTIFICATIONS` (Android 13+)

## Play Store review risk areas

- **Data safety form** must accurately disclose contact-list collection and the mutual-discovery posture.
- **Contacts permission** rationale must be clear and justified — uploaded contacts are stored privately to the uploader and used only for mutual-match discovery.
- **Sensitive permissions** (`ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` if ever added) require an in-app rationale screen before the system prompt.
- Moderation: pre-mod queue must block adult content before reviewers see the production feed.

## Android-only verification additions

In addition to cross-platform checks in core:
- App installs cleanly on a device running min SDK (Android 8.0).
- Phone OTP, Google sign-in, and Apple sign-in all complete.
- Trail mode start → walk → stop → next card has `trail_length_m` populated.
- Compass heading is captured per card, with calibration prompt when noisy.
- On a phone **with** ambient-temp hardware: card shows `ambient_temp_source = sensor`.
- On a phone **without** ambient-temp hardware: card shows `ambient_temp_source = weather_api` (verify with Pixel or a non-Samsung-flagship device).
- Google Cast screen mirroring keeps the slideshow running without dimming.
- Health Connect prompt shown on first trail-mode start (Android 14+).

## BLE mesh (Mesh-v1 track)

This section captures the Android-specific surface for the offline BLE mesh capability scoped to Trips. The cross-platform contract lives in [`40-offline-mesh.md`](40-offline-mesh.md); this addendum covers what's Android-only.

### Hardware / OS floor

- **Android 12+ (API 31+).** Devices below this floor fall back to online-only Trips (no offline capability offered, clear UX message).
- Required for: the runtime permission model `BLUETOOTH_SCAN` / `BLUETOOTH_ADVERTISE` / `BLUETOOTH_CONNECT` with the `neverForLocation` flag, and modern foreground-service semantics.

### API surface

- **`BluetoothLeAdvertiser`** for advertising in the Mixed-mode (service-UUID-encoded) baseline. `AdvertiseSettings` set to `ADVERTISE_MODE_LOW_LATENCY` for Boost mode; `ADVERTISE_MODE_BALANCED` (or LOW_POWER) for Minimal.
- **`BluetoothLeScanner`** for scanning. `ScanSettings.SCAN_MODE_LOW_LATENCY` for Boost; `SCAN_MODE_LOW_POWER` for Minimal.
- **BLE 5 extended advertising** path for Android-group optimization mode (FEAT-120). `AdvertisingSetCallback` + `AdvertisingSetParameters` with `setLegacyMode(false)` enables ~255-byte payloads. Falls back to Mixed mode if any iOS peer or unsupported Android joins.
- **Foreground service** (`Service.startForeground(...)`) — required for sustained scanning / advertising on Android 12+. Must show a persistent notification ("Camp King is keeping your Trip group connected"). Service type per Android 14: `foregroundServiceType="connectedDevice"` in the manifest.
- **Conscrypt / `javax.crypto`** for AES-CCM. Ed25519 via Conscrypt (Android 11+) or `BouncyCastle` (older — moot here since floor is API 31). X25519 sealed-box via Conscrypt KeyAgreement + AES-GCM.
- **Android Keystore** for at-rest persistence of TripKey + Ed25519 private key (`KeyGenParameterSpec.Builder` with `setUserAuthenticationRequired(false)` since unattended re-keying must work; FEAT-119 OQ on UA-required hardening).

### Permissions / manifest entries

Add to `AndroidManifest.xml`:

- `<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" tools:targetApi="s" />`
- `<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />`
- `<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />`
- `<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />`
- `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />` (Android 14+)
- The existing `BLUETOOTH` and `BLUETOOTH_ADMIN` for Android 11 and earlier (moot at API 31 floor; declare for forward-compat manifest cleanliness).

The `neverForLocation` flag on `BLUETOOTH_SCAN` is **required** to avoid prompting the user for fine-location permission alongside Bluetooth — the mesh does not need device location for the scan itself.

User-facing rationale strings (in pre-prompt UI):
- *"Camp King uses Bluetooth to keep your Trip group connected when there's no internet at the campsite. We do not use Bluetooth for advertising or to track your location."*

### Battery mode (FEAT-120) on Android

Android exposes more granular control than iOS:

- **Minimal:** `ADVERTISE_MODE_BALANCED` + `SCAN_MODE_LOW_POWER`; advertising at 2s ON / 28s OFF as a software-controlled duty cycle.
- **Boost:** `ADVERTISE_MODE_LOW_LATENCY` + `SCAN_MODE_LOW_LATENCY`; advertising at 2s ON / 8s OFF.

Manufacturer quirks to test (FEAT-120 OQ 9):
- **Samsung One UI** historically aggressive about killing background scanners; foreground service mitigates but Doze-mode behaviour varies by OEM.
- **Xiaomi MIUI** has notoriously restrictive battery-saver defaults that suppress notifications and background work; user may need to manually whitelist the app in Settings → Battery saver.
- **Pixel** is the reference platform; least quirky.

### Acceptance test additions

Cross-platform acceptance tests in `00-core.md` § Mesh-specific verification apply. Android-only additions:

- Verify foreground-service notification is shown the entire duration of an active Trip; user dismissing the notification does not stop the service.
- Verify `BLUETOOTH_SCAN` runtime prompt shows the rationale string and does **not** chain into a fine-location prompt (the `neverForLocation` flag).
- Verify foreground-service survives Doze-mode entries (overnight idle).
- Verify Samsung Galaxy + Xiaomi Mi devices: foreground-service is not killed by manufacturer battery savers within the 8-hour acceptance window. Document any required user-facing "please whitelist this app" guidance per OEM.
- Verify Keystore persistence survives app reinstall (TripKey and Ed25519 private key are not migrated to the new install — bootstrap re-issues, which exercises FEAT-111).
