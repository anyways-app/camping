---
id: FEAT-004
area: Identity & Accounts
release: v1
status: Spec'd
dependencies: [FEAT-001, FEAT-002, FEAT-003, FEAT-005, FEAT-006]
last_reviewed: 2026-05-01
---

# FEAT-004: Profile picker on launch

## Summary

After successful auth (FEAT-074/075/076), the user lands on a Netflix-style **avatar grid** showing every profile in their troop. Tapping an avatar enters that profile (subject to PIN gates per FEAT-005 / FEAT-006). The device remembers the last-active profile to skip the picker on subsequent launches; "Switch profile" is always one tap from anywhere in the app. All non-PIN actions (post a card, send a forward, etc.) execute as the *active profile*, never the leader implicitly.

## Roles & permissions

- **Anyone with valid troop auth** sees the picker after login. The picker shows every profile in their troop — leader's avatar plus all sub-profiles (FEAT-003).
- **Profile selection itself is unauthenticated** at the row level — anyone holding the device after auth can tap any avatar. Authentication for entering a profile happens via the optional PIN gate per profile (FEAT-005 leader; FEAT-006 protected sub-profile).
- **No external visibility:** the picker is never shown to someone who hasn't completed troop-level auth.

## Surfaces

- **Launch flow:** auth screen → (on success, if more than one profile or device-remembered profile is missing/invalidated) → profile picker → (tap avatar, enter PIN if required) → profile-active home screen (the feed by default).
- **Switch-profile entry:** persistent "Switch profile" affordance, reachable from any screen. Mobile: a profile-avatar chip in the top bar that opens a quick switcher; long-press for full picker. Web: same chip pattern in the header.
- **Picker UI:** grid of avatars (typically 4 columns mobile, 6+ desktop), each labeled with display name. Leader's avatar is visually distinguished (FEAT-002 open question 1).

## Behaviour

1. User completes troop-level auth (FEAT-074/075/076). Server returns a session token scoped to the troop, plus the troop's profile list.
2. Client checks: is there a `last_active_profile_id` in local storage AND is its session token still valid?
   - **Yes:** skip the picker; restore that profile's session and route to the feed.
   - **No (first launch, or session invalidated, or "Switch profile" was used):** show the picker.
3. Picker renders: troop name and avatar at top; leader avatar prominently below; sub-profiles in creation order (or leader-pinned order if that becomes a feature). Each row shows display name and a small lock icon if PIN-protected.
4. User taps an avatar.
   - **No PIN required (sub-profile, not protected):** profile becomes active immediately. Save `last_active_profile_id` locally. Route to the feed.
   - **PIN required (leader, or protected sub-profile):** PIN entry modal. On correct PIN: profile becomes active, last-active saved, route to feed. On incorrect PIN: shake animation, retry counter (3 wrong → 30 s lockout for that profile, escalating).
5. **Switch-profile flow:** user taps the profile chip → quick switcher shows the other profiles (excludes the current). Tapping invalidates the current profile's session, then runs steps 3-4 for the chosen profile.
6. **Token re-scope on switch:** every profile switch invalidates the previous profile's session token client-side AND server-side (the server enforces that a request with the previous token fails after the switch). All cached state (feed, contacts, in-flight uploads) is dropped on switch.

## Data

Reads:
- `troops` (name + avatar for the picker header).
- `profiles` (list for the picker rows).
- `profile_feature_gates` (to determine whether a profile is "protected" for the lock-icon hint).

Writes:
- Local storage: `last_active_profile_id`, session tokens.
- Server: session-token issue / invalidate (auth surface; not a Postgres write).
- Server: PIN attempt counter (rate-limit; tied to FEAT-005 / FEAT-006).

## Edge cases

- **Single-profile troop (just the leader, no sub-profiles).** Picker is skipped *only* on second-and-later launches if the leader's PIN is remembered locally; otherwise the picker shows with one avatar so the leader still enters their PIN. *(Open question 1.)*
- **More than 7 avatars** — shouldn't happen in v1 (cap is 7), but if it does (data corruption / future tier), the grid scrolls.
- **Switch-profile while a card upload is in flight.** Default: the upload is cancelled with a "Discard changes?" confirm before the switch completes. *(Open question 3.)*
- **Switch-profile while the user is in an open card creation flow with unsaved drafts.** Same as above: confirm-and-discard, or save-as-draft (TBD).
- **Lockout on repeated PIN failures.** 3 wrong → 30 s lockout. 6 wrong (cumulative within an hour) → 5 min lockout. After persistent failure, a "Forgot PIN?" link surfaces (resets via OAuth/OTP per FEAT-005 / FEAT-006).
- **Network down.** Last-active profile path uses cached session token; if the token is invalid (server rejects on first request), bounce to picker. Picker itself works offline if the profile list is cached locally.
- **Stale picker** (sub-profile created on another device while this device is on the picker). Pull-to-refresh on the picker re-fetches; in practice the picker subscribes to a Realtime channel for the troop and updates live.

## Out of scope

- **Profile-pinning / reordering** by the leader (so the most-used sub-profile sits first). Default v1: creation-order. Could come as a small v1.x add.
- **Custom avatar accent colors per profile.** Default v1: avatars are just images / generated chips.
- **"Guest" or "Hidden" profiles** unmasked via gesture (not on the picker by default). Tied to FEAT-003 open question 1.
- **Picker analytics** (which profile is used most, etc.). Privacy-sensitive; not v1.

## Open questions

1. **Single-profile troop UX.** Skip the picker entirely if the leader is alone in the troop AND the leader profile has no PIN? (PIN is mandatory for the leader per FEAT-005, so this is moot — picker still shows the PIN entry.) Confirm policy. *(product)*
2. **Last-active profile expiry.** How long does the device remember the last-active profile before reverting to the picker? Default: until the auth session expires (typically 30 days). Shorter (e.g., 24 h) would be safer for shared family devices. *(product, security)*
3. **Drafts on profile switch.** Save-as-draft vs. discard-with-confirm? Drafts are also tied to card creation (FEAT-043). *(product)*
4. **Picker "Add new profile" entry point.** Should the picker include a "+ New profile" tile for the leader to quickly create a sub-profile, or is that strictly in troop settings? Default: include the tile, leader-only-visible. *(design)*
5. **Avatar generation algorithm.** Default chip with first 2 chars of display name in a profile-specific color seeded from `profile_id`. Need a small palette (~12 colors). *(design)*

## Cross-platform notes

- **Web**: picker is a full-screen route at `/switch-profile`. PIN entry is a modal. Persistent profile chip in the header.
- **iOS**: picker is a presented modal (full-screen) on first launch / explicit switch. Native PIN entry uses `<Modal>` with auto-advancing digit fields. Optional Face ID / Touch ID instead of PIN per FEAT-005 open questions.
- **Android**: same as iOS shape; uses a Material full-screen dialog. Optional fingerprint / device biometric instead of PIN.

## Verification

Troop-specific:

- **Step 11**: "From the leader profile of troop 1, create a sub-profile B1. B1 appears on the profile picker on next app launch."
- **Step 18**: "Switch from B1 back to the leader profile via the 'Switch profile' entry; confirm the leader's PIN is required and the active session token re-scopes to the leader profile."

Proposed additions:

- Last-active skip test: enter a profile, kill the app, relaunch → bypasses the picker and lands directly in the last profile's feed.
- Token re-scope test: capture the old profile's session token, switch profile, attempt to use the captured token → server rejects with a stable error.
- PIN lockout test: enter wrong PIN 3× → see 30s lockout countdown; enter wrong PIN 6× cumulative within an hour → 5 min lockout.
