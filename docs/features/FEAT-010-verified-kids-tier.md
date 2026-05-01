---
id: FEAT-010
area: Identity & Accounts
release: v2
status: Deferred
dependencies: [FEAT-001, FEAT-003, FEAT-007, FEAT-008]
last_reviewed: 2026-05-01
---

# FEAT-010: Verified-kids tier (COPPA / GDPR-K path)

## Summary

A v2+ tier that opens Camp King to under-13 users (and under-16 users in GDPR-K jurisdictions) with **verified parental consent**, data minimisation appropriate to children, and the App Store / Play Store "Kids Category" compliance posture. v1 deliberately avoids this scope by relying on the leader's 13+ ToS attestation (FEAT-008); FEAT-010 is the path to actually serve the family / scout-troop / classroom market with platform-recognised kids profiles.

## Roles & permissions

- **Troop leader**: opt-in. Attests to a separate, stronger consent flow (verified parental consent, not just "13+" attestation). Designates specific sub-profiles as "kids profiles."
- **Kids profile (under-13 / under-16)**: receives an aggressively gated experience — no precise geolocation, no behavioural ads, no AI generation on their image content, no contact import without parental approval, parental approval for posts that leave the troop or the trip context.
- **Camp King**: collects no behavioural data on kids profiles (or collects only what's strictly necessary and disclosed); no third-party trackers active in the kids context; data deletion on parental request; Apple "Kids Category" / Google Play "Designed for Families" SDK constraints apply.

## Surfaces

- **Verified parental consent flow** at sub-profile creation when the leader designates a profile as a kids profile. Real legal process: credit-card check (the FTC-recognised method), signed form, video ID, or a vetted age-verification provider — TBD per the legal pass.
- **Per-kids-profile UI** is a different experience — simplified card creation, fewer surfaces, parental-approval prompts on outbound forwards, no merchant / ad cards regardless of feature gates.
- **Region-specific consent UIs** for GDPR-K jurisdictions (16+ default in some EU member states, varies by country).

## Behaviour

(Sketch only — full design pass needed before v2 build.)

1. Leader at sub-profile creation toggles a new "This is a kids profile" option (or selects from a tier picker).
2. Verified consent flow runs (TBD method).
3. Server: marks `profiles.kids_tier = true` on the sub-profile; locks specific gate rows in `profile_feature_gates` to forced-off (e.g., geo capture, voice clip, ads).
4. Kids profile experience: stricter UI — no behavioural-ad SDKs load; no third-party analytics fire for that profile's activity; AI features (LiDAR fantastical, future general-purpose AI image generation) hard-gated off for image content from the kids profile.
5. Outbound posts / forwards may require leader approval on a per-action basis. *(Open question 2.)*
6. Data deletion on parental request: full purge of all data associated with the kids profile within 30 days.

## Data

(All TBD; conceptual.)

- New flag: `profiles.kids_tier BOOL` (default false in v1; settable only via the verified consent flow in v2+).
- New table: `kids_consent_records (id, troop_id, profile_id, consent_method, verified_at, verified_by_legal_provider, evidence_id, expires_at)`.
- Modifications to `profile_feature_gates`: kids-tier rows are server-locked (cannot be set on by the leader for forced-off gates; e.g., geo capture is hard-locked off).
- Telemetry / analytics: kids-tier profile events are routed to a separate, child-safe analytics pipeline (or none at all).

## Edge cases

(All TBD.)

- Kids profile aging up to 13 / 16: documented transition path — leader re-attests, kids tier flips off, gates unlock to standard 13+ defaults. Existing data preserved.
- Parental consent revocation: full data deletion within the regulatory window.
- Leader transfer (if FEAT-011 ships): kids consent does NOT transfer with the troop — new leader must re-verify consent within a grace window.

## Out of scope (this feature)

- v1 has no path to under-13 profiles. The leader's 13+ attestation (FEAT-008) is the v1 posture.
- Verifying *the leader is themselves an adult*. Tied to a separate adult-verification design pass (perhaps required before kids-tier consent flow can run).
- Detailed v2 design — this file captures the *scope* and *intent* only; the v2 design pass is a major project.

## Open questions

(Most of this feature is open questions until the v2 design pass.)

1. **Verified consent method.** Credit-card check, video ID, signed form via legal-provider — pick one or support multiple. Cost / friction tradeoff. *(legal, product)*
2. **Per-action leader approval.** Are outbound forwards / first-time contact additions / etc. always leader-approved, or only initially with a "trust this contact" cache? *(product)*
3. **Apple / Google compliance.** App Store "Kids Category" requires the entire app to be kids-safe by default, or kids-tier to be entirely sandboxed? Likely the latter (kids-tier is its own sub-experience with its own SDK posture). Confirm with Apple / Google documentation and possibly a real submission attempt. *(legal, ops)*
4. **GDPR-K (16+) jurisdictions.** Trigger condition for the higher threshold (per FEAT-008 open question 5). *(legal)*
5. **Adult-of-record verification before kids-tier consent.** Should the leader be ID-verified before being allowed to consent for a kids profile? Default: yes; inherits from FEAT-002 open question 2. *(legal)*
6. **Cost.** Verified consent flows cost money per check (typically $1–10 per verification). Pricing tier for kids-tier capability? *(product, ops)*

## Cross-platform notes

To be designed alongside the verified-consent provider's SDKs / APIs. Web is likely the simplest verification surface (camera + ID upload, etc.); mobile equivalents tend to use the platform's native auth APIs.

## Verification

To be defined in the v2 design pass. At minimum:

- Verified-consent flow runs successfully with a real test account.
- Kids profile cannot enable any of the hard-locked gates.
- Behavioural ads / third-party trackers do not fire for kids-profile activity.
- Data deletion on parental request completes within the regulatory window.
- App Store / Play Store submission passes kids-category review.
