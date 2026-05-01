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

Currently drafted (2 of 110):

| FEAT | Name | Status | Last reviewed |
|---|---|---|---|
| FEAT-017 | Troop-wide contact sharing | Drafted (seed) | 2026-05-01 |
| FEAT-061 | Forward picker modal | Drafted (seed) | 2026-05-01 |

A full status table covering all 110 will be maintained here as drafting proceeds; for now the CSV is the index.

## After drafting is complete

Once every FEAT has a definition file, we re-examine phasing. The dependency graph and the cost-of-build estimates that fall out of the open-questions sections will tell us:

1. Which features are genuinely v1-load-bearing vs. which were assumed v1 but can be cut.
2. Which v2+ items are cheap to pull forward.
3. Where the natural milestone boundaries sit (M2, M3, M4, …).

That phasing pass then back-edits the `Release` column in the CSV and the deferred-list items in `00-core.md`. The point of writing all 110 definitions before re-phasing is to avoid the trap of phasing on incomplete information.
