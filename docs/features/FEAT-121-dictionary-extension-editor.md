---
id: FEAT-121
area: Offline Mesh
release: Mesh-v1
status: Spec'd
dependencies: [FEAT-111, FEAT-112, FEAT-114]
last_reviewed: 2026-05-04
---

# FEAT-121: Dictionary extension editor

## Summary

The in-app editor that lets a Trip member add up to **256 custom dictionary entries** to a Trip's vocabulary before Trip start. Extensions sync to all Trip members during the online bootstrap window (FEAT-111). Once Trip is offline-active (FEAT-112), the dictionary is **frozen** for the duration of that Trip — no entries can be added, edited, or removed. The 1,024-entry base dictionary plus the up-to-256-entry user extension layer, version-pinned per Trip, is the messaging vocabulary for the entire offline lifetime.

## Roles & permissions

- **Any Trip member** can propose a dictionary extension entry pre-Trip-start. *(Open question 1: should this be leader-only?)*
- **Trip creator + co-leaders** can edit / remove extension entries proposed by others until Trip start. After Trip start, no one can.
- **Sub-profiles**: same access as their leader allows; gated by the broader troop-level account permissions, not by a separate per-sub-profile gate. (No FEAT-007 row for "edit dictionary"; the leader's curation is the gate.)

## Surfaces

- **Trip detail screen → "Trip vocabulary"** (pre-start only): a list of base entries (read-only, scrollable) plus the extension layer at the top. "+ Add custom entry" CTA opens the editor sheet.
- **Editor sheet**: enter the entry's text, parameter signature (none / numeric range / enum), and optional category. Save persists locally; sync to other Trip members happens via the regular online channel.
- **Trip's offline-active state**: the Trip vocabulary view becomes read-only with a banner: "Vocabulary is locked for this Trip."

## Behaviour

### Editor flow (pre-Trip-start)

1. User navigates to Trip detail → "Trip vocabulary" → "+ Add custom entry."
2. Editor sheet:
   - **Entry text** (required, ≤ 60 chars). Examples: "Found a clear spot at the bend in the river." "Lost my hat — anyone seen it?"
   - **Parameter signature** (optional):
     - None — the entry's text is sent verbatim.
     - Numeric range (e.g. "min: 1, max: 60") — sender provides a number; renderer interpolates `{n}`. e.g. "I'm running {n} minutes late."
     - Enum (up to 8 values) — sender picks one; renderer shows the picked label.
   - **Category** (optional, free-form tag): "logistics", "food", "weather" — for grouping in the picker (FEAT-114).
3. Save.
4. **Sync** (online): the new entry is inserted into the Trip's `dictionary_extensions` table server-side; broadcast to every Trip-member device via Realtime. Each device's local cache updates.
5. **Conflict / merge** semantics during the pre-start window: any Trip member can add entries (default per OQ 1) up to the per-Trip cap of 256. If two members add identical-text entries, default is "first one wins" by `created_at`; the second is silently no-op'd. *(Open question 2.)*
6. **Edit / remove**: trip creator + co-leaders can edit or remove any extension entry until Trip start. Edits broadcast to all members. After Trip start, the editor is read-only.

### Pinning at Trip start

1. Trip creator fires Trip start (FEAT-112).
2. Server snapshots the current `dictionary_extensions` rows for the Trip into a frozen version (`trips.dictionary_version_pin` per FEAT-021).
3. The frozen version is included in the bootstrap payload to every device (FEAT-111).
4. Any subsequent edit attempts post-pin are rejected with "Vocabulary is locked for this Trip."

### Wire-format integration (FEAT-113)

- Base dictionary entries: indexes `0..1023`.
- Extension dictionary entries: indexes `1024..1279` (256 max).
- The 16-bit `dictionary_index` field in the encrypted blob (FEAT-113) accommodates both ranges natively.
- Receivers render the entry's text and parameters by looking up the index in their local copy of the pinned version.

## Data

Reads:
- Base dictionary (bundled with the app, version-controlled by app release).
- `dictionary_extensions (id, trip_id, dictionary_index, text, param_signature_jsonb, category, created_by_profile_id, created_at, edited_at NULL, deleted_at NULL)` — server-side.
- Per-device cached copy of the pinned version.

Writes:
- `dictionary_extensions` (insert / update / delete pre-Trip-start, leader-curatable).
- `trips.dictionary_version_pin` (set at Trip start; immutable thereafter).
- Per-device local DB: cached pinned version.

## Edge cases

- **Cap of 256 reached**: user attempting to add a 257th entry sees "This Trip has reached the 256 custom-entry limit. Edit existing entries or remove some to add more." Cap enforced server-side.
- **User adds an entry, Trip starts before it syncs to all devices**: the bootstrap payload is the canonical version; every device receives the same pinned version regardless of local sync state at the moment of Trip start. Members may briefly have a stale local view; bootstrap reconciles.
- **Member adds an entry while another member is editing the same entry**: server-side last-write-wins on entry edits. Realtime broadcasts the latest state.
- **App update changes the base dictionary**: the base dictionary is version-controlled by the app version. Different members on different app versions could see different base entries. Mitigation: every Trip's bootstrap payload includes the base dictionary version too; if a member's local app version is older than the pinned version, they're prompted to update before joining the Trip's offline-active state. *(Open question 3.)*
- **Localization** (FEAT-121 OQ 5 / brief ambiguity 8): the dictionary stores language-independent indexes. Each device renders the entry's text in the user's app language using a localized resource bundle. Custom extension entries are the user's typed text in their own language; receivers see it as-is regardless of their own language. *(Open question 4.)*
- **Profanity / abusive entries**: a member could add a custom entry containing slurs. Trip creator and co-leaders can edit / remove pre-start. After start, frozen — abusive entries persist for the trip's lifetime. v1 accepts this risk in the consumer family-trip threat model. *(Open question 5.)*
- **Member leaves the trip after adding entries**: their entries persist (the Trip owns them, not the author).

## Out of scope

- Free-text messaging — explicitly out per the dictionary-only invariant.
- Dictionary auto-translation (sender's English → receiver's Spanish): Mesh-v2.
- Cross-Trip dictionary sharing: each Trip has its own extension layer.
- Editing the *base* 1,024-entry dictionary: that's an app-release artifact, not user-editable.
- Image / emoji entries: dictionary entries are text-only in v1.

## Open questions

1. **Edit authority**: any Trip member, or leader-only? Brief ambiguity 2 (dictionary-extension sync semantics) implicitly raises this. Default: any Trip member can add; trip creator + co-leaders can edit / remove. Allows family input while leaving curation in the leader's hands. *(product)*
2. **Conflict-resolution** when two members add identical-text entries: first-wins by `created_at` is the default. Alternative: merge into one entry with both authors credited. Default: first-wins (simpler). *(product)*
3. **App-version mismatch on base dictionary**: bootstrap blocks members on older app versions until they update. Default: yes. *(product)*
4. **Dictionary localization**: language-independent indexes (default) vs. per-locale entries (more storage, more flexibility). Default: language-independent indexes. Custom entries are the author's language. *(product, design)*
5. **Profanity moderation**: pre-Trip-start moderation pass on custom entries via the existing FEAT-065 pipeline? Default: yes — extension entries pass through the same text-classifier the regular caption pipeline uses, before being broadcast to other members. *(product, ops)*
6. **256-entry cap rationale**: why 256? Wire-format budget (16-bit dictionary_index has room for 65535 indexes; 256 keeps the local cache small and the per-Trip edit surface manageable). Confirm the cap in field testing. *(product, eng)*
7. **Bulk-import** of extension entries from a previous Trip: nice convenience for repeat-camping families. Default: not in v1 — manual entry per Trip. v1.x candidate. *(product)*

## Cross-platform notes

- **iOS / Android**: editor sheet uses platform-native form patterns. Local cache is stored in the encrypted local DB (FEAT-117 schema can be extended with a `dictionary_extensions_cache` table). Both platforms render the same dictionary entry indexes identically given the same pinned version.
- **Web**: web does not participate in offline mesh, but the web client SHOULD display extension entries when rendering Trip activity (FEAT-073 sensor-display parity). The editor itself is web-supportable as part of the pre-start online flow. *(Open question 8.)*

8. **Web parity for the editor**. Should the editor be available on web too (during the online pre-start window), or mobile-only? Default proposed: yes, web-supportable for the editor surface; render-only on web for the in-Trip vocabulary view. *(product, eng)*

## Verification

Cross-platform from `00-core.md` § Mesh-specific verification: covered indirectly by Step 31 (Cross-platform test) — extension entries should round-trip in mesh messages.

Proposed additions:

- Pre-start add test: member A adds an entry; member B sees it on their device within the Realtime sync window; both can use it in compose (FEAT-114) once Trip is offline-active.
- Cap-enforcement test: add 256 entries; attempt 257th → rejected.
- Trip-start freeze test: Trip starts; attempt to add a new entry → rejected with "Vocabulary is locked for this Trip" message.
- Cross-language render test: sender adds an English entry; receiver's app is set to Spanish; receiver sees the English text as-is (since it's a custom entry, not localized).
- Profanity-pipeline test: add an entry containing a banned slur; verify it's rejected pre-broadcast.
- Bootstrap version pin test: member A and B add different entries; trip starts at moment T; the pinned version reflects exactly what was committed by T.
