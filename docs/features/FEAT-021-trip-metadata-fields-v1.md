---
id: FEAT-021
area: Trips
release: v1
status: Spec'd
dependencies: [FEAT-020, FEAT-022]
last_reviewed: 2026-05-01
---

# FEAT-021: Trip metadata fields (v1)

## Summary

A trip's user-customisable metadata in v1: **name** (required), **description**, **location_text**, **start_date**, **end_date**, **cover_image_url**, and **status** (lifecycle-controlled, not user-typed). Everything else — geo-polygons, itineraries, RSVPs, packing lists, post-trip albums — is deferred to FEAT-033. The metadata is editable by the trip creator (FEAT-025) and any trip co-leader (FEAT-026); other members see it read-only.

## Roles & permissions

- **Trip creator + trip co-leaders**: full edit on every metadata field except `status` (which transitions per FEAT-022 lifecycle rules) and `created_by_*` (immutable).
- **Other trip members** (joined-troop profiles, sub-profiles): read-only.
- **Profiles outside the trip**: no visibility.

## Surfaces

- **Create trip flow** (FEAT-020): initial fill of all metadata.
- **Trip detail screen → "Edit trip"** (creator + co-leader only): same form pre-populated. Save updates the relevant `trips` row fields.
- **Trip detail header** (all members): renders the metadata as a banner (cover image, name, dates, location), with the description below.
- **Trips list** (FEAT-019): renders thumbnail, name, dates from the metadata.

## Behaviour

1. Metadata is set initially during creation (FEAT-020).
2. Creator / co-leader navigates to trip detail → "Edit trip" → form opens pre-populated → user edits → Save.
3. Server: updates `trips` row with `updated_at = now()`. Realtime broadcast to all trip members; their detail screens re-render.
4. **Status field** is excluded from the edit form — it transitions only via the lifecycle actions (FEAT-022). The form may include an "End this trip" action that hits the lifecycle endpoint.
5. **Field-level validation** on edit:
   - Name: 1-80 chars, required.
   - Description: 0-500 chars.
   - Location text: 0-200 chars.
   - Dates: start_date ≤ end_date if both set; either or both can be cleared.
   - Cover image: ≤ 5 MB upload; server-resize to 1200×630.

## Data

Reads:
- `trips` (the row being edited).

Writes:
- `trips` (update via the editable fields).
- Supabase Storage (new cover image upload replaces prior; prior image is purged after a 24h grace).

The full `v1 trip metadata` schema (from `00-core.md#v1-trip-metadata`):

| Field | Type | Notes |
|---|---|---|
| `name` | text | required |
| `description` | text | optional, multi-line |
| `location_text` | text | optional, free-form |
| `start_date` | date | optional |
| `end_date` | date | optional |
| `cover_image_url` | text | optional |
| `status` | enum | `draft` \| `active` \| `ended` (lifecycle-controlled) |

## Edge cases

- **Editing during an active session by another co-leader.** Last-write-wins; Realtime broadcasts the latest state. Form shows a "Co-leader [Name] is also editing this" hint if simultaneous activity is detected. *(Open question 1.)*
- **Cover image change while members have the prior image cached.** Cache invalidation on the new `cover_image_url`; clients re-fetch on next render.
- **Trip ended state**: edit form opens but every field is read-only with a banner "This trip has ended and is read-only."
- **Empty optional fields**: description, location_text, start_date, end_date, cover_image_url can all be blank. Renders gracefully ("No description set", omit the date row, generic header without cover image).
- **Cover image deletion**: edit form has a "Remove cover image" action; clears `cover_image_url`. Storage purge after 24h grace.
- **Date in the past**: allowed. Useful for documenting trips that already happened.

## Out of scope

- **Trip-filtered feed view** based on dates / location (FEAT-033).
- **Geo-polygon location** instead of free-form text (FEAT-033).
- **Multi-image gallery** (cover + supporting images for the trip detail). v1: single cover only.
- **Itinerary / day-by-day schedule** (FEAT-033).
- **Per-day metadata** (e.g., "Day 1: Heartwood Ridge; Day 2: Granite Pass"). v1: trip-level only.

## Open questions

1. **Concurrent-edit handling.** Last-write-wins with Realtime updates is the cheapest. A more sophisticated locking approach (e.g., "you're editing; please wait" if the form is open elsewhere) is over-engineered for v1. *(product)*
2. **Image ratio constraints.** Square (1:1) crop vs. landscape (16:9) vs. user-controlled crop. Default: server-resize to 1200×630 (16:9), no in-app crop UI in v1. *(design)*
3. **Description formatting.** Plain text vs. limited markdown (bold, bullets). Default: plain text in v1; markdown / rich text in v1.x or v2. *(product)*
4. **Date format display.** "May 15 – May 22, 2026" vs. "May 15 – 22, 2026" vs. ISO. Default: locale-aware, "May 15 – 22, 2026" in en-US. *(design)*
5. **Location autocomplete.** Hook up to a maps provider for autocomplete + place suggestion? Adds a third-party dependency and cost. Default: free-form text only in v1. *(product, ops)*

## Cross-platform notes

No structural divergence. UI surfaces follow each platform's typical form patterns:

- **Web**: full-screen form with file-picker for cover image upload.
- **iOS**: native sheet-modal form. Native `<DateTimePicker>` for dates. `expo-image-picker` for cover image.
- **Android**: Material modal form. Material date picker. Same `expo-image-picker` integration.

## Verification

Trip-specific:

- **Step 19**: "Leader A creates a trip 'Wind River 2026' with a name and start / end dates." (Implies metadata fields exist.)

Proposed additions:

- Edit-by-creator test: creator edits name + description; all members see updated metadata.
- Edit-by-co-leader test: co-leader edits dates; creator and other members see update.
- Edit-by-non-leader test: regular trip member tries to edit → form is read-only.
- Image-replace test: upload new cover image; old image purged from storage after grace; new image served on re-fetch.
- Validation test: submit name > 80 chars → form rejects.
