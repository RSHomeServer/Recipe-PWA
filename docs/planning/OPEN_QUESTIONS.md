# Open Questions — Decision Log

**No blocking questions remain. V1 is fully specified.**

> **V2 decisions are not recorded here.** From V2 onward, any decision that changes,
> constrains or reinterprets a rule gets an ADR in [`docs/adr`](../adr/README.md), because a
> flat list with no status field and no supersession mechanism cannot express "decision 4
> still holds, but here is the boundary case it did not anticipate". This document remains
> authoritative for V1 and is not edited. See
> [`docs/adr/README.md`](../adr/README.md#relationship-to-the-v1-decision-list) for how each
> V1 decision stands after V2.
>
> Two V2 choices are recorded with lower confidence than the rest and are the ones to revisit
> first if they prove wrong: the choice of CoFID over USDA as the seed dataset
> ([ADR-002](../adr/002-reference-ingredient-data-and-provenance.md)), and the decision to
> make control style a cardinality rule rather than the user-facing toggle originally asked
> for ([ADR-005](../adr/005-choice-controls-by-cardinality.md), which keeps a narrow escape
> hatch precisely because of that).

This document is now a record rather than a queue. It exists so that later tickets can see
what was asked, what was decided, and why — and so nothing settled here is quietly reopened.

If implementation reveals a concrete contradiction, raise it here with the evidence rather than
changing the model in passing.

## Resolved — the five blocking questions

| # | Question | Decision |
| --- | --- | --- |
| A | Should batch nutrition be frozen at cook time? | **Yes.** An immutable `BatchSnapshot` is written at creation and never updated. |
| B | Does logging a bare ingredient deduct pantry stock? | **Yes.** Never blocked; may go negative; never clamped. |
| C | How does an unfinished batch end? | **`closedAt` write-off.** No waste record, no change to historical nutrition. Exhausted batches leave available food automatically. |
| D | What date range feeds the shopping list? | **User-chosen, default today → next 7 days.** Not a calendar week, never unbounded. Ticks are scoped by window key. |
| E | Is JSON export/import in V1? | **Yes.** Whole-database export with base64 images; validated all-or-nothing import into a clean database. No merge. |

### A — Batch nutrition is frozen

A Batch is a historical event, so its nutrition must not move when the source recipe or an
ingredient is later edited. `Batch.snapshot` records the recipe name, the ingredient lines
(ids, names, **actual quantities used**, and the nutrition of those quantities) and the total.

Two consequences worth restating, because they are easy to lose:

- **Actual quantities may differ from the recipe.** The cook flow seeds quantities from the
  scaled recipe and lets the user edit them, so a recipe calling for 500 g of chicken cooked
  with 550 g stores 550 g. Pantry deduction uses the actual quantities too.
- **This does not violate decision 23.** That principle targets analytical data — recipe
  totals, plan requirements, shopping arithmetic, insights — all of which remain derived. A
  snapshot is historical provenance, not recomputable from anything else once the recipe moves
  on.

Specified in [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) and
[NUTRITION_MODEL.md](./NUTRITION_MODEL.md). The history-immutability test is the highest-value
regression test in the repository.

### B — Bare ingredient logging deducts stock

The pantry holds raw ingredients currently available, so eating one raw removes it: log 200 ml
of milk against 1000 ml and the row reads 800 ml. Consistent with decision 12, the deduction
never blocks — insufficient recorded stock goes negative and is surfaced for correction rather
than being clamped.

Stock therefore leaves the pantry in exactly two situations: creating a Batch, and logging a
bare `ingredient`. Never for a portion (decision 13), never for `recipeServings`, never for
anything planned (decision 12).

### C — Closing a batch

Closing sets `closedAt`, removes the batch from available prepared food, writes off the
remaining portions, creates **no** waste record, and leaves historical nutrition untouched.

One implementation refinement, recorded because it differs slightly in mechanism from the
decision as written while producing identical behaviour: a batch is available prepared food
while `closedAt === null && portionsRemaining > ε`, so **exhaustion is handled by that
predicate and `closedAt` is written only for manual closure**. Writing `closedAt` on exhaustion
would store a value fully determined by derived state, and since remaining portions are
derived, deleting a log would then leave a batch marked closed while it again contains food. If
a stored timestamp on exhaustion is later wanted for reporting, it must be paired with a
`closedManually` flag. Either way there is no separate "empty batch" state, which was the
requirement.

### D — Shopping window

`ShoppingWindow = { from, to }`, defaulting to today through today + 6 days inclusive, shown
and editable at the top of the shopping view. Requirements aggregate across all planned meals
in the range **before** pantry stock is subtracted.

`windowKey` is `` `${from}_${to}` `` and forms part of the overlay's identity, so changing the
range never reinterprets existing ticks: the new range gets its own overlay, the previous one
is preserved, and carrying ticks across is an explicit user action.

### E — JSON export and import

Export covers all application data in a schema-valid representation with recipe images
base64-encoded inline. Import validates the entire payload through the same Zod schemas and is
all-or-nothing into a clean database. **No merge import** — without multi-device sync it would
add conflict resolution for no benefit. ZIP is not introduced unless file size becomes a
demonstrated problem.

## Accepted defaults

All confirmed. Listed so no ticket re-derives them.

| Topic | Decision |
| --- | --- |
| Custom food | Inline on the `LoggedMeal` entry. **No reusable `Food` entity in V1**; promotion is the later path toward barcode and external databases. |
| Recipe images | User selects a local file; optional; resized and compressed; stored as a Blob referenced by `imageId`. No camera capture, no cropping UI, no cloud upload. **No layout depends on an image being present.** |
| Availability thresholds | `canMake` = nothing missing; `almostCanMake` = 1–2 missing; `missingSignificant` = 3+ missing. Held in the named constant `ALMOST_CAN_MAKE_MAX_MISSING`. A UX classification, tunable after testing — not a domain truth. |
| Pantry staples | **No staple or basic-ingredient flag in V1.** A missing quantity of salt is treated like any other missing ingredient. |
| Zero pantry quantities | Rows are kept. "Known but not stocked" is useful for ingredient pickers and shopping. |
| Negative pantry quantities | Allowed, surfaced clearly with a simple correction. Never clamped, never blocking. |
| Meal slots | Breakfast, Lunch, Dinner, Snack seeded as **data** rows. Not hard-coded; custom slots later need a settings screen, not a migration. |
| Recipe and ingredient deletion | **Archive, never delete.** Batches, plans and logs must retain their references. |
| Meal log timestamps | `loggedAt` recorded in V1; time is not surfaced as significant UI yet. |
| Week start | Monday. |
| IDs | `crypto.randomUUID()`. |

## Superseded recommendations

Recorded so a stale earlier suggestion is never mistaken for current guidance.

| Earlier recommendation | Superseded by |
| --- | --- |
| Append-only pantry movement ledger with derived quantity | Decision 10 — one stored quantity per ingredient. The pantry is a planning aid, not an accounting system. |
| `densityGPerMl` / `gramsPerItem` for cross-family unit conversion | Decision 2 — in-family conversion only (g↔kg, ml↔L). No ingredient-specific conversion tables. |
| Optional `cookedWeightG` on `Recipe` | Decisions 7 and 24 — no cooked-weight tracking. Nutrition never needs it. |
| No nutrition targets in V1 | Decision 20 — an optional, manually entered daily calorie target, presented plainly ([DESIGN.md](./DESIGN.md) §8.4). |
| Batch stores only `recipeId` + `scale`, nutrition recomputed | Decision A — frozen snapshot with actual quantities. |
| `isStaple` flag driving minor/major availability | Decision 11 and the accepted default — classification by count of missing ingredients. |
| Fixed `MealSlot` union type | Decision 14 — slots are data. |
| Cook-day field or cook-session entity on the planner | Decisions 12 and 14 — plan meals; create a Batch when you actually cook. |

## Original question log

The ten questions raised during planning and where each was answered.

| Was | Answer |
| --- | --- |
| Q1 Retroactive ingredient nutrition edits | Batches are exempt via the snapshot (A). Recipes and `recipeServings` logs reflect current data; no recipe versioning. |
| Q2 Portions or physical containers | Portion count only (decision 7). |
| Q3 Does cooking deduct pantry stock | Yes, using actual quantities; warn, never block (decision 12). |
| Q4 Separate cook day from eat day | No cook-session entity, no `cookOn` field (decisions 12, 14). |
| Q5 Shopping window | User-chosen range, default next 7 days (D). |
| Q6 Reserve batch portions when planned | No reservation; planning changes nothing physical (decisions 8, 12, 14). |
| Q7 Single device, no sync | Local-only, no accounts, no cloud (decision 24); JSON backup instead (E). |
| Q8 Nutrition targets in V1 | Yes — calories only, manually entered (decision 20). |
| Q9 Who owns the interactive component layer | shadcn/ui with the specified toolbox (decision 25). |
| Q10 Batch nutrition snapshot | Yes (A). |

## Implementation readiness

Every ticket in the [implementation sequence](./ARCHITECTURE.md) is unblocked. No step is
waiting on a decision.
