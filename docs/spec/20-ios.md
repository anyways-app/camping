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
