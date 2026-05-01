---
id: FEAT-007
area: Identity & Accounts
release: v1
status: Spec'd
dependencies: [FEAT-002, FEAT-003, FEAT-009]
last_reviewed: 2026-05-01
---

# FEAT-007: Per-sub-profile feature gate matrix

## Summary

The leader manages a per-sub-profile **toggle matrix** that gates 15 distinct features (post cards, forward outside the troop, contact import, voice clips, geo capture, ads, merchant cards, LiDAR, Camp Atlas, DMs, slideshow / cast, trip participation, etc.). Each toggle has a sensible v1 default leaning restrictive; the leader flips any toggle on to grant. Block / report is **always on, never gateable**. The matrix is the leader's primary lever to tune sub-profile experience without the platform needing a "kids mode" at the platform level (FEAT-008).

## Roles & permissions

- **Troop leader**: sole writer of the matrix. Can flip any toggle on any sub-profile at any time. Cannot disable block / report.
- **Sub-profile**: read-only on their own matrix. Their UI is filtered by the matrix — disabled features simply don't appear (no "disabled / locked" affordance that draws attention; just absence). *(Open question 1.)*
- **Server**: enforces every gate at the API level. Client-side hiding is a UX nicety; server-side enforcement is the security boundary.

## Surfaces

- **Per-sub-profile management screen** (FEAT-009): leader sees a matrix view with each sub-profile as a row and each gate as a column (or stacked sub-profile detail screens, one per profile, with the matrix as a vertical list — design call).
- **Sub-profile's own UI**: gated features are absent. E.g., if "Voice clip recording" is off, the mic button doesn't appear in the card creation flow at all. If "Forward outside the troop" is off, the forward picker (FEAT-061) opens with a filtered recipient list and an "Ask your troop leader" empty state when the in-troop list is empty.

## Behaviour

1. At sub-profile creation (FEAT-003), the matrix is populated with the v1 defaults from the spec table.
2. Leader navigates to per-sub-profile management → drills into a sub-profile → sees the matrix.
3. Leader flips a toggle. Server upserts the corresponding row in `profile_feature_gates`. Realtime channel for the sub-profile fires; the sub-profile's UI updates within seconds (or on next refresh).
4. Leader bulk-applies: a "Copy gates from another sub-profile" action lets the leader templatize. *(Open question 2.)*
5. **Server-side enforcement** at every gate-controlled action: e.g., the create-card endpoint reads the active profile's `forward_outside_troop` gate before accepting a forward; the upload endpoint reads `voice_clip` before accepting a voice attachment; etc.
6. The full v1 matrix:

   | Feature gate | Default for new sub-profile | Notes |
   |---|---|---|
   | Post cards | On | Off would make the sub-profile read-only. |
   | Receive cards in feed | On | Off makes the sub-profile a "create-only" account. |
   | Receive forwards from outside the troop | On | Inbound forward filter. |
   | Forward outside the troop | **Off** | Affects the forward picker (FEAT-061). |
   | Long-press: block / report | **On (always — never gateable)** | Safety floor. |
   | Contact CSV import (FEAT-016) | **Off** | Leader can pre-share via FEAT-017 instead. |
   | Voice clip recording (FEAT-072) | **Off** | Microphone permission is also gated client-side. |
   | Geo capture on posts (FEAT-067) | **Off** | Location permission also gated client-side. |
   | Merchant card visibility | **Off** | Hides gold-chevron-bordered cards. |
   | Ad card visibility | **Off** | Hides gray-dashed-bordered cards. |
   | LiDAR fantastical (FEAT-051, iOS Pro) | On | Hardware-gated separately. |
   | Camp Atlas capture (FEAT-090, v2) | **Off** | Only the leader captures and grants the licence. |
   | Direct messages (FEAT-063, v2) | **Off** | DMs are deferred entirely; gate exists for v2. |
   | Slideshow / TV cast | On | Generally safe; may flip off for shared family screens. |
   | Trip participation (FEAT-030) | On | Per-trip override sits on top per FEAT-029. |

## Data

Reads:
- `profile_feature_gates` (every gated action reads the active profile's row).

Writes:
- `profile_feature_gates` (insert defaults at sub-profile creation; update on toggle flip; cascade-delete on sub-profile deletion).

Schema sketch: `(profile_id PK, feature TEXT PK, enabled BOOL, updated_at)`. Composite PK on `(profile_id, feature)`. RLS: readable by the profile and the troop leader; writable by the leader only.

## Edge cases

- **Mid-action gate flip.** Sub-profile is mid-way through a card creation flow with a voice clip recorded; leader flips voice-clip gate off. Default: the in-flight upload completes; the next attempt is blocked. *(Open question 3.)*
- **Inconsistent client cache.** Sub-profile's client has a stale matrix; attempts a now-gated action; server rejects. Client surfaces a refresh prompt and re-fetches the matrix.
- **Default mismatch.** If we change a v1 default after launch (e.g., voice clips default flips from Off to On), existing sub-profiles' matrices are not retroactively changed — only new sub-profiles get the new default. The matrix is per-sub-profile snapshot at creation.
- **Always-on rule violation.** Block / report is always on. Server rejects any attempted update of that row with `enabled=false`. Client UI hides the toggle entirely.
- **Sub-profile deletion.** All `profile_feature_gates` rows cascade-delete with the profile.

## Out of scope

- **Per-trip gate overrides.** Only the "Trip participation" gate has a per-trip override (FEAT-029). The other gates apply uniformly across all contexts.
- **Time-based gates** (e.g., "no posting after 9 pm"). Not v1; could be a v2 parental-control surface.
- **Permission-prompt orchestration.** When a previously-gated feature is enabled, the corresponding OS-level permission (mic, location, contacts) still has to be granted. The matrix doesn't bypass OS permissions; it just decides whether to ask.
- **Matrix presets** ("Restrictive / Moderate / Open" templates). Default v1: just the spec defaults + manual toggles. Templates are a v1.x or v2 add. *(Open question 4.)*

## Open questions

1. **Disabled-feature visibility.** When a feature is gated off for a sub-profile, do they see a disabled / locked button (with a "Ask your troop leader" tooltip), or does the button vanish entirely? Default: vanish entirely (avoid drawing attention to what they can't do); show a button only at gesture-natural points (forward picker empty state). *(design)*
2. **Bulk apply / copy-gates UX.** "Copy gates from [other sub-profile]" action vs. "Apply preset" vs. one-by-one. Default: one-by-one for v1 simplicity; copy-gates as a v1.x add if leaders ask. *(design, product)*
3. **Mid-action gate-flip behaviour.** Cancel in-flight, allow in-flight to complete, or warn. Default: allow in-flight (least surprise). *(product)*
4. **Matrix presets.** Restrictive / Moderate / Open templates the leader can apply with one tap. Default: not v1; spec defaults are the de-facto "Restrictive" preset. *(product)*
5. **Audit log of gate changes.** Should the leader see a log of "I changed Voice Clip recording from off to on for B1 at 2026-05-15"? Default: ops-only audit log, not user-facing. *(product, ops)*

## Cross-platform notes

- **Web**: matrix as a table on the management screen; toggles are switches in each row.
- **iOS / Android**: matrix as a stacked detail screen — drill into a sub-profile, see a list of toggles. Mobile-native switch components.

## Verification

Troop-specific:

- **Step 13**: "Set 'Forward outside the troop' to Off for B1 ... confirm the swipe-up forward gesture either does nothing or surfaces 'Disabled by troop leader.'"
- **Step 16**: "Set 'Ad card visibility' to Off for B1 ... confirm no ad-bordered cards appear in B1's feed."
- **Step 17**: "Block / report on a sub-profile is never gated."

Automated tests:

- "Unit tests for the per-sub-profile feature-gate matrix (block / report always on regardless of toggles; defaults match the spec table; 'Forward outside the troop = off' still blocks forwarding to fellow trip members)."

Proposed additions:

- Cascade-default test: create new sub-profile → all gate rows present with the spec defaults.
- Server-enforcement test: sub-profile attempts a gated action via direct API call (bypassing client UI) → server rejects with a stable error.
- Always-on rule test: attempt to update the block-report gate via API → server rejects with a stable error.
