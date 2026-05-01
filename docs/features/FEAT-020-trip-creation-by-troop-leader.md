---
id: FEAT-020
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-002, FEAT-019, FEAT-021, FEAT-022, FEAT-025]
last_reviewed: 2026-05-01
---

# FEAT-020: Trip creation by troop leader

## Summary

A troop leader creates a new trip from the Trips section. Required field is **a name**; everything else (description, location text, dates, cover image) is optional. The trip starts in `status='draft'` until the first invited troop accepts (FEAT-024) — at which point it transitions to `status='active'` (FEAT-022). The creating leader is the trip's creator (FEAT-025), with full authority over invites, settings, lifecycle, and co-leader promotion.

## Roles & permissions

- **Troop leader** (any troop): can create trips. There is no per-troop limit on number of trips a leader can create in v1, but creation is rate-limited to prevent spam (e.g., 10 trips / week / leader). *(Open question 3.)*
- **Sub-profile**: cannot create trips (gate-controlled by FEAT-007 implicitly — trip creation is a leader-only action; sub-profiles never see the create CTA).
- **Trip co-leaders** (FEAT-026): cannot create new top-level trips on behalf of the troop, only manage existing trips they're co-leading.

## Surfaces

- **Create trip CTA** within the Trips section (FEAT-019). Floating button or list-header action, leader-only.
- **Create trip flow**: a multi-step or single-form screen. Default: single screen with all fields, since most are optional. *(Open question 1.)*

## Behaviour

1. Leader navigates to Trips → tap Create.
2. Form fields:
   - **Trip name** (required): single-line text, ≤80 chars.
   - **Description** (optional): multi-line text, ≤500 chars.
   - **Location** (optional, free-form text): e.g. "Wind River Range, WY". v1 is text-only; geo-polygons come in FEAT-033.
   - **Start date** (optional): date picker.
   - **End date** (optional): date picker; must be ≥ start_date if both set.
   - **Cover image** (optional): tap to upload (camera roll / file picker). Server-side resize to 1200×630.
3. On submit:
   - Server validates (rate limit per leader, name length, date sanity, image size).
   - Insert `trips (id, name, created_by_troop_id, created_by_profile_id, description, location_text, start_date, end_date, cover_image_url, status='draft', created_at)`.
   - Insert `trip_troops (trip_id, troop_id=creator's_troop, joined_by_profile_id=leader, status='accepted', invited_at=now, responded_at=now)` — the creator's troop is automatically a member.
   - Insert `trip_profile_visibility` rows for every profile in the creator's troop with `visible=true` (default).
4. Success: route to the trip detail screen (FEAT-022) where the leader can immediately invite other troops (FEAT-023).
5. **Save-as-draft**: leader can leave the form mid-fill; on Trips list re-entry they see the partial form via a local "Resume creating" hint. Default: drafts are local-only (not server-persisted) until the form is submitted. *(Open question 2.)*

## Data

Reads:
- `troops` (the leader's own troop, for membership auto-attach).
- `profiles` (the leader's profile, for `created_by_profile_id`).

Writes:
- `trips` (insert).
- `trip_troops` (insert: creator's troop auto-joined).
- `trip_profile_visibility` (insert: default visible=true for every profile in the creator's troop).
- Optional: Supabase Storage upload for the cover image; the storage URL becomes `trips.cover_image_url`.

Schema reference: see `00-core.md#trips → v1 trip metadata`.

## Edge cases

- **Validation failures**:
  - Empty name → "Name is required."
  - Name > 80 chars → truncated with warning toast.
  - end_date < start_date → "End date must be after start date."
  - Cover image > 5 MB → server resize fails; user prompted to pick a smaller image.
- **Rate limit hit**: "You've created the maximum number of trips for this week. Try again later."
- **Network failure mid-submit**: client retries with backoff (3 attempts). Trip insert is server-atomic — either the trip + creator-troop join row + visibility rows all commit, or none do.
- **Cover image upload fails after `trips` row is inserted**: server clears `cover_image_url`; trip continues without an image; user sees a toast.
- **Leader creates a trip then immediately ends it without inviting**: trip exists with status `draft` (no accepted joins) → leader manually marks `ended` → trip lives in Past with just the creator's troop as the only member.
- **Leader's troop is deleted** while the form is open: client gets a session error on submit; form rejects with "Your troop appears to be unavailable. Please refresh."

## Out of scope

- **Cloning an existing trip** as a starting template. Default: not in v1; could be a v1.x add ("New trip based on Wind River 2026").
- **Trip from a calendar invite** (e.g., import an `.ics` file). Not v1.
- **Multi-step / wizard form** with image-first flow. v1 is single-form. Could become v1.x.
- **Trip discovery** (browsing public trips to join). Tied to FEAT-033 (deferred).
- **Co-creating a trip** (multiple leaders share creator status). FEAT-034 (deferred).

## Open questions

1. **Single form vs. wizard.** Default: single form (mobile pattern is acceptable with sectioned vertical scroll). Wizard adds friction. *(design)*
2. **Save-as-draft persistence.** Local-only vs. server-side `trips` row with `status='draft_unpublished'`. Default: local-only — trips with `status='draft'` already exist in v1, so adding a "draft_unpublished" state would muddle. *(product)*
3. **Trips creation rate limit.** Spam prevention. Default: 10 trips / week / leader; 100 / month. Soft cap; ops can adjust. *(ops)*
4. **Cover image dimensions / aspect ratio.** Default: 1200×630 (16:9, fits both list thumbnails and detail-screen banners). *(design)*
5. **Default trip name suggestions.** Auto-suggest "Trip with [Recent Contact]" or "[Month] [Year] Trip" if the user opens the form and pauses. Default: no auto-suggest in v1. *(product, design)*

## Cross-platform notes

- **Web**: form is a route at `/trips/new`. Submit redirects to `/trips/:id`.
- **iOS / Android**: form is a presented modal (full-screen). Submit dismisses to the trip detail screen with native push animation.

## Verification

Trip-specific:

- **Step 19**: "Leader A creates a trip 'Wind River 2026' with a name and start / end dates. Trip appears in A's Trips list with status = `draft`."

Proposed additions:

- Required-field validation: submit without a name → form rejects with the error.
- Date sanity validation: end_date < start_date → form rejects.
- Auto-attach test: after creating a trip, all profiles in the creator's troop with default Trip visibility see the trip in their Trips list.
- Status transition test: trip starts as `draft`; first invited troop accepts → status flips to `active`.
