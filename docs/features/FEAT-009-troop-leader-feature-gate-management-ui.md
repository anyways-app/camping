---
id: FEAT-009
area: Identity & Accounts
release: v1
status: Spec'd
dependencies: [FEAT-002, FEAT-003, FEAT-006, FEAT-007]
last_reviewed: 2026-05-01
---

# FEAT-009: Troop leader feature gate management UI

## Summary

The leader-only screen where the troop leader manages every sub-profile: creates them, deletes them, renames / re-avatars them, toggles "protected" + sets sub-profile PIN, and flips every entry of the per-sub-profile feature-gate matrix (FEAT-007). This is the leader's single control surface for shaping each sub-profile's experience.

## Roles & permissions

- **Leader-only.** Hidden entirely from sub-profiles. Server-side RLS enforces; client-side hides the entry point.
- Reachable only from the leader profile session — switching to a sub-profile and trying to deep-link here results in a "Only your troop leader can do this" empty state (FEAT-002).

## Surfaces

- **Entry point**: troop settings → "Manage profiles." Persistent in the leader's settings.
- **List view**: shows all sub-profiles (and the leader's own profile, read-only). Each row: avatar, display name, lock icon if protected, key gate summary ("Forward outside troop: off; Voice: off; ...").
- **Detail view** (drill into a row): full edit surface — name, avatar, "Protected" toggle, every gate in the matrix, "Reset PIN" action (if protected), "Delete sub-profile" action.
- **Create new sub-profile** CTA: floating button or list-header action, hidden if at the 6-cap (FEAT-003).

## Behaviour

1. Leader navigates to troop settings → "Manage profiles." Server returns the full sub-profile roster + every profile's current gate matrix.
2. List view renders each sub-profile with a visual gate summary: a row of small icons (forward / voice / geo / etc.) tinted on / off.
3. Leader taps a sub-profile row → detail view loads.
4. Detail view sections (in this order):
   - **Identity**: display name (text field), avatar (tap to change), "Protected" toggle, "Change / Reset PIN" actions.
   - **Feature gates**: matrix from FEAT-007, grouped by intent ("Posting & forwarding", "Permissions & sensors", "Visibility filters", "Trips & casting").
   - **Danger zone**: "Delete this sub-profile" with a confirmation dialog.
5. Each toggle flip is auto-saved (no "Save" button) — change is immediate via optimistic UI + Realtime broadcast to the affected sub-profile.
6. **Bulk actions** (toolbar): select multiple sub-profiles from the list view, then "Apply gates from..." (copy gate matrix from a chosen source profile). *(Open question 1.)*
7. **Delete sub-profile**: confirmation dialog with text input ("Type the sub-profile's name to confirm"). On confirm, cascade-delete (FEAT-003 step 6).

## Data

Reads:
- `profiles` (list + detail).
- `profile_feature_gates` (current matrix per profile).
- `troops` (cap enforcement; current count).

Writes:
- `profiles` (rename / re-avatar / protected toggle / PIN change / delete).
- `profile_feature_gates` (toggle flips).

## Edge cases

- **At-cap state.** Create CTA hidden; replaced with a passive "6 / 6 sub-profiles. Need more? [Coming in v2: larger troops]" hint linking to FEAT-012.
- **Concurrent edit on two leader devices.** Last-write-wins on each toggle; UI subscribes to Realtime so the second device sees the first's edits live.
- **Leader's own profile in the list.** Read-only — leader can't gate themselves. The row is shown for completeness (so the leader can tap "Change leader PIN" from this consolidated screen rather than digging through troop settings).
- **Deleting the only sub-profile, leaving leader alone.** Allowed; the troop just goes back to single-profile state (FEAT-001).
- **Network down during toggle flip.** Optimistic UI shows the new state; on offline, queue the change locally; on reconnect, replay. If the queued change conflicts with a server-side change, the server-side wins and the local change is dropped with a notice.

## Out of scope

- **Cross-troop management.** Leader can only manage their own troop's profiles. No "manage profiles across multiple troops" surface (you'd need v2 ownership-transfer-style features).
- **Granular gate scheduling** (e.g., "voice clips on between 10 am and 8 pm"). Tied to time-based gates, not v1.
- **Gate-change audit log surfaced to the user.** v1: ops-only audit (FEAT-007 open question 5). User-facing audit log is a v2 nice-to-have.
- **Sub-profile self-edit** (display name, avatar). v1: leader-only edits. Could open up later.

## Open questions

1. **Bulk apply / copy gates.** v1 yes or v1 no? Default: yes — significant leader convenience for "make B1 like B2." Implementation: a "Copy gates from..." action on the detail view + a multi-select bulk action on the list view. *(product, design)*
2. **Gate grouping / labels.** How to organise 15 gates into intuitive sections. Default groups proposed above (Posting & forwarding / Permissions & sensors / Visibility filters / Trips & casting). Run by design. *(design)*
3. **Visual gate summary on the list view.** Icon row vs. compact text list ("Forward off, voice off, ...") vs. just a count of active gates. Default: icon row. *(design)*
4. **Sub-profile preview / impersonation.** Should the leader be able to "view as B1" to see what their sub-profile sees with the current gates applied? Powerful but tricky (security boundary risk, UX complexity). Default: not v1. *(product)*
5. **Delete confirmation friction.** Type-name-to-confirm vs. simple "Are you sure?" dialog. Default: type-name (sub-profile deletion is destructive and irreversible). *(product, design)*
6. **Reordering / pinning sub-profiles.** Tied to FEAT-004 (profile picker order). v1 default: creation order. *(product)*

## Cross-platform notes

- **Web**: list + detail as a two-pane layout on wide screens (master-detail), single-column stack on narrow. Toggles are switches.
- **iOS / Android**: stacked navigation — list view → detail view via push. Toggles are platform-native. iOS: long-press a list row for quick actions ("Delete", "Copy gates"). Android: swipe-left on a list row for the same.

## Verification

Troop-specific:

- **Step 11**: "Create a sub-profile B1. B1 appears on the profile picker on next app launch." (Implies the management UI exists to do the create.)
- **Step 12**: "PIN-protect sub-profile B1 from the leader's settings panel..."
- **Step 13**: "Set 'Forward outside the troop' to Off for B1..."
- **Step 16**: "Set 'Ad card visibility' to Off for B1..."

Proposed additions:

- At-cap test: create 6 sub-profiles; verify the create CTA hides / disables.
- Concurrent-edit test: open the detail view on two devices logged in as the leader; flip a toggle on each; verify Realtime update on the other.
- Delete-flow test: create a sub-profile, delete via the management UI, verify cascade-delete + profile vanishes from picker.
- Sub-profile access test: switch to a sub-profile, attempt to deep-link to the management URL; verify "Only your troop leader can do this" state.
