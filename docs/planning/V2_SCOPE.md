# V2 Scope

The build specification for Recipe PWA V2. Every requirement here traces to an ADR in
[`docs/adr`](../adr/README.md); the ADRs carry the reasoning, this document carries the work.

V1 is complete and shipped (PRs #1–#12). Nothing in V2 rewrites it. The five decisions below
fix what use revealed: geometry that was never centred, a library that was never populated,
words that never explained the model, a repeated meal that took twenty interactions, and one
control doing four different jobs.

Companions: [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), [DESIGN.md](./DESIGN.md),
[ARCHITECTURE.md](./ARCHITECTURE.md), [FEATURE_MATRIX.md](./FEATURE_MATRIX.md).

## The headline acceptance scenario

Everything in V2 is in service of this. If it does not hold, V2 is not done.

> From a fresh install, with no data entered by hand, the user plans
> **chicken thighs + hashbrowns + peas + BBQ sauce** for four dinners this week in **under 60
> seconds and fewer than 15 interactions**, without typing a single nutrition figure, and the
> shopping list then shows the correct aggregate quantity for all four days minus whatever is
> in the pantry.

The path: the four ingredients already exist from the starter pack (ADR-002) → build the meal
once in the composer, four picks through the command palette (ADR-005) → *Save these as a
meal* (ADR-004 §5) → apply it, ticking four days at once (ADR-004 §3) → Shopping shows the
aggregate.

## Requirements

Each requirement has an ID for traceability. **MUST** is binding; **SHOULD** is expected
unless a specific obstacle is found and recorded.

### R1 — Layout and density ([ADR-001](../adr/001-page-geometry-and-density.md))

| ID | Requirement |
| --- | --- |
| R1.1 | `.app-page` MUST centre horizontally. Add `margin-inline: auto` and `width: 100%` in `src/app/styles/app.css`. This alone resolves the dead space on the right of every route. |
| R1.2 | Three page width roles MUST exist as modifier classes — `prose` (48rem), `content` (72rem), `workspace` (90rem) — and every route MUST declare one. Settings, ingredient editor, recipe editor and all single-column forms use `prose`; recipes, ingredients, pantry, cook and log use `content`; plan, insights and shopping use `workspace`. |
| R1.3 | A plan day column MUST be at least 11rem wide. The seven-column grid MUST NOT render below the `xl` breakpoint (80rem). |
| R1.4 | Between `md` and `xl` the planner MUST render a horizontally scrollable day track (`grid-auto-flow: column; grid-auto-columns: minmax(11rem, 1fr)`) with scroll-snap on column boundaries and today scrolled into view. Below `md` the existing single-day view is unchanged. |
| R1.5 | `PlanSlotTile` MUST gain a `density` prop (`"comfortable"` default, `"compact"`). `compact` renders at most two lines of text and drops the hint sentence and the uppercase category label; the cook / portion / item distinction is carried by icon and surface treatment only. |
| R1.6 | Per-tile delete and "Move to…" MUST collapse into one 44px overflow `DropdownMenu`. The drag handle stays. The menu MUST preserve the existing keyboard path to any day and slot. |
| R1.7 | List rows MUST cap their measure at 72rem, with right-aligned numeric groups in a fixed-width column rather than pushed to the viewport edge. |
| R1.8 | Section spacing MUST follow DESIGN.md §5: `--space-8` between sections, `--space-4` between fields, `--space-2` between related rows. Audit and correct every route. |

### R2 — Reference ingredient data ([ADR-002](../adr/002-reference-ingredient-data-and-provenance.md))

| ID | Requirement |
| --- | --- |
| R2.1 | `Ingredient` MUST gain a non-nullable `source: IngredientSource` (shape in ADR-002 §1) and a nullable `imageId`. |
| R2.2 | `source` MUST NOT be read by any calculation, derivation, filter or sort. Guarded by property test. |
| R2.3 | The origin fields (`datasetId`, `datasetName`, `entryCode`, `entryName`, `licence`, `url`, `retrievedAt`) MUST be write-once. The repository rejects mutation, as it already does for `Batch.snapshot`. |
| R2.4 | Editing the nutrition of a `reference` ingredient MUST set `kind` to `"userEntered"` while preserving the origin fields, and the UI MUST show that it has diverged from its source. |
| R2.5 | A curated starter pack of **~150 generic ingredients** derived from UK CoFID MUST ship as a static JSON asset and seed on first run, alongside the existing category and slot seeds. |
| R2.6 | The pack MUST cover the stated weekly pattern on day one: chicken thigh and wing (raw, skin on and off), frozen hashbrowns, frozen peas, mixed vegetables, broccoli, and common table sauces including BBQ. |
| R2.7 | Seeding MUST be additive and matched by `source.entryCode`. It MUST NOT overwrite an ingredient the user has edited. It is a **seed, not an import** — decision E's replace-only backup import is untouched and remains the only thing called "import". |
| R2.8 | Settings MUST offer *"Add missing starter ingredients"*, reporting what was added and what was skipped. |
| R2.9 | Every pack entry MUST validate against `IngredientSchema` **at build time**, failing CI on any error. |
| R2.10 | `IngredientCategory` MUST gain `icon` (Lucide name) and `accent` (existing token), giving every ingredient a default visual identity that is always present. |
| R2.11 | `Ingredient.imageId` MUST support an optional user photo using the existing recipe-image mechanism (file pick, canvas resize, Blob). Upload lives in the ingredient editor only. Absent means the category icon renders — the layout never shifts and a list is never ragged (DESIGN.md §11). |
| R2.12 | Licence attribution MUST appear in Settings → About. **A human MUST re-read the source's licence terms before release.** Do not take the summary in ADR-002 as sufficient. |

### R3 — Nomenclature and explanation ([ADR-003](../adr/003-food-nomenclature-and-promotion-rule.md))

| ID | Requirement |
| --- | --- |
| R3.1 | The composer question MUST become **"Where's this coming from?"** with the three labels and helper texts in ADR-003 §3. "Already cooked (batch portion)", "Still to cook", "Eat as-is" and "What to plan" MUST disappear from the product. |
| R3.2 | The lexicon in ADR-003 §4 is binding on all user-visible copy. **Serving and portion MUST NOT be used interchangeably.** |
| R3.3 | The recipe editor MUST warn — dismissibly, never blocking — when saving a recipe with exactly one line and `servings === 1`, explaining that a single ingredient can be planned directly. |
| R3.4 | When no batches are available, the "Eat a portion you already cooked" option MUST render disabled with its reason visible, not be hidden. |
| R3.5 | Explanation MUST be progressive per ADR-003 §5: persistent helper text first, then a 44px info `Popover` (not a `Tooltip`), then a dismissible "How this works" panel on Plan and Cook. |
| R3.6 | **No information may exist only inside a hover tooltip.** Tooltips are reserved for icon-only buttons on pointer devices, duplicating an existing `aria-label`. |
| R3.7 | The "How this works" dismissal MUST persist in `Settings` and be restorable from Settings. |

### R4 — Meals ([ADR-004](../adr/004-meal-templates-by-expansion.md))

| ID | Requirement |
| --- | --- |
| R4.1 | A `MealTemplate` entity MUST be added (shape in ADR-004 §1), with components restricted to `recipeServings` and `ingredient` entries. `batchPortions` and `customFood` MUST be rejected by the schema. |
| R4.2 | `PlannedMeal` and `LoggedMeal` MUST gain a nullable display-only `group: PlanGroup`. |
| R4.3 | **No derivation may read `group`.** Requirements, shopping, availability, nutrition, `expand()` and every insight MUST produce byte-identical output with `group` populated and with it cleared. This is the governing property test of the feature. |
| R4.4 | Applying a template MUST support **selecting several days at once**. This is the single highest-value interaction in V2. |
| R4.5 | Applying MUST create one ordinary `PlannedMeal` per component per selected day, sharing a `group.id` per day, in component order, positioned after anything already in that slot. |
| R4.6 | Grouped rows MUST remain individually editable, movable and deletable. Deleting one leaves the rest intact. |
| R4.7 | Editing a template MUST NOT alter plans already created from it. The editor MUST state this. |
| R4.8 | A group MUST render as one expandable tile offering *Move all*, *Remove all*, *Log all* and *Ungroup*, with per-component actions inside the expanded view. |
| R4.9 | *Log all* MUST create one `LoggedMeal` per component with correct `plannedMealId`s, with pantry and batch side effects identical to logging each individually. |
| R4.10 | The composer MUST open with a **recents rail**: up to twelve distinct recent entries derived from `plannedMeals` and `loggedMeals`, deduplicated by entry identity, most recent first. Derived, never stored. |
| R4.11 | When a slot on one day holds two or more ungrouped entries, the UI MUST offer *"Save these as a meal"*, pre-filling a template. |

### R5 — Choice controls ([ADR-005](../adr/005-choice-controls-by-cardinality.md))

| ID | Requirement |
| --- | --- |
| R5.1 | Control choice MUST follow option cardinality: 1 → static text; 2–6 → segmented button group; 7–15 → button grid or combobox; >15 or unbounded → command palette. |
| R5.2 | A `SegmentedGroup` component MUST be built on Radix `ToggleGroup` (`type="single"`), exposing `role="radiogroup"` with arrow-key navigation and one tab stop. Not a row of plain buttons. |
| R5.3 | Segmented options MUST meet 44 × 44px at 320px width, wrap rather than scroll, and indicate selection with colour **and** a check affordance. |
| R5.4 | Segmented groups MUST support per-option helper text rendered under the group for the selected option — this is how R3.1's explanations reach the user. |
| R5.5 | A disabled option MUST stay visible with its reason in its accessible name. |
| R5.6 | A `CommandPicker` MUST be built on shadcn `Command` in a `Dialog` (bottom sheet under `md`), search-first, with recents pinned before any query. |
| R5.7 | Palette rows MUST carry decision-relevant context: recipes show per-serving kcal and availability; ingredients show category and pantry quantity; batches show portions remaining and cook date. |
| R5.8 | The palette MUST be fully keyboard-operable with focus returned to the trigger on close. |
| R5.9 | `Settings.controlStyle: "adaptive" \| "compact"` MUST exist, defaulting to `"adaptive"`. `"compact"` forces native selects for the 2–6 case only; it does not affect palettes. |
| R5.10 | Multi-select, free text, numeric entry and date inputs are out of scope for this change. |

## Data model changes

Consolidated. Full shapes and invariants live in the ADRs and in
[DOMAIN_MODEL.md](./DOMAIN_MODEL.md).

| Entity | Change | Migration |
| --- | --- | --- |
| `Ingredient` | `+ source: IngredientSource` (non-null), `+ imageId: Id \| null` | `source = { kind: "userEntered", all origin fields null, note: null }`; `imageId = null` |
| `IngredientCategory` | `+ icon: string`, `+ accent: string` | Seeded categories get their documented values; user-created get a neutral default |
| `MealTemplate` | **New table** | Empty |
| `PlannedMeal` | `+ group: PlanGroup \| null` | `null` |
| `LoggedMeal` | `+ group: PlanGroup \| null` | `null` |
| `Settings` | `+ controlStyle`, `+ howItWorksDismissed`, `+ starterPackVersion` | Defaults via the existing `normalizeSettingsRow` pattern |

### Dexie schema version 2

```
mealTemplates    id, name, archivedAt
ingredients      id, name, categoryId, archivedAt          (unchanged indexes)
plannedMeals     id, date, [date+slotId], group.id         (+ nested keypath index)
loggedMeals      id, date, [date+slotId], plannedMealId, group.id
```

Notes for the implementer:

- Dexie indexes nested key paths directly, so `group.id` is a valid index string.
- **Image storage reuses the existing `recipeImages` table** for ingredient photos. The table
  name is now historical. Renaming it would mean copying Blob rows in an `upgrade()` for no
  functional gain, and a needless migration of binary data is a worse trade than a slightly
  stale table name. Record the reason in the schema file so nobody "tidies" it later.
- `Backup.formatVersion` stays **1** — the envelope shape is unchanged. `Backup.schemaVersion`
  becomes **2**. Export must include `mealTemplates`; import must accept a v1 payload and run
  the normal migrations, and must still refuse a payload from a newer schema version.
- The append-only migration rule from ARCHITECTURE.md holds: v1 is never edited.

## Ticket sequence

Ordered so nothing is built on an unsettled foundation. Steps 1, 2 and 4 are independent and
can run in parallel.

| # | Ticket | Scope | Depends on | ADR |
| --- | --- | --- | --- | --- |
| 1 | **Layout and density foundation** | R1.1–R1.8. CSS fix, width roles, plan grid breakpoints and scroll track, `PlanSlotTile` density, overflow menu, spacing audit. | — | 001 |
| 2 | **Choice control primitives** | R5.1–R5.10. `SegmentedGroup` and `CommandPicker` in `src/ui/`, `Settings.controlStyle`, migrate existing call sites. | — | 005 |
| 3 | **Copy and explanation pass** | R3.1–R3.7. Lexicon applied repo-wide, composer question and helper text, info popovers, "How this works" panel, single-ingredient warning. | 2 | 003 |
| 4 | **Ingredient provenance model** | R2.1–R2.4, R2.10, and the Dexie v2 migration for `ingredients`, `ingredientCategories` and `settings`. Schema, repository write-once enforcement, backup round-trip. | — | 002 |
| 5 | **Starter ingredient pack** | R2.5–R2.9, R2.12. The curated data asset, build-time validation, first-run seed, Settings top-up, attribution. | 4 | 002 |
| 6 | **Ingredient identity in the UI** | R2.11. Category icons throughout, optional user photo in the ingredient editor, list and detail rendering. | 4, 5 | 002 |
| 7 | **Meal templates** | R4.1–R4.9. Entity and schema, Dexie v2 table and `group` fields, template editor, apply flow with multi-day selection, grouped tile, *Log all*. | 1, 2, 4 | 004 |
| 8 | **Recents and save-as-meal** | R4.10–R4.11. Recents derivation and rail in the composer, *Save these as a meal*. | 7 | 004 |
| 9 | **Today as the fast path** | Make `/` do the job the acceptance scenario needs: today's plan, one-tap log, apply-a-meal, recents. Addresses the "Today page is thin" finding in [UX_CRITIQUE.md](./UX_CRITIQUE.md). | 7, 8 | 001, 004 |
| 10 | **V2 UX and accessibility critique** | Full pass against DESIGN.md and §9, including the macro-colour AA verification still deferred from V1, and the headline acceptance scenario measured end to end. | 1–9 | all |

### Carried over from V1

These were recorded as deferred in [UX_CRITIQUE.md](./UX_CRITIQUE.md) and belong to step 10:

- Macro colour AA contrast verification in both themes. Tune the hex values **in DESIGN.md**,
  never in a component.
- `RouteStatePanel` should use PWA-Base `Skeleton` with a ~150ms delay (DESIGN.md §11).
- Remaining `text-sm` body copy audited against the 16px floor.

## Testing

Additions to the tiers in [ARCHITECTURE.md](./ARCHITECTURE.md). The first two are the ones
that must not be skipped.

1. **Group invariance (R4.3)** — the governing test for meal templates. Generate a plan,
   compute requirements, shopping, availability, all `expand()` results and all insights;
   clear `group` on every row; recompute; assert byte-identical. If this passes, meal
   templates cannot have broken anything derived.
2. **Provenance invariance (R2.2)** — permute `source.kind` across all four values over a
   corpus and assert every derived result is unchanged.
3. **Starter pack integrity** — build-time schema validation, plus spot-checks asserting named
   entries against their published figures and `entryCode`s.
4. **Idempotent seeding** — running the top-up twice adds nothing the second time and never
   modifies an edited row.
5. **Reference divergence** — editing a `reference` ingredient's nutrition preserves the
   origin fields and flips `kind`.
6. **Template expansion** — four components × four days produces sixteen rows in four groups,
   in component order; deleting one leaves three grouped; a template renamed afterwards leaves
   `group.name` unchanged.
7. **Template aggregation** — a recipe reached through a template, planned on three days,
   aggregates three times before pantry subtraction (decision 18's rule via the new path).
8. **Log all** — a group of four produces four logs with correct `plannedMealId`s and side
   effects identical to logging individually.
9. **Migration** — a V1 database opens at schema v2 with every ingredient at
   `kind: "userEntered"`, every `group` null, and **no nutrition figure changed**.
10. **Backup round-trip at v2** — export, wipe, import, assert equivalence including
    `mealTemplates` and image Blobs; a v3 payload is refused.
11. **Control accessibility** — segmented group is a `radiogroup` with one tab stop and
    arrow-key selection; the palette is fully keyboard-operable with focus restored on close.
12. **Geometry** — `.app-page` gutters are equal at 1280/1920/2560px; no plan column is
    narrower than 176px at 768/1024/1440px.

Every V1 test must continue to pass unchanged. In particular the history-immutability test
(ARCHITECTURE.md testing §1) is unaffected by all of this and is the canary if something in
the migration goes wrong.

## Explicitly not in V2

Recorded so no ticket reopens them. Unchanged from decision 24 unless noted.

Recipe-to-recipe nesting (ADR-004 chose expansion instead) · a `batchPortions` component in a
meal template (ADR-004 §1) · online food-database lookup and barcode scanning (ADR-002 leaves
the shape ready; not built) · photos of generic foods from a third-party source (ADR-002 §3) ·
a global "buttons everywhere" toggle (ADR-005 chose a cardinality rule with a narrow escape
hatch) · cross-family unit conversion · expiry, lots and waste tracking · multi-user, sync,
accounts · macro targets · planned-versus-actual comparison · custom meal slots.
