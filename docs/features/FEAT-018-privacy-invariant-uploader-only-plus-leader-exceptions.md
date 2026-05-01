---
id: FEAT-018
area: Social Graph & Privacy
release: v1
status: Spec'd
dependencies: [FEAT-013, FEAT-016, FEAT-017, FEAT-027, FEAT-028]
last_reviewed: 2026-05-01
---

# FEAT-018: Privacy invariant — raw contacts uploader-only + two leader-share exceptions

## Summary

The load-bearing privacy invariant: **raw uploaded contacts are never visible to anyone but the uploader, with two explicit leader-only exceptions**:

1. **Share with troop** (FEAT-017) — the troop leader can toggle individual contacts as visible to every profile in their own troop.
2. **Share with this trip** (FEAT-028) — a troop leader who is a member of an active trip can toggle individual contacts as visible to every profile in that trip across all joined troops.

Both exceptions are per-contact, opt-in, leader-only, revocable, and live under the leader's authority over their own contact list. The shared contact is not informed of the share-down — they only see normal mutual-match visibility (FEAT-014) if a viewer becomes a match. This invariant is what makes Camp King's contact-import feature (FEAT-016) GDPR / CCPA-defensible.

## Roles & permissions

- **Each profile (the uploader)**: owns their own raw `contacts` rows. No one else sees them by default.
- **Troop leader**: granted two narrow exceptions that allow them to expose specific contacts from their *own* uploaded list to other profiles. Cannot expose another profile's contacts.
- **Sub-profiles**: see leader-shared and trip-shared contacts as read-only segments; cannot promote contacts up to those segments.
- **Camp King** (server): enforces all of the above via RLS. Cannot bulk-export contacts; reads are audit-logged for ops investigations only.

## Surfaces

This is an invariant that constrains every contact-list-touching screen rather than a screen of its own:

- **Each profile's contact list**: by default shows only the profile's own uploads.
- **Each sub-profile's contact list**: additionally shows the "Shared by [Leader]" segment (FEAT-017).
- **Each trip member's contact list (within a trip context)**: additionally shows the "Trip contacts: [Trip name]" segment (FEAT-028).
- **Mutual-discovery candidate pool computation**: integrates uploader's own contacts ∪ leader-shared contacts ∪ trip-shared contacts that are visible to the viewing profile.
- **Forward picker** (FEAT-061): recipients drawn from the union, but only registered profiles appear; raw contacts are never exposed as picker rows.

## Behaviour

The invariant is encoded in RLS policies on the `contacts` table:

```sql
-- Pseudocode RLS policy for SELECT on contacts
USING (
  -- Case 1: uploader sees their own rows
  uploader_profile_id = current_profile_id()

  OR

  -- Case 2: troop-shared exception (FEAT-017)
  EXISTS (
    SELECT 1 FROM troop_shared_contacts
    WHERE troop_shared_contacts.contact_id = contacts.id
      AND troop_shared_contacts.troop_id = current_profile_troop_id()
  )

  OR

  -- Case 3: trip-shared exception (FEAT-028)
  EXISTS (
    SELECT 1 FROM trip_shared_contacts ts
    JOIN trip_troops tt ON tt.trip_id = ts.trip_id
    JOIN trip_profile_visibility tpv
      ON tpv.trip_id = ts.trip_id AND tpv.profile_id = current_profile_id()
    WHERE ts.contact_id = contacts.id
      AND tt.troop_id = current_profile_troop_id()
      AND tt.status = 'accepted'
      AND tpv.visible = true
      -- AND the trip is not 'ended' (write-prevented but reads of historical data still allowed)
  )
);
```

For Cases 2 and 3, only specific columns of `contacts` are exposed via the RLS-aware view: `display_name` and `phone_hash` for matching. The raw `phone_number`, original CSV source, and any other upload metadata are NEVER exposed across profiles.

The two exception writes (`troop_shared_contacts`, `trip_shared_contacts`) themselves have RLS policies that restrict writes to the leader profile only.

## Data

Reads:
- `contacts` (raw, leader-private) — one row per (uploader_profile, external person).
- `troop_shared_contacts` — one row per leader-shared exposure.
- `trip_shared_contacts` — one row per trip-shared exposure.
- `trip_troops`, `trip_profile_visibility` — for trip-share scoping.

Writes:
- This feature defines the *policy* for reads. Writes happen in FEAT-017 (troop-share toggle) and FEAT-028 (trip-share toggle).

## Edge cases

- **Race: leader unshares a contact while a sub-profile has the contact open in their detail view.** The next read returns nothing; UI shows "This contact is no longer shared" and falls back to the contact list root.
- **Sub-profile imports a contact that's already in the leader-shared segment.** Per FEAT-017 step 7, dedup wins by leader-shared (higher trust). The sub-profile's own row is hidden, not deleted; if the leader later unshares, the sub-profile's row becomes visible again.
- **Leader leaves a trip while their share-with-trip toggle is on for some contact.** The `trip_shared_contacts` rows are dropped when the leader's troop leaves the trip. Re-joining doesn't restore them — the leader has to re-toggle.
- **Trip ends while a contact is shared.** The trip moves to `status='ended'`; reads of historical `trip_shared_contacts` are still allowed (read-only archive); no new writes accepted.
- **A contact is shared by leader to troop AND by leader to a trip simultaneously.** Both segments render in a sub-profile's contact list with the contact appearing in both. Dedup rule: **trip share wins for that trip's context**, but in the general contact list both segments show the contact independently. *(Open question 2.)*
- **Phone-hash collision.** Different external people with phone-hash collision (rare but possible at hash truncation). Default: hash is full SHA-256 (or equivalent), collisions effectively impossible. *(security)*
- **A registered profile's display name change should NOT propagate via the shared-contact rows** — those rows are independent of the registered profile's current display name. The registered profile, once matched, is referenced by `profile_id` and shows their current display name; the contact-list row shows the *uploader's saved* display name.

## Out of scope (this feature)

- **Aggregate analytics on contact lists** ("how many contacts has the leader shared on average"). Not v1; would weaken the privacy posture.
- **Contact-export** by the uploader (downloading their own contact list as a CSV). Not v1; nice-to-have for GDPR data-portability requests but goes through manual ops in v1.
- **Encrypted-at-rest with per-uploader keys** (so even DB ops can't read raw contacts). v1 uses standard at-rest encryption; per-user keys are a v2+ hardening pass.
- **Sharing other types of data** (cards, sensor history, etc.) via the same mechanic. Cards are governed by FEAT-014/015; sensor data is per-card and follows the card's visibility.

## Open questions

1. **What columns of `contacts` are exposed to the leader-shared / trip-shared segments?** Default: `display_name` (as the *uploader* saved it) + `phone_hash` (for matching only). Never raw `phone_number`. Confirm this is the right minimum. *(legal, product)*
2. **Both-shared dedup rule.** When a contact is shared with both troop and trip, do we show two entries or one? Default: show in both segments (trip and troop) — clearer about the source of visibility, even if it adds a row. *(design)*
3. **Phone-hash algorithm.** SHA-256 of normalised E.164 phone number, server-salted? Or per-troop-salted (so cross-troop matches require server-side rehash)? Tradeoff between match speed and cross-troop privacy. *(security, backend)*
4. **Audit log of share / unshare actions.** Internal ops audit (yes, retained 2 years). User-facing audit on the leader's screen ("you shared 3 contacts with your troop in March")? Default: no user-facing audit in v1. *(product, legal)*
5. **Right to erasure for contacts that are themselves registered Camp King profiles.** If X (a registered profile) requests "delete all data Camp King has about me," do we also remove rows in `contacts` where the contact_phone matches X's verified phone? Default: yes — strip those rows on a verified erasure request. *(legal)*

## Cross-platform notes

No platform divergence. Privacy invariant is server-enforced; clients are read-only consumers of the RLS-allowed rows.

## Verification

Cross-platform:

- **Step 3**: "Profile A toggles 'expose my contacts' for B. B sees one-hop registered profiles under A; B never sees A's raw uploaded contacts."

Troop-specific:

- **Step 14**: "Toggle 'Share with troop' on a contact in the leader's contact list. Switch to B1; confirm the contact appears in B1's contact list under 'Shared by [Leader]' and not in B1's 'My contacts' segment."

Trip-specific:

- **Step 21**: "Leader B toggles 'Share with this trip' on a contact in B's master contact list. The contact appears in the trip's shared contact list, visible to every trip member."

Automated tests:

- "Unit tests for the troop-shared-contacts visibility rule" (FEAT-017 verification).
- "Unit tests for the trip-shared-contacts visibility rule" (FEAT-028 verification).

Proposed additions:

- RLS-bypass test: attempt direct SQL access to another profile's `contacts` rows (simulating a compromised auth token) → server denies even at the bypass attempt.
- Schema-leak test: confirm raw `phone_number` column is never returned in any cross-profile read (only `phone_hash` and `display_name`).
- Erasure test: trigger a verified right-to-erasure request for an external person → all `contacts` rows referencing that phone hash are removed across all profiles.
