---
id: FEAT-NNN
area: <Identity & Accounts | Social Graph & Privacy | Trips | Card | Card Creation | Feed | Card Interactions | Borders | Tagging | Moderation | Sensors | Auth | Backend | Casting | Web Platform | iOS Platform | Android Platform | Operations | Strategic>
release: <v1 | v2>
status: <Spec'd | Built (M1 web) | Deferred>
dependencies: [FEAT-XXX, FEAT-YYY]
last_reviewed: YYYY-MM-DD
---

# FEAT-NNN: <Feature name>

## Summary

One paragraph. What this feature is, the problem it solves, who it serves. If this is a sub-feature of a larger surface (e.g. a step in a creation flow), name the parent feature here.

## Roles & permissions

Who can see / use / change this feature, by role. Reference the canonical role names: troop leader, sub-profile, trip creator, trip co-leader, trip member, unauthenticated visitor, system / moderator. Call out feature-gate dependencies (e.g. "subject to the 'Forward outside the troop' gate").

## Surfaces

Which screens / sections of the app expose this feature. Include the navigation paths users actually take — entry points, parent screens, modal vs. inline.

## Behaviour

Step-by-step user flow. Number the happy path; use sub-bullets for branches and side effects.

For each step, name both the client-side UX and the server-side effect (insert / update / delete / event broadcast). When state transitions matter, name them explicitly.

## Data

What schema fields the feature reads and writes. Reference `00-core.md` table names. Call out any new fields this feature implies that aren't yet in the spec.

## Edge cases

Cover at least these axes when relevant:

- Permission denied / declined
- Network down / offline
- Race conditions across concurrent profiles in the same troop
- Rate limits / quotas exceeded
- Empty states
- Stale data on slow refresh

If a category genuinely doesn't apply, write "N/A — [why]" instead of dropping it.

## Out of scope

What this feature deliberately does NOT do, with pointers to where those bits live (other FEATs, v2+ deferrals, or "not planned"). This is where we keep scope from creeping.

## Open questions

Decisions still TBD before the feature can be built. Each one is numbered and tagged with an owner: `(product)`, `(design)`, `(backend)`, `(legal)`, `(ops)`, or `(TBD)`.

Where there's a sensible default to write in until decided, propose it inline as "Default: …".

## Cross-platform notes

Only include this section when there's actual platform divergence. Bullet form:

- **Web**: …
- **iOS**: …
- **Android**: …

If parity is total, omit the section entirely.

## Verification

How we know this works. Cross-reference:

- Cross-platform e2e steps in `00-core.md` § Verification.
- Troop-specific or trip-specific verification subsections, if applicable.
- Automated test floor entries.

If this feature implies new verification scenarios that aren't yet in `00-core.md`, list them here as "Proposed verification:" and we'll roll them into the spec when the feature is locked.
