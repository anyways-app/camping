# Camp King — Project Wiki & Handoff

> **For the next session picking this up.** Read this file first. It tells you what exists, where to find it, what's locked, what's open, and how to keep moving without re-litigating decisions. Pair it with `/root/.claude/plans/1-make-it-13-cheeky-thimble.md` for the longer-form plan history.

---

## 1. Project at a glance

**Camp King** is a camping-themed social platform — feed of horizontally-swiped image cards with brand-distinct engagement vocabulary (Firewood, Match, LOL, Bookmark, Forward), seven border kinds encoding the viewer's social relationship to the author, and a multi-profile household account model. Working spelling is **Camp King** (two words) but `CAMPKING` appears in one inbound writeup — flagged as a Section 1 glossary issue.

**Repo:** `/home/user/camping` (remote: `anyways-app/camping`).
**Active branch:** `claude/add-claude-documentation-RBxTa`.
**Branch tip:** `fbcfaa4` (Mesh-v1 roadmap update). 17 commits total.

**Three independent release tracks:**

| Track | Status | What's in it |
|---|---|---|
| **v1** (main app) | Spec'd; M1 web shell built | 89 features. Online-only social feed + Trips + troops/profiles. |
| **v2+** (main app) | Deferred | 21 features. DMs, calendar, ride-share, convoy, marketplace, monetization, Camp Atlas, Splat Cards, etc. |
| **Mesh-v1** (standalone) | Spec'd | 11 features (FEAT-111..121). Offline BLE mesh for Trips. Decoupled from main-app versioning. |

---

## 2. Repo layout

```
camping/
├── CLAUDE.md                          # ← this file
├── NOTICE                             # inbound attributions (vividConsulting for the BLE mesh brief)
├── package.json / pnpm-*              # pnpm workspaces root
├── tsconfig.base.json
├── apps/
│   └── web/                           # Next.js 15 + Tailwind v4 + React 19 — M1 web shell BUILT
│       ├── app/                       #   App Router (page.tsx renders the Feed)
│       ├── components/                #   Card, Feed, CardBorder, LongPressMenu, GridView
│       ├── hooks/                     #   useCardGestures, useIdleSlideshow
│       ├── lib/                       #   types.ts, borders.ts (BORDER_STYLES)
│       └── data/mockCards.ts          #   12 deterministic SVG-placeholder cards
├── packages/
│   └── ui/                            # placeholder (no real exports yet)
└── docs/
    ├── spec/                          # BINDING contract. The truth.
    │   ├── 00-core.md                 #   Product invariants across all clients
    │   ├── 10-web.md                  #   Web addendum (PWA, browser geolocation, etc.)
    │   ├── 20-ios.md                  #   iOS addendum (sensors, LiDAR features, BLE mesh)
    │   ├── 30-android.md              #   Android addendum (sensors, BLE mesh)
    │   └── 40-offline-mesh.md         #   Offline mesh feature axis (cross-platform contract)
    ├── features/                      # OPERATIONAL definitions per FEAT-NNN
    │   ├── README.md                  #   Workflow, conventions, drafting-status table
    │   ├── _template.md               #   Required schema (frontmatter + 10 sections)
    │   └── FEAT-NNN-*.md              #   44 drafted; 77 pending
    ├── roadmap/                       # INDEX / tracking artifacts
    │   ├── README.md                  #   Counts, release-tracks legend
    │   ├── feature-roadmap.csv        #   121 rows; Excel-friendly
    │   └── feature-roadmap.opml       #   OPML 2.0 mirror (20 groups, 126 leaves)
    ├── briefs/                        # Inbound design briefs (verbatim, do-not-edit)
    │   └── offline-mesh-engineering-brief.md
    ├── legal/                         # Patent boundary; legal-strategy
    │   └── patent-claims.md
    └── glossary.md                    # Terminology review (16 sections, ~110 terms; all Working/Issue, NONE Locked)
```

---

## 3. Current state — counts

| Cut | Count |
|---|---|
| **Total features tracked** | **121** |
| v1 | 89 |
| v2+ | 21 |
| Mesh-v1 | 11 |
| Built (M1 web) | 11 |
| Definitions drafted (have a `FEAT-NNN-*.md` file) | **44 / 121** |
| Spec'd (in spec / CSV, no detailed FEAT file yet) | 66 |
| Explicitly deferred | 21 |

**M1 web shell** (commit `01f3777`): Next.js 15 App Router + React 19 + Tailwind v4 + TS strict; horizontal scroll-snap feed; 7 distinct borders rendered via SVG; long-press menu (touch + right-click); swipe-down LOL + swipe-up Forward (toast stubs); zoom-out grid; idle slideshow (60s trigger, 25s advance); 12 mock cards covering every border kind. **No backend, no auth, no uploads.** Runs via `pnpm dev` → http://localhost:3000.

---

## 4. Documentation hierarchy — who reads what

Three layered surfaces, each authoritative for its audience:

| Surface | Role | Authoritative for |
|---|---|---|
| `docs/spec/` | **Binding contract** | Product invariants. Short, dense. Spec changes are real decisions; edits land via deliberate commits. |
| `docs/features/` | **Operational definitions** | Per-FEAT how-it-works: behaviour, edge cases, data, open questions, verification. Bridges between spec and code. |
| `docs/roadmap/` | **Tracking index** | One row per FEAT. Sortable / filterable view of release + status. The CSV and OPML mirror each other. |

**When the three disagree, the spec wins.** The CSV and feature files exist to make the spec actionable, not to override it.

**Other doc surfaces:**

- `docs/briefs/` — inbound design briefs preserved verbatim with provenance frontmatter. Canonical source for the patent attorney.
- `docs/legal/patent-claims.md` — application-layer (novel) vs. transport-layer (prior art) split. Distinct from spec to avoid legal-strategy bleed.
- `docs/glossary.md` — terminology review. 16 category tables, ~110 terms. **All terms currently `Working` or `Issue` status; nothing `Locked`.** A rename pass across the spec / FEATs / CSV / OPML follows the lock.
- `NOTICE` (repo root) — inbound attribution + DBA disclosures. Distinct from a future `LICENSE` (outbound code terms).

---

## 5. FEAT-NNN drafting conventions

Every feature definition follows `docs/features/_template.md`:

```yaml
---
id: FEAT-NNN
area: <Identity & Accounts | Social Graph & Privacy | Trips | Card | Card Creation
       | Feed | Card Interactions | Borders | Tagging | Moderation | Sensors
       | Auth | Backend | Casting | Web Platform | iOS Platform | Android Platform
       | Operations | Strategic | Offline Mesh>
release: <v1 | v2 | Mesh-v1>
status: <Spec'd | Built (M1 web) | Deferred>
dependencies: [FEAT-XXX, ...]
last_reviewed: YYYY-MM-DD
---
```

Plus 10 required sections: **Summary, Roles & permissions, Surfaces, Behaviour, Data, Edge cases, Out of scope, Open questions, Cross-platform notes, Verification.**

Open questions are owner-tagged: `(product)`, `(design)`, `(backend)`, `(legal)`, `(ops)`, `(TBD)`. Each carries a "Default proposed: …" inline so the question doesn't block.

**Depth calibration** — three seed examples set the range:

- `FEAT-017-troop-wide-contact-sharing.md` (~108 lines) — meaty, well-narrated.
- `FEAT-061-forward-picker-modal.md` (~119 lines) — thin spec extrapolated.
- `FEAT-090-camp-atlas.md` (~124 lines) — Camp Atlas, the v2 deferred showcase.
- `FEAT-119-revocation-and-key-rotation.md` (~300 lines) — highest stakes; primary patent claim.

Match this depth or go lighter for deferred features (40-60 lines is fine).

---

## 6. Key locked decisions (do NOT re-litigate without explicit user direction)

**Identity & accounts**

- **Troop = account container.** One troop per registration; holds billing + master controls. Netflix-style household.
- **Exactly one troop leader** per troop in v1. Co-leadership deferred (FEAT-011).
- **Cap: 6 sub-profiles** + 1 leader = 7 profiles max per troop in v1.
- **No platform-level "kids" classification.** 13+ ToS attestation (FEAT-008) covers the threshold; verified-kids tier (FEAT-010) is v2.
- **Leader profile always requires a PIN.** Sub-profiles can be marked protected (FEAT-006).

**Social graph & privacy**

- **Mutual-discovery only.** Both sides upload + both registered = match.
- **Per-profile social graph.** Profiles in the same troop don't share a graph by default.
- **Raw uploaded contacts are uploader-only**, with TWO explicit leader-only exceptions: share-with-troop (FEAT-017) and share-with-trip (FEAT-028).

**Trips**

- **Trip = multi-troop event.** Created by one troop leader; invites other troop leaders by phone/username.
- **Trip lifecycle: draft → active (first accept) → ended.** No resurrection in v1.
- **Trip creator non-transferable** in v1. Co-creator / transfer deferred (FEAT-034).
- **Trip privacy boundary is hard.** Joining a trip never merges troops, never exposes another troop's master list / roster / gates / billing.
- **Forwarding-gate strictness on trips:** sub-profile's "Forward outside the troop" gate is NOT loosened by trip membership.

**Cards & feed**

- **Cards have an image.** Every card. No text-only posts.
- **7 border kinds derived at render** from social graph + image_origin + author flags. Pattern primary for accessibility; colour enriches.
- **Gesture XOR menu:** swipe-down LOL, swipe-up Forward, long-press shows only block/report/firewood/match/bookmark.
- **Casting v1 = OS mirror only** (Cast tab on web, AirPlay on iOS, Google Cast on Android).
- **v1 tag = `"camping"` only**, auto-applied and locked.

**Mesh-v1 (separate release track)**

- **Standalone track**, not v1 or v2 of the main app.
- **Hard platform floor: iOS 16+, Android 12+.** Older devices fall back to online-only.
- **TripKey scoped to a single Trip.** AES-CCM encryption. Per-Trip 8-byte MemberID.
- **Revocation = silent-delete + coordinated rotation** (FEAT-119; primary patent claim). Forward secrecy guaranteed regardless of excluded device's cooperation.
- **Dictionary frozen at Trip start** (1,024 base + ≤256 user extension entries).
- **20-device cap in Mesh-v1; 100 in Mesh-v2.**

**Infrastructure**

- **Auth: phone OTP primary; Google + Apple OAuth alternates.** Identity attaches at the troop level.
- **Backend: Supabase** (managed Postgres, Auth, Storage, Realtime, Edge Functions). RLS encodes the privacy invariants.
- **Client stack: Next.js for web; React Native + Expo for iOS / Android with shared `packages/ui`.**
- **Moderation: automated pre-mod (image + caption classifier) → review queue + manual report queue.** Flagged posts never enter any feed until cleared.

---

## 7. Load-bearing open questions (read these before doing anything substantive)

Numbered for tracking; tagged with which FEAT carries the full context.

| # | Question | Owner | FEAT |
|---|---|---|---|
| 1 | **Terminology lock.** All ~110 glossary terms are `Working` / `Issue`; **none Locked**. User said "all terminology must be reviewed." Pause sweeping rename work until decisions land. | product / design | `docs/glossary.md` |
| 2 | **Match overload.** "Match" means both the burn-it dislike (FEAT-058) AND the social-graph mutual match (FEAT-014). Pick a rename for one. Highest-value disambiguation. | product | glossary §13 |
| 3 | **Camp King vs. CAMPKING** spelling. Original spec one way, latest writeup the other. | product | glossary §1 |
| 4 | **Camp Atlas** name — placeholder I introduced; never blessed. | product / brand | FEAT-090 |
| 5 | **LiDAR Night Sight** name conflicts with Google Pixel feature. Trademark risk. | legal | FEAT-089 |
| 6 | **MemberID vs. profile_id.** Mesh-v1's 8-byte MemberID — independent identifier or Trip-scoped derived alias of `profile_id`? Resolve before FEAT-111 build. | product / backend | FEAT-111, glossary §16 |
| 7 | **Tech stack confirmation.** Existing app native iOS/Android, RN Expo, or Flutter? Affects every Mesh-v1 implementation FEAT. | product / eng | FEAT-120 |
| 8 | **iOS background advertising.** UUID overflow area means backgrounded iOS = iOS-only nodes for Mesh-v1. Accept or design foregrounded UX? | product / design | FEAT-120 |
| 9 | **Revocation authority** for Mesh-v1: trip creator's troop leader only, or extended? | product / legal | FEAT-119 |
| 10 | **Profiles writeup featureset** (Account types, Linked profiles, Group-join flow, HOME BASE inheritance, Elevated gates). 5 reserved FEATs awaiting terminology lock before drafting. | product | OPML "Reserved" group |

**v1 features that are spec'd but not drafted yet** — 66 features:

The 33 already drafted are the ones the user narrated explicitly: Identity & Accounts (FEAT-001..012), Social Graph & Privacy (FEAT-013, 017-018), all Trips (FEAT-019..034), Camp Atlas (FEAT-090), plus the two seeds (FEAT-017, FEAT-061). The remaining 66 are inherited / supporting features (Card, Card Creation, Sensors, Auth, Backend, Casting, Web/iOS/Android platform, Operations, Strategic) — drafted in subsequent batches per the suggested order in `docs/features/README.md`.

---

## 8. User's working style — conventions to honor

These are observations from the conversation history; don't violate without explicit direction.

- **Spec-first, then prototype.** The user has explicitly redirected away from "prototype next" to "fully define every feature first; phase later." Don't suggest building before drafting feature definitions are complete unless they ask.
- **Push to feature branch.** Never push to `main`. Branch is `claude/add-claude-documentation-RBxTa`. Commits land via `git commit -m "..." && git push -u origin <branch>`.
- **Heredoc commit messages** with the `https://claude.ai/code/session_…` footer.
- **One commit per logical unit.** Big incorporations get batched into 4-5 commits (foundational doc surfaces, spec, FEAT edits, new FEATs, roadmap).
- **Validate before committing.** OPML must parse as XML; CSV must have correct row count; no duplicate FEAT-NNN IDs.
- **Cross-references resolve.** Every `FEAT-NNN` mention in a spec or feature file should point to a real entry.
- **The user thinks fast and narrates fast.** When they drop a writeup, the right move is: read carefully → flag conflicts with existing spec → propose structure → ask AskUserQuestion for foundational decisions → produce the artifact.
- **Defer to the user on naming.** Don't pick brand names; flag them as `Issue` status in glossary.
- **Plan mode discipline.** When in plan mode, only `/root/.claude/plans/*.md` is editable; finalize via ExitPlanMode after user-approved AskUserQuestion clarifications.

---

## 9. Quick orient — if you have 5 minutes

Read these files in this order:

1. **This file** (`CLAUDE.md`) — context.
2. **`docs/spec/00-core.md`** — the binding product invariants. 415 lines. Authoritative.
3. **`docs/roadmap/README.md`** — counts, release tracks, where each artifact lives.
4. **`docs/features/README.md`** — drafting workflow, status table of what's done.
5. **`docs/glossary.md`** § "Cross-cutting concerns flagged" — the 8 load-bearing terminology issues.
6. **One seed feature file** to see the depth target: `docs/features/FEAT-119-revocation-and-key-rotation.md` (meaty + patent-relevant).

If you have 15 minutes, also read:

7. **`docs/spec/40-offline-mesh.md`** — the full Mesh-v1 cross-platform contract.
8. **`docs/legal/patent-claims.md`** — the application-layer-novel vs. transport-layer-prior-art split.
9. **`/root/.claude/plans/1-make-it-13-cheeky-thimble.md`** — the longer-form plan history with the Mesh-v1 incorporation rationale.

---

## 10. What to do next — recommended priorities

In rough priority order; pick what the user asks for. **Do not execute any of these without checking with the user first** — the user has been carefully shaping direction.

1. **Glossary lock pass.** ~110 terms, all `Working`/`Issue`. Pick a session to walk through the 16 sections with the user and fill in `Decision` columns. After locking, run a scripted rename pass across spec / features / CSV / OPML / NOTICE. **This unblocks pretty much everything else** because the existing FEATs would all need rework if Troop / Match / Camp King spelling changes downstream.
2. **Draft the 66 remaining feature definitions.** Suggested order in `docs/features/README.md`: Identity (done) → Social Graph (mostly done) → Trips (done) → Card / Card Creation / Card Interactions (24 features, only seeds done) → Sensors (7) → Borders / Tagging / Moderation / Casting (6) → Web / iOS / Android platforms (18) → Auth / Backend / Operations (9) → Strategic / v2+ (mostly done).
3. **Draft the 5 reserved FEATs** from the latest profiles writeup (Account types, Linked profiles, Group-join flow, HOME BASE inheritance, Elevated gates). Pending terminology lock; the OPML's "Reserved" group holds the placeholders.
4. **Address the 10 load-bearing open questions** in §7 above. Some need user input; some can resolve by writing a default into the relevant FEAT and surfacing for review.
5. **Prototype milestone-2** (when the user is ready). The user previously named: profile picker, leader management screen, contact list with three segments, trip creation flow, trip-shared contacts segment. Built on the existing Next.js M1 shell.

**Do NOT do without explicit direction:**

- Touch `apps/web/` code. M1 web shell is intentionally frozen pending spec maturity.
- Pick brand names (Camp King vs. CAMPKING, Camp Atlas, LiDAR Night Sight rename).
- Promote any Mesh-v1 FEAT into v1 of the main app.
- Push to a branch other than `claude/add-claude-documentation-RBxTa`.
- Add new top-level directories without checking.

---

## 11. Doc-surface map (alphabetical, with purposes)

| Path | Purpose |
|---|---|
| `apps/web/` | M1 web shell — Next.js 15 + Tailwind v4 + React 19. Mock data only; no backend wiring. |
| `CLAUDE.md` | This file. |
| `NOTICE` | Inbound attributions (vividConsulting for Mesh-v1 brief). |
| `docs/briefs/offline-mesh-engineering-brief.md` | Verbatim brief, do-not-edit, canonical for patent attorney. |
| `docs/features/` | 44 drafted FEAT-NNN-*.md files + README + template. |
| `docs/glossary.md` | Terminology review, 16 sections, none locked. |
| `docs/legal/patent-claims.md` | Application-layer novel vs. transport-layer prior-art split. |
| `docs/roadmap/feature-roadmap.csv` | 121-row tracking artifact, Excel-friendly. |
| `docs/roadmap/feature-roadmap.opml` | OPML 2.0 mirror of the CSV, 20 groups + 126 leaves. |
| `docs/roadmap/README.md` | Counts, release-tracks legend. |
| `docs/spec/00-core.md` | Binding cross-client product invariants. |
| `docs/spec/10-web.md` | Web addendum. |
| `docs/spec/20-ios.md` | iOS addendum (sensors + LiDAR features + Mesh-v1 iOS). |
| `docs/spec/30-android.md` | Android addendum (sensors + Mesh-v1 Android). |
| `docs/spec/40-offline-mesh.md` | Mesh-v1 cross-platform contract. |
| `packages/ui/` | Placeholder; nothing exported yet. Components will be promoted here when mobile clients land. |
| `/root/.claude/plans/1-make-it-13-cheeky-thimble.md` | Plan history (outside the repo). |

---

## 12. Branch state — commits in order

(Most recent first.)

```
fbcfaa4  Mesh-v1: roadmap — CSV + OPML + README updates for the new release track
4910b85  Mesh-v1: 11 new FEAT definitions (FEAT-111..121)
0f6d601  Mesh-v1: amend 6 existing FEATs to integrate offline mesh
e2423e5  Mesh-v1: spec — new 40-offline-mesh.md addendum + cross-platform integration
35d03a7  Mesh-v1: foundational doc surfaces — brief, patent boundary, NOTICE, glossary
109438c  Roadmap: add OPML 2.0 outline (mirrors the CSV)
35dd7f2  Glossary: catalog of every current term for review
28a6d55  Features: draft 30 user-narrated features across troops, trips, Camp Atlas
ede3294  Features: add per-feature definition template + 2 seeded examples
ac0d8d5  Roadmap: track v1 / v2 feature split as CSV + README
a5b0fc0  Spec: introduce Trips — multi-troop camping events with shared contact list
f424e65  Spec: lock v1 troop limits — single leader, 6 sub-profiles max
94968ac  Spec: introduce troops + profiles model (Netflix-style household accounts)
6e10fb6  Spec: add Camp Atlas (item 14) — group-shared, platform-owned site captures
01f3777  Web v1 milestone 1: feed UI shell with mock data
7851104  Add LiDAR Night Sight (iOS Pro v1) and Gaussian Splatting v2 candidates
a4f5249  Add Camp King v1 product spec (core + web/iOS/Android addenda)
```

17 commits total. The first three pre-date this branch's history-as-Claude-shaped-it; the M1 shell at `01f3777` is the first code commit; everything since has been documentation.

---

## 13. Where to ask if something here is wrong

This file is the wiki, not the contract. If something here disagrees with the spec, the spec wins; fix this file. If you find a real contradiction inside the spec or feature definitions, raise it to the user before editing — the user has been carefully shaping each decision and would want to be the one to resolve.

**One thing this wiki cannot tell you: the user's current priority right now.** Ask them.
