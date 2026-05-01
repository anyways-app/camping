# Camp King — Feature Definitions

One markdown file per `FEAT-NNN` from `docs/roadmap/feature-roadmap.csv`, structured per `_template.md`. This is where each feature gets fleshed out far enough to plan its build: user flows, data inputs / outputs, edge cases, open questions.

The three docs surfaces and how they relate:

| Surface | Role |
|---|---|
| `docs/spec/` | **Binding contract.** Product invariants. Short, dense, authoritative. Changes are real decisions. |
| `docs/roadmap/feature-roadmap.csv` | **Index.** One row per feature with stable `FEAT-NNN` IDs, release, status. |
| `docs/features/` (this directory) | **Operational definitions.** Per-feature how-it-works detail. Bridges between spec and CSV. |

When the three disagree, the spec wins. The CSV and feature files exist to make the spec actionable, not to override it.

## Drafting workflow

1. Pick a feature row from the roadmap CSV that hasn't been drafted (status table below).
2. Copy `_template.md` to `FEAT-NNN-<kebab-name>.md`. Truncate the filename to ≤60 characters.
3. Fill out every required section. Use existing spec text where it has depth; surface gaps as "Open questions" with an owner tag.
4. Update the **Drafting status** table below.
5. If the drafting process surfaces new spec-level decisions (not just feature detail), capture them in `00-core.md` (or the relevant addendum) and reference back.

## Conventions

- **YAML frontmatter is required.** Fields: `id`, `area`, `release`, `status`, `dependencies`, `last_reviewed`.
- **Open questions get an owner**: `(product)`, `(design)`, `(backend)`, `(legal)`, `(ops)`, or `(TBD)`. Default: write a sensible default inline as "Default: …" so the question isn't blocking until reviewed.
- **Cross-platform notes** only included when there's actual divergence. Omit for total parity.
- **Edge cases section is required.** "N/A — [why]" is a valid answer for trivial features but the section header still appears.
- **References use markdown links** to `../spec/00-core.md#anchor` so navigation works from any rendered view.
- **Definitions are not implementation plans.** No code, no technical task lists. Behaviour and data only. Implementation planning happens in build-time milestones, not here.

## Suggested drafting order

Maximises leverage by tackling foundational areas first so dependent features have a stable target to reference.

| Order | Area | Features | Why first / last |
|---|---|---|---|
| 1 | Identity & Accounts | 12 | Foundational; shapes everything below. |
| 2 | Social Graph & Privacy | 6 | Load-bearing for cards, trips, forwarding. |
| 3 | Trips | 16 | Novel UX surface; most fleshing needed. |
| 4 | Card + Card Creation + Card Interactions | 24 | Core product loop. |
| 5 | Sensors | 7 | Platform-divergent; cross-platform care. |
| 6 | Borders / Tagging / Moderation / Casting | 6 | Small but important. |
| 7 | Web / iOS / Android Platform | 18 | Mostly platform-specific elaborations. |
| 8 | Auth / Backend / Operations | 9 | Plumbing. |
| 9 | Strategic / v2+ deferred | 8 | Lightest-touch placeholders; can stay terse. |

Total: 110 features. Realistic batch size: 5–10 per session for substantive areas.

## Drafting status

Updated as features are drafted. Three states:

- **`—`** — not yet drafted.
- **Drafted** — first pass complete, awaiting product review.
- **Reviewed** — locked. Changes need a follow-up review.

Currently drafted (32 of 110):

| FEAT | Name | Status | Last reviewed |
|---|---|---|---|
| FEAT-001 | Troops as account container | Drafted | 2026-05-01 |
| FEAT-002 | Single troop leader | Drafted | 2026-05-01 |
| FEAT-003 | Sub-profiles under a troop | Drafted | 2026-05-01 |
| FEAT-004 | Profile picker on launch | Drafted | 2026-05-01 |
| FEAT-005 | Leader profile PIN | Drafted | 2026-05-01 |
| FEAT-006 | Optional protected sub-profile PIN | Drafted | 2026-05-01 |
| FEAT-007 | Per-sub-profile feature gate matrix | Drafted | 2026-05-01 |
| FEAT-008 | ToS attestation — 13+ for every profile | Drafted | 2026-05-01 |
| FEAT-009 | Troop leader feature gate management UI | Drafted | 2026-05-01 |
| FEAT-010 | Verified-kids tier (deferred) | Drafted | 2026-05-01 |
| FEAT-011 | Co-leadership and ownership transfer (deferred) | Drafted | 2026-05-01 |
| FEAT-012 | Larger troops / tiered offering (deferred) | Drafted | 2026-05-01 |
| FEAT-013 | Per-profile social graph | Drafted | 2026-05-01 |
| FEAT-017 | Troop-wide contact sharing | Drafted (seed) | 2026-05-01 |
| FEAT-018 | Privacy invariant — uploader-only + 2 leader exceptions | Drafted | 2026-05-01 |
| FEAT-019 | Trips section in app navigation | Drafted | 2026-05-01 |
| FEAT-020 | Trip creation by troop leader | Drafted | 2026-05-01 |
| FEAT-021 | Trip metadata fields (v1) | Drafted | 2026-05-01 |
| FEAT-022 | Trip lifecycle (draft / active / ended) | Drafted | 2026-05-01 |
| FEAT-023 | Invite other troop leaders to a trip | Drafted | 2026-05-01 |
| FEAT-024 | Accept trip invite | Drafted | 2026-05-01 |
| FEAT-025 | Trip creator role | Drafted | 2026-05-01 |
| FEAT-026 | Trip co-leader promotion | Drafted | 2026-05-01 |
| FEAT-027 | Trip-shared contact list | Drafted | 2026-05-01 |
| FEAT-028 | Share with this trip toggle | Drafted | 2026-05-01 |
| FEAT-029 | Sub-profile per-trip visibility override | Drafted | 2026-05-01 |
| FEAT-030 | Trip participation feature gate | Drafted | 2026-05-01 |
| FEAT-031 | Forwarding-gate strictness on trips | Drafted | 2026-05-01 |
| FEAT-032 | Trip privacy boundaries | Drafted | 2026-05-01 |
| FEAT-033 | Trip features beyond v1 metadata (deferred) | Drafted | 2026-05-01 |
| FEAT-034 | Trip creator transfer / co-creator (deferred) | Drafted | 2026-05-01 |
| FEAT-061 | Forward picker modal | Drafted (seed) | 2026-05-01 |
| FEAT-090 | Camp Atlas (deferred) | Drafted | 2026-05-01 |

A full status table covering all 110 will be maintained here as drafting proceeds; the remaining ~78 are in the inherited / supporting feature set (sensors, auth, casting, platform plumbing, strategic v2+ items) and can be drafted in subsequent batches per the suggested order above.

## After drafting is complete

Once every FEAT has a definition file, we re-examine phasing. The dependency graph and the cost-of-build estimates that fall out of the open-questions sections will tell us:

1. Which features are genuinely v1-load-bearing vs. which were assumed v1 but can be cut.
2. Which v2+ items are cheap to pull forward.
3. Where the natural milestone boundaries sit (M2, M3, M4, …).

That phasing pass then back-edits the `Release` column in the CSV and the deferred-list items in `00-core.md`. The point of writing all 110 definitions before re-phasing is to avoid the trap of phasing on incomplete information.
