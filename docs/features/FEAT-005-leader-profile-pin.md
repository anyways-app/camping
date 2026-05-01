---
id: FEAT-005
area: Identity & Accounts
release: v1
status: Spec'd
dependencies: [FEAT-001, FEAT-002, FEAT-004]
last_reviewed: 2026-05-01
---

# FEAT-005: Leader profile PIN

## Summary

The troop leader's profile **always** requires a PIN to enter from the profile picker (FEAT-004). The PIN is set by the leader at troop creation (FEAT-001) and is resettable via the leader's verified OAuth / phone-OTP identity. This is the always-on barrier between the leader's master controls (billing, feature gates, contact-sharing toggles) and any other person who happens to be holding the device — including the troop's own sub-profiles.

## Roles & permissions

- **Troop leader:** sets the PIN at signup; can change it from troop settings; can reset it via OAuth / OTP. PIN is mandatory and not toggleable.
- **Sub-profiles:** never see, change, or interact with the leader PIN.
- **Camp King support:** never sees the PIN. Hashed server-side (Argon2 or bcrypt; salt per profile). Recovery is via identity-side reset, not PIN retrieval.

## Surfaces

- **Troop creation flow** (FEAT-001): a "Set your leader PIN" step is mandatory before the leader can enter their feed for the first time.
- **Profile picker** (FEAT-004): tapping the leader avatar surfaces the PIN entry modal.
- **Troop settings → Security**: "Change leader PIN" + "Reset leader PIN" entry points (the second triggers re-auth via OAuth / OTP).

## Behaviour

1. At troop creation, after the troop name + avatar step, the leader is prompted: "Set a 4–6 digit PIN. You'll need it every time you switch into your leader profile."
2. PIN entry: two passes (enter, confirm). Validation: 4–6 digits, no obvious sequences (1234, 0000) — soft warning, not blocking. *(Open question 1.)*
3. Server: hash via Argon2id with a per-profile salt. Store as `profiles.pin_hash`.
4. Leader proceeds to the feed.
5. **PIN entry on profile entry** (FEAT-004 step 4): on each tap of the leader avatar in the picker, modal asks for the PIN. Auto-advance between digit fields (mobile native pattern). Submit on the last digit.
6. Server verifies hash; on success, profile becomes active; on failure, rate-limited per FEAT-004 lockout policy.
7. **Change PIN** flow: enter current PIN → enter new PIN twice → save. Server overwrites `pin_hash`.
8. **Reset PIN** flow (forgot PIN): user taps "Forgot PIN?" on the entry modal → re-auth via the troop's OAuth / phone-OTP identity → set a new PIN. Server overwrites `pin_hash`.
9. **Biometric unlock** (optional, mobile only): leader can enable Face ID / Touch ID (iOS) or fingerprint / device biometric (Android) as an alternative to typing the PIN. The PIN remains the canonical credential; biometrics unlock the stored PIN locally via the platform keychain. *(Open question 2.)*

## Data

Reads:
- `profiles.pin_hash` (compared against entered PIN at unlock time).

Writes:
- `profiles.pin_hash` (set at troop creation; updated on change-PIN; updated on reset-PIN flow).

PIN is never logged, never sent in plaintext over the wire (HTTPS-only; client may submit just the entered digits to a verify endpoint, server hashes and compares).

## Edge cases

- **PIN entered while offline.** Hashed verification is server-side; PIN entry requires connectivity. *(Open question 3.)* Default: if offline, PIN entry shows "Network required to verify PIN — try again when online." Alternative: cache the hash locally for offline verification (security tradeoff). *(security)*
- **Repeated wrong attempts.** Lockout per FEAT-004: 3 wrong → 30 s; 6 wrong/hour → 5 min; 12 wrong/day → 1 h. After 24 wrong cumulative without a successful entry, force a "Reset PIN" flow.
- **PIN reset by an attacker** who has temporary access to the OAuth identity. Out of scope at the platform level — this is the same risk as any password-reset-via-email flow. Mitigation lives in the OAuth provider (2FA on Apple ID / Google).
- **Leader sets a PIN, then changes their phone number.** The PIN persists; only the auth identity changes. PIN reset still works as long as one valid identity remains.
- **Loss of all auth identities.** Support-mediated recovery (per FEAT-002 open question 2). The PIN itself is not recoverable.
- **PIN "remembered" for the duration of a session.** The PIN is required on every entry into the leader profile from the picker, *not* on every action within the leader profile. The leader profile session times out via the standard auth session expiry; PIN re-entry is not required mid-session. *(Open question 4.)*

## Out of scope

- **Multi-PIN per leader** (e.g., a "vacation PIN" that's narrower-permission). Not v1.
- **Time-locked PIN bypass** (e.g., "skip PIN between 8 am and 8 pm"). Not v1.
- **Hardware-key MFA** (YubiKey / similar) at the PIN gate. v2.
- **Plain-text PIN recovery** by support. Architecturally impossible (hashed-only); intentionally out of scope.

## Open questions

1. **Weak-PIN policy.** Soft warning vs. hard rejection of `1234`, `0000`, repeated digits. Default: soft warning (don't fight the user). *(security, product)*
2. **Biometric unlock parity.** v1 yes or v1 no? Default: yes — Face ID / Touch ID on iOS and fingerprint on Android, opt-in from troop settings. PIN remains canonical. *(product)*
3. **Offline PIN verification.** Allow a locally-cached hash for offline unlock (with a server re-sync on next online)? Default: online-only for security; revisit if user reports of "couldn't switch profile on a hike with no signal" pile up. *(security, product)*
4. **PIN re-entry within a single session.** Currently: only at profile entry. Should the leader profile auto-lock after N minutes of inactivity even within a session? Default: no in v1 (rely on app-foreground / app-background to re-trigger picker on cold launch). *(security)*
5. **PIN length.** 4 vs. 6 digits as the minimum. Default: 4 minimum, 6 maximum, leader's choice. *(security, product)*
6. **PIN entropy display.** Should we show a visual strength meter on PIN setup? Default: no — PIN is a low-entropy credential by design, a strength meter would mislead. *(design)*

## Cross-platform notes

- **Web**: PIN entry is a modal with 4–6 numeric input fields. Submit on Enter or auto-advance on the last digit. Biometric unlock not available; PIN-only.
- **iOS**: native modal with `keyboardType="number-pad"`. Optional Face ID / Touch ID via `expo-local-authentication`. Stored PIN unlock key sits in iOS Keychain.
- **Android**: native modal with numeric keyboard. Optional fingerprint / face / device-biometric via `expo-local-authentication`. Stored unlock key in Android Keystore.

## Verification

Troop-specific:

- **Step 12**: "PIN-protect sub-profile B1 from the leader's settings panel; confirm B1 cannot be entered without the PIN. Confirm the leader profile always requires its PIN regardless of any toggle."
- **Step 18**: "Switch from B1 back to the leader profile via the 'Switch profile' entry; confirm the leader's PIN is required..."

Proposed additions:

- Wrong-PIN lockout test (30 s after 3 fails; 5 min after 6/h; 1 h after 12/day).
- Reset-PIN flow test: tap "Forgot PIN?" → re-auth via OAuth → set new PIN → enter with new PIN successfully.
- Change-PIN test: from troop settings, change PIN; old PIN no longer works.
- Biometric-unlock test (mobile only): enable biometrics → tap leader avatar → biometric prompt instead of PIN field; falls back to PIN on biometric failure.
