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
