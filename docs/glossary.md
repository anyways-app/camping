# Camp King — Terminology Review

A consolidated catalog of every term currently in use across `docs/spec/` and `docs/features/`, surfaced for review. The previous narration locked **"Troop"** as a working term and noted that **all terminology must be reviewed**; this doc is that review pass.

When this is locked, the resulting decisions get applied as a rename pass across every spec file, every FEAT-NNN file, the roadmap CSV, and the M1 web shell.

## How to use this doc

For each row:

1. Read the **Term**, **Refers to**, and **Status** / **Notes**.
2. Fill in the **Decision** column with one of:
   - **Lock** — keep the current term as canonical.
   - **Rename → X** — replace with `X` everywhere.
   - **Drop** — stop using; replace with the term in the Notes column.
   - **Discuss** — pull this one into a conversation.
3. Once a row's decision is filled in, change its **Status** to `Locked`.
4. Edit this file directly; commit when a batch is done.

I will then run the rename pass and back-edit the docs in one commit per category.

## Status legend

- **Working** — provisional; current usage is not blessed.
- **Issue** — known concern (clash, brand conflict, ambiguity); needs an explicit call.
- **Locked** — blessed; do not change without re-review.

---

## 1. Brand & product naming

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Camp King | App / brand name (current spec spelling) | Issue | Original spec uses "Camp King" (two words); the latest profiles writeup uses "CAMPKING" (one word, all caps). Pick one canonical spelling. | |
| CAMPKING | App / brand name (writeup spelling) | Issue | Same as above. | |
| Camp Atlas | The v2 group-shared, platform-owned site-capture product (FEAT-090) | Issue | Placeholder I introduced; never blessed. Alternatives: "Site Library", "Splat Atlas", "TrailMap", "Camp Map", or unrelated brand. | |
| LiDAR Night Sight | iOS Pro safety/utility feature for dark-campsite navigation (FEAT-089) | Issue | "Night Sight" is a Google Pixel camera feature name; potential trademark risk. Alternatives: "Dark Sight", "Night Vision", "Dark Mode Camera", "Trail Vision". | |
| LiDAR fantastical | iOS Pro AI image-render mode (FEAT-051) | Working | Brand-distinct, fits voice. Could shorten to "Fantastical" or rename ("LiDAR Dream", "LiDAR Vision"). | |
| Splat Cards | v2 deferred 3DGS card type (FEAT-042) | Working | Technical-flavoured. Possibly OK; possibly too jargony for end-users. | |

---

## 2. Identity & accounts

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Troop | The account container holding billing + multiple profiles | Working | You explicitly said "have to call it troops" earlier in this session, then noted the term is provisional. Latest writeup uses "group" and "main account" interchangeably. Alternatives: Group, Crew, Tribe, Pack, Family, Camp, Household. | |
| Account | Same as Troop, in the latest writeup | Issue | The writeup uses "Main Account" for what we've been calling Troop. Disambiguation: are Account and Troop the same thing, or is Account the auth identity and Troop the household container? Needs clarification. | |
| Group | User-facing label in writeup ("join the group") | Issue | Used colloquially in the writeup. Could be the UI-layer term while Troop stays the data-model term. | |
| Profile | Each social-product actor under a Troop / Account | Working | Used consistently across spec, writeup, and FEAT files. Reasonably stable. | |
| Sub-profile | A non-leader profile under a Troop | Working | Descriptive but assumes hierarchy. Alternatives: Member profile, Family profile, Member, Camper. The writeup uses "profile" undifferentiated. | |
| Troop leader | The single owning profile of a Troop with billing + master controls | Working | Assumes "Troop" wins. Alternatives: Account owner, Main account, Camper-in-chief, Head camper. | |
| Account owner | Same as Troop leader, in the writeup | Issue | "The account owner can impose various restrictions on the profile" — this is the Troop leader. Same role, different name. | |
| Camper | Default account type per the writeup ("Each account owner is, by default, a user account. Let's call this a camper account.") | Issue | New concept from the writeup. Is it a synonym for "user / standard account" or a specific role? Likely the v1-only account type vs. Business / Service. | |
| Account type | The Camper / Business / Service distinction at the account level (writeup) | Working | New from writeup; needs explicit FEAT (proposed FEAT-035). | |
| Business (account type) | Account that represents a business selling things (writeup) | Working | v2-deferred. | |
| Service (account type) | Account that represents an operator of services (tow truck, rescue, firewood delivery, etc.) (writeup) | Working | v2-deferred. | |
| Department | Sub-unit under a Business account (writeup) | Working | Terminology for Business sub-units. v2-deferred. | |
| Package | Sub-unit under a Service account (writeup) | Working | Terminology for Service offerings. v2-deferred. | |
| Linked profile | A profile that is backed by an independent registered account (writeup) | Working | New mechanic from writeup; needs explicit FEAT (proposed FEAT-036). Alternatives: Linked sub-profile, Connected profile, Bridged profile. | |
| Standalone profile | A profile that exists only inside a Troop, no separate account (implied by writeup contrast) | Working | New term implied by Linked profile. May not need its own term — it's just a "profile" without the link. | |
| HOME BASE | Troop-level setting from writeup; the troop's primary location | Issue | All caps in writeup — design call (HOME BASE vs. Home Base vs. home_base in code). Also: is this a single field or a richer location object? | |
| Leader PIN | The mandatory PIN for entering the leader profile (FEAT-005) | Working | Could be "Account PIN", "Owner PIN". | |
| Protected profile | A sub-profile that's PIN-gated by the leader (FEAT-006) | Working | Generic. Alternatives: PIN-locked, Restricted, Private profile. | |

---

## 3. Sub-profile feature gates

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Feature gate | A leader-controlled toggle on a sub-profile's capability (FEAT-007) | Working | Generic engineering term. Alternatives: Permission, Restriction, Setting, Control. | |
| Restriction | The writeup's word for a leader-imposed constraint on a profile | Issue | Implies all gates are *negative* (taking away). The writeup also notes some gates can *elevate* (e.g. enhanced GPS for elders) — see "Elevated gate" below. | |
| Elevated gate | A gate that *increases* a capability beyond default (e.g. continuous GPS logging) (writeup) | Issue | New from writeup. Need terminology and a non-binary value model. Alternatives: "Enhanced setting", "Heightened control". | |
| Forward outside the troop | Specific gate name (FEAT-007) | Working | Long but descriptive. May shorten if "Troop" renames. | |
| Trip participation | Specific gate name (FEAT-007, FEAT-030) | Working | Reasonably clean. | |
| Block / report | The always-on safety action (FEAT-007 row, FEAT-058) | Working | Standard social-platform vocabulary. | |
| Long-press menu | The 4-action menu on a card (FEAT-058) | Working | Descriptive. May rename for desktop ("right-click menu", "card menu", "actions menu"). | |

---

## 4. Social graph & contacts

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Social graph | The web of mutual matches + one-hop grants between profiles | Working | Generic; standard. | |
| Mutual-discovery | The contact-matching mechanism: both sides upload + both registered (FEAT-014) | Working | Descriptive. | |
| Match (social graph sense) | Two profiles that have mutually discovered each other (FEAT-014) | Issue | **Direct clash with "Match" the engagement action** (the burn-it dislike). Same word, two unrelated meanings. Resolve by renaming one. | |
| Contact match | Same as Match, in some spec text | Working | More specific; less clashy. Could become canonical. | |
| One-hop grant | The opt-in toggle that lets a friend see who else you're connected to (FEAT-015) | Working | Slightly technical. Alternatives: "See my friends" toggle, "Visibility grant". | |
| Direct contact | A mutually-matched profile (drives dark-green border) | Working | Descriptive, generic. | |
| Friend-of-friend / FoF | A profile reachable via a one-hop grant (drives light-green border) | Working | Industry-standard. | |
| Contact | An entry in a profile's contact list (`contacts` table row) | Working | Generic, fine. | |
| Master contact list | The leader's own contact list, the source for shared contacts (writeup, FEAT-017) | Working | Writeup-introduced phrase. Could just be "the leader's contact list". | |
| My contacts | The segment of the contact list a profile imported themselves | Working | UX label. | |
| Shared by Leader | The segment of a sub-profile's contact list populated by the leader's "Share with troop" toggle (FEAT-017) | Working | Depends on Troop / Leader naming. UX label. | |
| Trip contacts | The segment of a contact list populated by trip-shared toggles (FEAT-027) | Working | UX label. | |
| Share with troop | The leader's per-row toggle that exposes a contact to all troop profiles (FEAT-017) | Working | Depends on Troop naming. | |
| Share with this trip | A leader's per-row toggle that exposes a contact to all trip members (FEAT-028) | Working | Reasonably clean. | |
| Phone hash | The hashed phone number used for matching without exposing raw phone numbers (FEAT-018) | Working | Technical; rarely user-facing. | |
| Block | Per-profile suppression of another profile's content / visibility | Working | Standard. | |
| Report | Send a profile or card to the moderation queue (FEAT-066) | Working | Standard. | |

---

## 5. Trips

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Trip | A multi-troop camping event (FEAT-019) | Working | Generic; clean. Could be "Camping trip" if disambiguation needed. | |
| Camping trip | Same as Trip; full form used in writeup | Working | Could be the canonical form. | |
| Trip creator | The single troop leader who created the trip (FEAT-025) | Working | Descriptive. | |
| Trip co-leader | A promoted joined-troop leader with most creator privileges (FEAT-026) | Working | Descriptive. Distinct from "Troop co-leader" (deferred FEAT-011). | |
| Trip member | Any profile (leader or sub-profile) on a joined troop with visibility on (FEAT-022) | Working | Generic. | |
| Trip lifecycle | The draft / active / ended state machine (FEAT-022) | Working | Technical. | |
| Trip metadata | The user-customizable fields per trip (FEAT-021) | Working | Technical. | |
| Trip-shared contact list | The trip-scoped shared list (FEAT-027) | Working | Mouthful. Alternatives: Trip contacts, Trip roster, Shared trip contacts. | |
| Trip visibility | The per-trip-per-profile override on whether a sub-profile is on a specific trip (FEAT-029) | Working | Could clash with broader "visibility"; call out at design time. | |
| Trip participation | The broader on/off feature gate per sub-profile (FEAT-030) | Working | Distinct from Trip visibility (gate vs. per-trip override). | |
| Map this place | The Camp Atlas capture entry point (FEAT-090) | Working | Descriptive. Alternatives: "Map this site", "Capture this place". | |
| Invite (a troop to a trip) | The action of inviting another troop's leader (FEAT-023) | Working | Standard verb. | |
| Accept (a trip invite) | The action of joining a trip (FEAT-024) | Working | Standard verb. | |

---

## 6. Cards & feed

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Card | The atomic content unit posted to the feed | Working | Brand-distinct; replaces "post" / "tweet" / etc. | |
| Post (verb) | The action of creating a card | Working | Generic verb. | |
| Feed | The horizontal-swipe surface showing cards | Working | Standard. | |
| Slideshow | The 60s-idle / 25s-per-card auto-advance mode | Working | Standard. | |
| Zoom-out grid / Grid view | The collapsed ~12-card grid (FEAT-054) | Working | Both terms used in spec. Pick one. | |
| Forward picker (modal) | The contact-picker modal triggered by swipe-up forward (FEAT-061) | Working | Technical. Could be "Forward to..." sheet. | |
| Camping flair | Decorative frames composited onto cards at upload (FEAT-044) | Working | Brand-distinct. Alternatives: "Card frames", "Stickers", "Decorations". | |
| Flair frame | One frame from the camping-flair set | Working | Same. | |
| Caption | Text attached to a card | Working | Standard. | |
| Caption mode (below / overlay) | Whether the caption renders under the image or on top | Working | Technical. | |
| Overlay caption | A caption rendered on the image with movable / resizable text | Working | Technical. | |
| Plus button / + create button | The bottom-strip CTA to create a card (FEAT-057) | Working | Generic. Could be "Create card". | |

---

## 7. Engagement actions

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Firewood | The "like" action (long-press menu) | Working | Brand-distinct; on-theme. Standard interpretation: positive endorsement. | |
| Match (engagement sense) | The "burn it" dislike action (long-press menu) | Issue | **Direct clash with "Match" the social-graph term.** Brand reasoning: match-the-stick → light-on-fire metaphor. Alternatives that don't clash: Strike, Burn, Spark, Ash, Smoke. | |
| Bookmark | Save-for-later action (long-press menu) | Working | Standard. | |
| LOL | Swipe-down reaction | Working | Internet vernacular; carries voice. | |
| Forward (action) | Swipe-up reaction; sends card to a recipient | Working | Standard verb; same root as Forwarded border. | |
| Forwarded (border kind) | Border on a card received via forward | Working | Standard adjective. | |
| Block (action) | Long-press menu action; suppresses a profile from feed | Working | Standard. | |
| Report (action) | Long-press menu action; sends to moderation | Working | Standard. | |

---

## 8. Border kinds (color + pattern)

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Default border | Black solid (standard post) | Working | Could be "Standard". | |
| Advertisement border | Gray dashed (ad cards) | Working | Could be "Ad". | |
| Forwarded border | White dotted | Working | Standard. | |
| System border | Red wavy (Camp King system messages) | Working | Could be "System message border". | |
| Direct contact border | Dark green double (mutual match) | Working | Depends on "Direct contact" naming. | |
| Friend-of-friend border / FoF border | Light green thin (one-hop reachable) | Working | Standard. | |
| Merchant border | Gold chevron (verified merchant) | Working | Standard. | |
| Border kind | The enum value identifying which border to render (FEAT-041) | Working | Technical. | |
| Pattern | The non-color stroke style (solid / dashed / dotted / wavy / double / thin / chevron) | Working | Technical. | |

---

## 9. Sensors & capture

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Sensor field | A card field populated from device sensors (geo, elevation, compass, etc.) | Working | Technical. | |
| Geo capture | The act of attaching `geo_point` to a card from device GPS (FEAT-067) | Working | Technical. UX label may be "Location". | |
| Trail mode | Pedometer "start at trailhead → stop and attach distance" UI (FEAT-070) | Working | Brand-distinct. Alternatives: "Hike mode", "Track mode". | |
| Voice clip | Optional 15-second microphone capture attached to a card (FEAT-072) | Working | Standard. Could be "Audio clip", "Sound clip". | |
| Ambient temperature | The temperature value attached to a card (sensor or weather API) | Working | Technical. | |
| Weather API | The fallback source for ambient temp when no native sensor exists | Working | Technical. | |
| LiDAR depth | The depth-stream output from iPhone Pro LiDAR | Working | Technical / hardware. | |

---

## 10. Camp Atlas / future captures (v2)

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Camp Atlas | The v2 product surface for group-shared, platform-owned site captures (FEAT-090) | Issue | Placeholder; never blessed. See Brand section. | |
| Site capture | One captured 3DGS scene of a place | Working | Descriptive. Alternatives: "Place scene", "Captured site". | |
| Map this place | Capture entry point (FEAT-090) | Working | Descriptive. | |
| Capture (verb) | The act of recording the LiDAR / RGB / IMU stream for a site capture | Working | Generic. | |
| Capturer | The profile that performed a site capture | Working | Generic. Alternatives: "Mapper", "Scout". | |
| Perpetual licence | The capture-time grant that gives Camp King ownership (FEAT-090) | Working | Legal-ish. May rephrase in plain language for the consent UI. | |
| Distribution tier | The audience scope for a site capture (in-group / broader-paying / third-party) | Working | Technical / business. | |
| Anonymisation pass | Server-side ML pipeline that blurs faces / plates / PII (FEAT-090) | Working | Technical. | |

---

## 11. Tags

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Tag | A category attached to a card (`tags` array field) | Working | Generic. | |
| `camping` (the tag) | The single locked v1 tag (FEAT-048) | Working | Stable. | |
| System tag | A future v2+ tag from a platform-defined set (informative, ask, help, announcement, etc.) (FEAT-049) | Working | Distinct from a free-form / user-defined tag, which we don't have. | |

---

## 12. Casting & display

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Cast / Casting | OS-level screen mirroring to a TV (FEAT-080) | Working | Standard. | |
| Cast tab | Chrome / Edge feature for mirroring a tab to a Chromecast | Working | Standard. | |
| AirPlay | iOS native screen mirroring | Working | Apple trademark; correct usage. | |
| Google Cast | Android native screen mirroring | Working | Google trademark; correct usage. | |
| Wake lock | The browser API that keeps the screen on during slideshow | Working | Technical. | |

---

## 13. Engagement counters

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Firewood count | Tally of firewood reactions on a card | Working | Tied to Firewood naming. | |
| Match count | Tally of dislike reactions | Issue | Match clash again. | |
| LOL count | Tally of LOL reactions | Working | | |
| Bookmark count | Tally of bookmark saves | Working | | |
| Forward count | Tally of forwards | Working | | |

---

## 14. Auth & infrastructure

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Phone OTP | SMS one-time-code sign-in | Working | Standard. | |
| Apple OAuth / Sign in with Apple | iOS-mandated identity (FEAT-076) | Working | Apple trademark; correct usage. | |
| Google OAuth | Google identity sign-in | Working | Standard. | |
| Supabase | Backend platform | Working | Vendor name. | |
| RLS | Row-Level Security (Postgres / Supabase mechanism) | Working | Technical jargon; rarely user-facing. | |
| Session token | The auth credential per profile | Working | Technical. | |
| Verified consent | The legal flow for kids-tier (FEAT-010) | Working | Legal. | |

---

## 15. Verification & ops

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| Cross-platform verification | The 10-step e2e check from `00-core.md` § Verification | Working | Technical. | |
| Troop-specific verification | The 8-step troop-only check (00-core.md) | Working | Tied to Troop naming. | |
| Trip-specific verification | The 8-step trip-only check (00-core.md) | Working | Tied to Trip naming. | |
| Moderation queue | The review surface for flagged content (FEAT-065, FEAT-066) | Working | Standard. | |
| Mesh-specific verification | The 6-step mesh-only check added in `00-core.md` and detailed in `40-offline-mesh.md` | Working | Tied to Mesh-v1 release-track naming. | |

---

## 16. Offline BLE Mesh (Mesh-v1 track)

These terms are introduced by the Mesh-v1 featureset (FEAT-111..121, source brief: `docs/briefs/offline-mesh-engineering-brief.md`). All `Working` until the broader rename pass; `MemberID` flagged `Issue` because it conflicts with the existing `profile_id` data-model identifier.

| Term | Refers to | Status | Notes / alternatives | Decision |
|---|---|---|---|---|
| TripKey | The 32-byte symmetric key generated server-side per Trip; AES-CCM encryption key for every mesh message in that Trip | Working | Could be `tripKey` / `trip_key` in code; user-facing copy may avoid the term entirely. | |
| MemberID | The 8-byte Trip-scoped identifier per member device, distinct from the global `profile_id` | Issue | **Conflicts with existing `profile_id` data-model identity.** Resolve before lock: is MemberID a derived alias of profile_id within a Trip, or a separately-issued identifier? Likely "derived alias for the wire format only." | |
| Dictionary (mesh sense) | The 1,024-entry base + 256-entry per-Trip extension messaging vocabulary used in offline mode | Issue | Overloaded with the data-structure sense of "dictionary" used in code generally. Could rename to "Vocabulary" or "Message lexicon." | |
| Key-epoch | Monotonically incrementing integer in the cleartext message header that selects the active TripKey generation | Working | Industry-standard cryptographic vocabulary; safe to keep. | |
| REVOKE_AND_ROTATE | The single-broadcast message type that simultaneously instructs an excluded device to delete credentials AND delivers a new TripKey to remaining members via per-recipient sealed-box envelopes | Working | Wire-protocol constant name. User-facing copy describes the effect ("Remove this member") without surfacing the constant. | |
| MessageID | 6-byte random per-message identifier used for dedup; truncated to 3 bytes in the cleartext header, full 6 bytes in the encrypted blob | Working | Technical; rarely user-facing. | |
| ACK | Acknowledgment message type carrying an original `MessageID`; emitted only for direct messages with sender-requested ACK | Working | Standard networking abbreviation. | |
| TTL (hop-count sense) | Time-to-live as a hop counter (default 5), decremented on each relay; distinct from TTL-in-time used for store-and-forward eviction (24h) | Working | Same word, two senses; clarify per usage. | |
| Sealed-box envelope | Per-recipient encrypted blob (X25519-derived ECDH + AES-GCM) carrying the new TripKey to one specific member during `REVOKE_AND_ROTATE` | Working | libsodium-style nomenclature; standard. | |
| Foreground service | Android `Service.startForeground(...)` mechanism required for sustained BLE scan / advertise; shows a persistent notification | Working | Android platform terminology; unavoidable. | |
| Minimal mode | Battery mode default: advertise 2s ON / 28s OFF; scan low-latency 10% duty (FEAT-120) | Working | User-facing "Minimal" label; could be "Battery saver" if friendlier. | |
| Boost mode | Battery mode opt-in: advertise 2s ON / 8s OFF; continuous scan (FEAT-120) | Working | User-facing "Boost"; could be "Performance" / "Active" if friendlier. | |
| Mixed mode | Platform-optimization mode default: service-UUID-encoded payloads, lowest-common-denominator, ~16-byte payloads (FEAT-120) | Working | Technical; user-facing copy may say "Auto." | |
| iPhone-group mode | Platform-optimization mode when all peers iOS: switch to MultipeerConnectivity for richer transport (FEAT-120) | Working | "iPhone-group" matches brief. Could be "All-iPhone optimized." | |
| Android-group mode | Platform-optimization mode when all peers Android with BLE 5 extended advertising: ~255-byte payloads (FEAT-120) | Working | "Android-group" matches brief. Could be "All-Android optimized." | |
| Forward secrecy | The cryptographic property that a revoked device cannot decrypt traffic sent after the revocation, regardless of its cooperation | Working | Standard cryptographic vocabulary. | |
| Eventual-consistency window | The time period during which different members may be operating under different key-epochs after a `REVOKE_AND_ROTATE` broadcast | Working | Borrowed from distributed-systems vocabulary; appropriate. | |
| Connected-disconnected | The product positioning / UX framing that surfaces offline-mesh state to a consumer audience without exposing technical detail | Working | Brand-distinct UX term. **Patent-relevant** per `docs/legal/patent-claims.md` § C6. | |

---

## Cross-cutting concerns flagged

The most-impactful renames, in priority order:

1. **Match overload** (rows in §4 and §7 + §13). Two unrelated concepts share the word. Highest-value disambiguation. Proposed: rename the engagement action to one of `Strike` / `Burn` / `Spark` / `Ash` / `Smoke`; keep `Match` for the social-graph mutual-discovery sense (which is industry-standard).
2. **Camp King vs. CAMPKING** spelling (§1). One canonical form across spec, code, UI, ToS.
3. **Troop / Account / Group** (§2). Three terms in circulation for the household container. At least clarify: which is the data-model term, which is the UI label, which is colloquial.
4. **Camp Atlas** name (§1, §10). Never blessed; placeholder I introduced. Decide before legal / consent screen drafting.
5. **LiDAR Night Sight** trademark risk (§1). Pick a non-Pixel-conflicting name before iOS dev work begins.
6. **Restriction vs. Elevated gate** (§3). The writeup introduces gates that *enhance* (elder GPS), not just *restrict*. Today's terminology assumes restrictions only.
7. **MemberID vs. profile_id** (§16). Mesh-v1 introduces an 8-byte Trip-scoped MemberID; existing data model uses global profile_id. Are these distinct identifiers (server issues both) or is MemberID a Trip-scoped derived alias of profile_id (only the alias goes on the wire)? Latter is simpler; resolve before FEAT-111 build.
8. **Dictionary overloading** (§16). The mesh sense (messaging vocabulary) and the generic data-structure sense compete. Pick a different surface name for the mesh sense (e.g. "Vocabulary" or "Message lexicon") to keep code semantics clean.

## Out of scope of this review

- **Code identifiers** (snake_case, table names like `troop_shared_contacts`). Those will be renamed mechanically as a follow-up to the user-visible terminology decisions. They aren't items to debate here.
- **Voice / tone** of marketing copy. This catalogues the *terms*; product / brand voice is a separate exercise.
- **Pluralisation rules** (Troops vs. Troop's). Standard English; rename pass handles automatically.

## After this review is done

Once decisions are filled in (even partially):

1. I run a scripted rename across `docs/spec/`, `docs/features/`, `docs/roadmap/feature-roadmap.csv`, and the M1 web shell (`apps/web/`).
2. The rename pass lands as one commit per category to keep diffs reviewable.
3. New FEAT drafts (FEAT-035 Account Types, FEAT-036 Linked Profiles, FEAT-037 Group-Join Flow, FEAT-038 Settings Inheritance, FEAT-007 elevated-gate edit) use the locked terminology.
