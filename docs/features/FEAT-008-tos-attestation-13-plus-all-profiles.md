---
id: FEAT-008
area: Identity & Accounts
release: v1
status: Spec'd
dependencies: [FEAT-001, FEAT-003]
last_reviewed: 2026-05-01
---

# FEAT-008: ToS attestation — 13+ for every profile

## Summary

Camp King requires the troop leader to attest at troop creation that **every user of every profile in the troop is 13 or older**. The platform itself does not classify any profile as a "kids profile" and has no kids mode, no parental-consent flow, and no platform-level age classification. The leader bears responsibility per the ToS; if they hand a sub-profile to an under-13 user, that's outside the platform's actual knowledge. This is the standard general-purpose-social-platform posture (Instagram, TikTok, etc.) and keeps Camp King out of COPPA / GDPR-K compliance scope. A v2+ verified-kids tier (FEAT-010) is in the deferred list.

## Roles & permissions

- **Troop leader**: must accept the ToS attestation at troop creation. Must re-accept on material ToS changes (versioned).
- **Sub-profiles**: do not see, sign, or accept the ToS. The leader's attestation covers them per the spec.
- **Camp King**: presents the ToS, records the acceptance event, and surfaces re-acceptance prompts on version bumps.

## Surfaces

- **Troop creation flow** (FEAT-001): a final step before the troop is created shows the ToS attestation block (NOT a generic "I accept the ToS" — the attestation specifically calls out the 13+ requirement for every profile). Cannot proceed without explicit checkmark.
- **Troop settings → Legal**: leader can re-read the ToS at any time; sees the version they accepted and the date.
- **ToS update prompt**: when the ToS changes materially, the leader sees a blocking prompt on next login: "Camp King's ToS has been updated. Please review and re-accept."

## Behaviour

1. At troop creation (FEAT-001), final step: ToS attestation. The block reads (substance, not exact wording — final language is legal-team owned):

   > "By creating this troop, I confirm that **every person who uses any profile in this troop, including any sub-profiles I create now or in the future, is 13 years of age or older.** I understand that Camp King does not provide a kids' service and that I am responsible for ensuring this requirement is met. [link to full ToS] [☐ I confirm and accept]"

2. Leader checks the box and taps "Create troop." Server records `tos_acceptances (troop_id, leader_profile_id, version, accepted_at, ip_address, user_agent)`.
3. Troop is created (FEAT-001 step 3 onward).
4. **Re-attestation on sub-profile creation**: when the leader creates a new sub-profile (FEAT-003 step 2), the form includes a small reminder: "By creating this sub-profile, you reaffirm that the user of this profile is 13+." A separate row is recorded in `tos_acceptances` with a `reason='sub_profile_create'` tag and the new sub-profile's id. *(Open question 2.)*
5. **ToS version bump**: when legal updates the ToS materially, server flips a `tos_acceptance_required=true` flag on every existing troop. Next login shows the blocking prompt; on accept, a new acceptance row is recorded with the new version.
6. **Refusing to re-accept on version bump**: troop is read-only until accepted. The leader can still browse their feed and existing content; they cannot post, invite, share contacts, or otherwise mutate state. *(Open question 4.)*

## Data

Reads:
- `tos_acceptances` (current version status; date of last acceptance).
- `tos_versions` (active version, materiality flag for "requires re-acceptance").

Writes:
- `tos_acceptances (id, troop_id, leader_profile_id, version, accepted_at, ip_address, user_agent, reason)`. Reason enum: `signup`, `sub_profile_create`, `version_bump_reaccept`.
- `tos_versions` is an internal table managed by ops, not user-writable.

Sub-profile rows do NOT carry their own ToS-acceptance reference — the troop-level acceptance covers them.

## Edge cases

- **Leader skips the box and tries to submit.** Form rejects; "You must confirm to create your troop."
- **Leader's IP / user-agent is unavailable** (privacy-mode browser, etc.). Recorded as null; the acceptance is still valid.
- **ToS version bump in the middle of an active session.** The user finishes their current action (no mid-flight interruption), but on next route navigation, they hit the re-attestation prompt.
- **Troop deletion** (FEAT-001): `tos_acceptances` rows are retained for audit even after the troop is deleted, with a `troop_deleted_at` reference. *(Open question 3 — retention period.)*
- **Multi-jurisdiction users.** GDPR-K in some EU countries sets the threshold at 16, not 13. Default v1: ToS attestation says 13+ universally. If we expand to those markets, the attestation language adjusts based on the leader's billing-country at signup. *(Open question 5.)*
- **Misrepresentation**: if the leader attests 13+ and is later proven to have knowingly granted a sub-profile to an under-13 user, Camp King's recourse is account termination + retention of the acceptance record as evidence. Not a v1 product feature; flagging for the eventual ToS draft.

## Out of scope

- **Verifying the leader is themselves 13+.** Standard ToS posture: the leader-of-record asserts they are; we don't ID-verify. Tied to FEAT-074 / FEAT-075 / FEAT-076 auth.
- **Verifying any sub-profile user's actual age.** Out of scope by design — that's what the verified-kids tier (FEAT-010) is for, and that's deferred.
- **Per-sub-profile age attestation.** v1: troop-level attestation covers all sub-profiles. Per-sub-profile would imply per-sub-profile data on minors, which is what we're avoiding.
- **Region-specific consent UIs** (e.g., GDPR-K-style "this user is between 13 and 16; here's the parental consent flow"). Tied to FEAT-010.

## Open questions

1. **Exact attestation language.** Drafted in collaboration with legal counsel before launch. Substance is locked; wording isn't. *(legal)*
2. **Sub-profile-create re-attestation.** Required (separate row) vs. implied by the original troop attestation. Default: required, separate row, for evidentiary clarity. *(legal)*
3. **Audit retention period.** How long do we keep `tos_acceptances` rows after troop deletion? Default: 7 years (industry default for legal evidentiary purposes). *(legal, ops)*
4. **Read-only mode on refused re-attestation.** Default: yes — preserve user data access while gating mutations. Alternative: full lockout. *(product, legal)*
5. **GDPR-K (16+) jurisdictions.** When we expand to those markets, what's the trigger condition? IP geolocation at signup, billing country, or explicit market selection? Default: billing country. *(legal)*

## Cross-platform notes

No platform divergence at the data level — the acceptance is recorded server-side. UI presentation differs:

- **Web**: ToS prompt is a full-screen step before the troop creation submit button; secondary modal for version-bump re-acceptance.
- **iOS**: in-app modal at signup; iOS-style sheet for re-acceptance prompts.
- **Android**: same as iOS; uses Material full-screen dialog.

## Verification

Cross-platform:

- **Step 1** of cross-platform verification implies signup completed: "Sign up two **troops** with different phone numbers..." This includes accepting the ToS attestation; testers need to confirm the attestation was actually shown and acceptance recorded.

Proposed additions:

- Refuse-to-attest test: leader does not check the box and tries to submit → form rejected.
- Version-bump test: bump `tos_versions`; existing troop's leader logs in → re-attestation prompt; accept → new row in `tos_acceptances`; leader can mutate again.
- Read-only-mode test: bump version; leader logs in but does not accept → confirm posting / invites / share-toggles all reject with a clear "Please accept the updated ToS" message.
- Sub-profile-create attestation test: create a sub-profile post-signup → confirm a `tos_acceptances` row with `reason='sub_profile_create'` is recorded.
