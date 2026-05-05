---
id: FEAT-022
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-020, FEAT-023, FEAT-024, FEAT-025, FEAT-026]
last_reviewed: 2026-05-01
---

# FEAT-022: Trip lifecycle (draft / active / ended)

## Summary

A trip moves through three states: **draft** (just created, no troops have accepted yet), **active** (at least one invited troop has accepted; the trip is live; members can browse, share contacts, etc.), and **ended** (read-only archive, no new invites or shares accepted; existing data preserved). Transitions are forward-only (no resurrecting an ended trip in v1) and gated by specific actions: first accept flips draft→active; creator or any co-leader marking ended flips active→ended; auto-end conditions (creator's troop deletion) also flip to ended.

## Roles & permissions

- **Trip creator** (FEAT-025): can mark a trip ended at any time. Cannot resurrect from ended.
- **Trip co-leader** (FEAT-026): can mark a trip ended at any time. Cannot resurrect.
- **Other members**: cannot transition the lifecycle. They see the trip's current status.
- **System**: auto-transitions on creator's troop deletion (→ ended) and on first accept (→ active).

## Surfaces

- **Trip detail screen → "End this trip"** action: visible to creator + co-leaders only. Confirmation dialog: "Marking this trip as ended will close it to new invites, contacts, and shares. Existing data stays visible. Continue?"
- **Trip detail header**: shows a status badge ("Draft" / "Active" / "Ended"). Ended adds a banner: "This trip ended on [date]. It's read-only."
- **Trips list grouping** (FEAT-019): Draft and Active appear in their respective groups; Ended falls into Past.

## Behaviour

1. **Create → draft**: trip is inserted with `status='draft'`. Only the creator's troop is a member; only the creator and the creator's profiles see it. Other invited troops appear in `trip_troops` with `status='invited'` once the creator invites them.
2. **First accept → active**: when the first invited troop's leader accepts (FEAT-024), server transitions `trips.status` from `draft` to `active` atomically with the `trip_troops` insert. Realtime broadcasts the status change to all members.
3. **Active**: full functionality — invite more troops, share contacts, edit metadata, promote co-leaders, etc.
4. **Mark ended**:
   - Creator or co-leader taps "End this trip" → confirmation → server updates `trips.status` to `ended`, sets `trips.ended_at`, broadcasts. All members' clients re-render the detail screen as read-only and move the trip to the Past group in their list.
   - Server enforces: no new `trip_troops` invites accepted; no new `trip_shared_contacts` rows (existing rows readable, just no inserts/deletes); no metadata edits except by support; `trip_co_leaders` writes blocked.
5. **Auto-end on creator-troop deletion**: when a troop with `troops.id = trips.created_by_troop_id` is deleted, all trips it created auto-transition to `ended` with a synthetic ended_at timestamp. *(Open question 1 — alternative is "transfer creator," which requires FEAT-034.)*
6. **Auto-end stale draft**: drafts that have been sitting unresolved for >30 days with no accepts auto-end (housekeeping). *(Open question 2.)*
7. **Read-only archive (ended)**: members can still navigate to the trip detail, see metadata, see member roster, see the historical trip-shared contacts segment. Mutations are blocked.
8. **Offline-active (Mesh-v1 substate of `active`)**: when the trip's `offline_mesh_enabled = true` (FEAT-021), the active state has a substate `offline-active` indicating BLE mesh is provisioned and running. Offline-active does NOT preclude online connectivity — it just means mesh is enabled. Trip start (FEAT-112) transitions `active` → `offline-active`; Trip end (active → ended) tears down mesh credentials regardless of substate. See FEAT-112 and `40-offline-mesh.md` for the full mesh lifecycle.

## Data

Reads:
- `trips.status` (current).
- `trips.ended_at` (set when transitioning to ended).

Writes:
- `trips.status` (update, monotonic forward).
- `trips.ended_at` (set on the active→ended transition).

State machine:

```
draft  ──── first accept ──→  active  ──── creator/co-leader ends ──→  ended
                                  │                                       ↑
                                  └── creator-troop deleted ──────────────┘
draft  ──── creator-troop deleted, OR ────── 30-day stale ──────────────→ ended
```

No backward transitions.

## Edge cases

- **Creator marks ended while a co-leader is editing metadata.** The metadata edit completes (write succeeds), but on next read the trip is ended; the edit form re-renders read-only.
- **Multiple concurrent end-trip attempts.** Idempotent: server checks `trips.status='ended'`; if already ended, returns success without re-broadcasting.
- **Member is mid-share-contact when trip ends.** The share-contact write fails with "This trip has ended" — surfaced as a toast on the leader's screen.
- **Sub-profile is mid-view of trip detail when trip ends.** Realtime updates trigger a re-render; "This trip ended" banner appears; "End this trip" button is removed.
- **Creator's troop deletion is itself a complex cascade.** Per FEAT-001 step 6: trips the creator's troop *created* end immediately; trips the creator's troop *participated in* (but didn't create) have the troop removed from `trip_troops` but otherwise survive.
- **Resurrection requests from users.** v1: no path. Support-only escalation if a trip was ended in error (e.g., accidental tap). *(Open question 3.)*
- **Dates passed but trip not ended.** A trip with `end_date` in the past but `status='active'` stays active until manually ended. v1 does NOT auto-end based on end_date — the dates are just metadata.

## Out of scope

- **Auto-end on end_date pass.** Default: dates are advisory; no auto-transition. *(Open question 4.)*
- **Trip resurrection / re-opening.** Not v1.
- **Pause / hibernation states** (between active and ended). Not v1.
- **Trip duration analytics** (avg trip length, most-active trips). Not user-facing.

## Open questions

1. **Creator-troop deletion → auto-end.** Default. Alternative: prompt the creator-troop's leader at deletion time to either end the trip or transfer creator status to a co-leader. The transfer path requires FEAT-034 (deferred). v1 default: just auto-end. *(product)*
2. **Stale draft auto-end.** 30 days vs. 60 vs. never. Default: 30 days; gives a leader plenty of time to invite troops without leaving permanent draft litter. *(ops)*
3. **End-in-error recovery.** Support-only re-open path? Default: no — keep the lifecycle clean and treat ends as final. Users can create a follow-up trip if needed. *(product)*
4. **Auto-end on end_date.** v1 default: no. Nice-to-have for v1.x: auto-end 7 days after end_date if no co-leader has explicitly extended. *(product)*
5. **Notifications on lifecycle events.** When a trip ends, do all members get a push notification? Default: in-app banner only; no push. *(product, ops)*

## Cross-platform notes

No structural divergence. The detail-screen banner and "End this trip" action follow each platform's standard confirmation-dialog patterns.

## Verification

Trip-specific:

- **Step 19**: Trip starts as `draft`.
- **Step 20**: "B accepts; trip status flips to `active`."
- **Step 26**: "Trip lifecycle: leader A marks the trip `ended`. Confirm no new invites, contacts, or shares are accepted; existing trip-shared contacts remain visible historically to participants in a read-only archive."

Proposed additions:

- Auto-transition test: invite, then accept; status flips draft→active atomically with the accept.
- End-by-creator test: end → status=ended, all members see read-only banner, mutations blocked.
- End-by-co-leader test: same outcome.
- Mutation-blocked test: after end, attempt to insert `trip_shared_contacts` row → server rejects with "trip has ended" error.
- Creator-troop-deletion test: delete the creator's troop → its trips auto-end.
- Stale-draft test: create draft, wait 30 days, ops job runs → auto-end.
