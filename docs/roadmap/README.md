# Camp King — Feature Roadmap

Tracking artifact distinguishing what's in v1, what's deferred to v2+, and what's already built. Source of truth is the spec under `docs/spec/`; this directory is a *roadmap view* of that spec, optimised for archival and tracking.

## Files

- **`feature-roadmap.csv`** — the trackable archive. One row per feature, eight columns. Opens cleanly in Excel, Google Sheets, Numbers, or any CSV viewer. Diffable in version control.
- **`README.md`** (this file) — schema documentation, current counts, and how to keep the CSV in sync with the spec.

## CSV schema

| Column | Type | Purpose |
|---|---|---|
| `ID` | `FEAT-NNN` | Stable identifier. Never reuse an ID even if a feature is removed. |
| `Area` | text | Functional grouping (Identity & Accounts, Trips, Card, Feed, Sensors, etc.). |
| `Feature` | text | Short feature name. |
| `Description` | text | One-line summary of what the feature does. |
| `Release` | `v1` \| `v2` | Which release the feature ships in. v2 features are everything past v1, including indefinite-future items. |
| `Status` | `Spec'd` \| `Built (M1 web)` \| `Deferred` | Current implementation state. `Built (M1 web)` = shipped in milestone 1 web shell, possibly with stub backend. `Deferred` = on the v2+ list explicitly. |
| `Spec Reference` | path + anchor | Where to find the binding decision (e.g. `00-core.md#trips`). |
| `Notes` | text | Caveats, dependencies, decisions, links to related features. |

## Current counts

(Regenerate with `python3 scripts/roadmap-summary.py` if/when one exists, or run the inline command in the next section.)

| Cut | Count |
|---|---|
| **Total features tracked** | 110 |
| v1 | 89 |
| v2+ | 21 |
| Built in M1 web | 11 |
| Spec'd, not yet built | 78 |
| Explicitly deferred | 21 |

### v1 by area

| Area | Count |
|---|---|
| Trips | 14 |
| Identity & Accounts | 9 |
| Card Creation | 8 |
| Card | 7 |
| Sensors | 7 |
| Social Graph & Privacy | 6 |
| Web Platform | 6 |
| Feed | 5 |
| Card Interactions | 5 |
| iOS Platform | 5 |
| Android Platform | 4 |
| Auth | 3 |
| Backend | 3 |
| Operations | 3 |
| Moderation | 2 |
| Borders | 1 |
| Casting | 1 |

### v2+ deferred items

These map 1:1 to the numbered items in `00-core.md` § "Deferred to v2+", plus a handful of platform-specific deferrals from the addenda. See the CSV for full descriptions.

| ID | Feature | Spec item |
|---|---|---|
| FEAT-010 | Verified-kids tier (COPPA path) | (audience-branding amendment) |
| FEAT-011 | Co-leadership and ownership transfer | item 15 |
| FEAT-012 | Larger troops / tiered offering | item 16 |
| FEAT-033 | Trip features beyond v1 metadata | item 17 |
| FEAT-034 | Trip creator transfer / co-creator | item 18 |
| FEAT-042 | Splat Cards (3DGS card type) | item 13 |
| FEAT-049 | Additional system tags | item 8 |
| FEAT-052 | General-purpose AI image generation | item 9 |
| FEAT-063 | Direct messages between profiles | item 1 |
| FEAT-081 | Native cast streams | item 10 |
| FEAT-090 | Camp Atlas (group-shared site captures) | item 14 |
| FEAT-091 | Gaussian Splatting Night Sight v2 | item 12 |
| FEAT-098 | Android ARCore Depth (LiDAR equivalent) | (Android addendum) |
| FEAT-103 | Real-time chat / DM | item 1 (parallel to FEAT-063) |
| FEAT-104 | Calendar / event management | item 2 |
| FEAT-105 | Ride-share / transportation coordination | item 3 |
| FEAT-106 | Convoy management | item 4 |
| FEAT-107 | Campsite availability / dispersed camping | item 5 |
| FEAT-108 | Marketplace / paid connections / merchant onboarding | item 6 |
| FEAT-109 | Monetization billing + ultra-monetized reach | item 7 |
| FEAT-110 | Native iOS / Android rebuild | item 11 |

## Verifying the CSV

Run from the repo root:

```bash
python3 -c "
import csv
from collections import Counter
with open('docs/roadmap/feature-roadmap.csv') as f:
    rows = list(csv.DictReader(f))
print(f'Total: {len(rows)}')
print('By release:', dict(Counter(r['Release'] for r in rows)))
print('By status:', dict(Counter(r['Status'] for r in rows)))
ids = [r['ID'] for r in rows]
dups = [i for i in ids if ids.count(i) > 1]
print('Duplicate IDs:', set(dups) or 'none')
"
```

## Keeping the CSV in sync with the spec

The spec (`docs/spec/`) is authoritative. The CSV is a *view*. When the spec changes:

1. **Adding a feature** — add a row with the next available `FEAT-NNN`. Set `Release`, `Status`, `Spec Reference`, `Notes`.
2. **Removing a feature** — do not delete the row. Set `Status` to `Removed` (extend the enum if needed) and add a note explaining why and which commit removed it. This keeps the audit trail intact.
3. **Changing a feature's release target** — flip the `Release` column and add a note explaining the move.
4. **Changing a feature's status** — flip `Status` (Spec'd → Built, etc.) and add a note. Don't backfill status for features that don't exist yet.

If a spec edit lands in the same commit as the CSV update, prefer one PR / commit covering both. The CSV staying behind the spec is the failure mode to avoid.

## Why CSV and not Excel

`.xlsx` is binary and not git-friendly: every save churns a fresh blob, diffs are unreadable, merges are painful, and review tooling can't show you what changed. CSV is plain text — Excel imports it cleanly with no fidelity loss for this schema (no formulas, no cell formatting, no charts). When you want pivot tables, filters, or charts, do that in your local Excel / Sheets / Numbers session and don't commit the derived workbook back.

## Excel / Google Sheets quick-start

- **Excel**: File → Open → choose `feature-roadmap.csv`. Excel auto-detects the schema. Convert to a Table (`Ctrl+T`) for built-in filtering.
- **Google Sheets**: File → Import → Upload → `feature-roadmap.csv` → "Replace spreadsheet." Apply a filter view from Data → Create a filter.
- **Numbers (macOS)**: drag the CSV into Numbers; it imports as a table you can sort and filter.

To track progress over time without modifying this file: copy the CSV into a working sheet, add a `Status updated` column there, and let this file remain the canonical roadmap. Periodic syncs back to here keep both in step.
