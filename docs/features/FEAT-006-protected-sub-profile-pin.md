---
id: FEAT-006
area: Identity & Accounts
release: v1
status: Spec'd
dependencies: [FEAT-003, FEAT-004, FEAT-005]
last_reviewed: 2026-05-01
---

# FEAT-006: Optional protected sub-profile PIN

## Summary

Sub-profiles are unprotected by default — anyone holding the device after troop auth can tap a sub-profile's avatar and enter that profile, no challenge. The leader can mark any sub-profile **"protected,"** which adds a PIN gate identical in mechanics to the leader-profile PIN (FEAT-005) but optional and per-sub-profile. Useful for: a teen who wants their feed private from siblings; a shared family device where one sub-profile holds something sensitive; a leader who wants to keep a "guest" sub-profile open while protecting the regulars.

## Roles & permissions

- **Troop leader**: sole controller of the protected toggle and the per-sub-profile PIN. Sets the PIN on protect; can change it; can disable protection (which clears the PIN).
- **Sub-profile**: can enter their profile freely if unprotected, or after PIN entry if protected. Cannot self-toggle protection in v1. (Could request the leader change it; out-of-band.) *(Open question 1.)*

## Surfaces

- **Per-sub-profile management screen** (FEAT-009): each sub-profile row has a "Protected" toggle. Flipping on prompts the leader to set a PIN; flipping off clears it.
- **Profile picker** (FEAT-004): protected sub-profiles show a small lock icon next to their display name.
- **PIN entry modal**: same modal component as FEAT-005, just different labels.

## Behaviour

1. Leader navigates to per-sub-profile management → taps a sub-profile → toggles "Protected" on.
2. PIN entry: two passes (enter, confirm). Same validation rules as FEAT-005.
3. Server: hash via Argon2id; store on the sub-profile row as `profiles.pin_hash` and set `profiles.protected=true`.
4. Leader confirms; toggle persists.
5. **PIN entry on profile entry** (FEAT-004): tapping the protected sub-profile avatar surfaces the PIN entry modal. On success, profile becomes active; on failure, lockout policy per FEAT-004.
6. **Disabling protection**: leader flips the toggle off. Confirmation prompt: "Anyone with access to this device will be able to enter [Name]'s profile without a PIN. Continue?" On confirm, server clears `pin_hash` and sets `protected=false`.
7. **Changing the PIN**: leader can re-set from the same management screen (no need to flip off + on). Requires the leader's own PIN (re-auth into leader profile context) before showing the PIN-set modal.
8. **Reset PIN if forgotten**: the leader is the only person who can reset a sub-profile's PIN. Sub-profile users who forget their own protected PIN must ask the leader. *(There is no separate OAuth / OTP path for sub-profile PIN reset — sub-profiles don't own auth identities.)*

## Data

Reads:
- `profiles.pin_hash` and `profiles.protected` for the picker render and the unlock check.

Writes:
- `profiles.pin_hash` and `profiles.protected` on toggle / change.

## Edge cases

- **Leader sets a sub-profile PIN and forgets it.** Same as the change-PIN flow: leader re-enters their own PIN (FEAT-005) → re-set the sub-profile PIN. Effectively a "reset" by the leader. Sub-profile is locked out until the leader does this.
- **Sub-profile attempts to enter a protected profile with the wrong PIN.** Lockout policy per FEAT-004. After persistent failure, the modal shows "Ask your troop leader to reset this PIN" rather than a "Forgot PIN?" link (since there's no self-serve reset).
- **Leader disables protection while the sub-profile is signed-in on another device.** That session continues for the rest of its lifetime; on next profile-entry, no PIN is required.
- **Leader deletes a protected sub-profile.** PIN is wiped along with the profile (cascade per FEAT-003).
- **Race: leader is changing the PIN while sub-profile attempts to enter.** Last write wins; sub-profile may need to retry with the new PIN once the change commits.

## Out of scope

- **Sub-profile self-set PIN** without leader involvement. Default v1: leader-only. Could open up in v2 with a leader-approval flow.
- **Per-sub-profile separate auth identity** (so the sub-profile could reset their own PIN via their own phone / Apple / Google). Tied to the broader v2 conversation about whether sub-profiles ever get auth identities at all.
- **Different PIN policies per sub-profile** (e.g., 6-digit required for some). v1: same policy across all profiles in the troop.
- **Biometric unlock for sub-profiles.** Default v1: leader-only biometric per FEAT-005. Could extend to protected sub-profiles in v1.5. *(Open question 3.)*

## Open questions

1. **Sub-profile self-protect.** Can a sub-profile flip themselves to protected without the leader's involvement? Default: no (leader-only) in v1 to keep the leader-control invariant clean. Could open up in v2. *(product)*
2. **Visibility of "this profile is protected" to other sub-profiles.** The picker shows a lock icon — is that fine, or does it leak the fact that a particular sub-profile has something to hide? Default: show the lock (transparency wins). *(design, security)*
3. **Biometric unlock for protected sub-profiles.** Allow the same Face ID / Touch ID / fingerprint affordance as the leader? Default: yes, opt-in per profile, set by the leader. *(product, security)*
4. **PIN sharing between leader and a protected sub-profile.** Should the platform warn if the leader sets the same PIN they use for their own profile on a sub-profile? Default: no warning — leader's call. *(product)*

## Cross-platform notes

Mostly identical to FEAT-005 on each platform — same PIN entry modal, same biometric integration. The only divergence is the protected-toggle UI in the per-sub-profile management screen, which follows that screen's general platform conventions.

## Verification

Troop-specific:

- **Step 12**: "PIN-protect sub-profile B1 from the leader's settings panel; confirm B1 cannot be entered without the PIN. Confirm the leader profile always requires its PIN regardless of any toggle."

Proposed additions:

- Toggle-on/off cycle: protect a sub-profile, enter via PIN, disable protection, enter without PIN.
- Wrong-PIN lockout: same lockout policy as FEAT-005 / FEAT-004.
- Leader-only-can-reset: sub-profile's "Forgot PIN?" link points to "Ask your troop leader" rather than to a self-serve reset.
- Cascade-on-deletion: delete a protected sub-profile → its PIN is gone too; the leader cannot accidentally retain a "ghost" PIN against a non-existent profile.
