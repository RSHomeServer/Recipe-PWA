# ADR-004: Meal templates by expansion, not by nesting

## Status

Accepted. Adds one stored entity and one display-only field. Upholds V1 decisions 4
(no recipe nesting), 14 (plan is intent) and 23 (derive, don't duplicate).

## Context

Half of this user's weekly meals are the same shape: chicken thighs or wings, hashbrowns,
some vegetables, a sauce. In V1 that is four separate trips through the plan composer, per
day, every time — roughly twenty interactions to fill four dinners with food they eat every
week. The product's most-repeated action is also its slowest.

[ADR-003](./003-food-nomenclature-and-promotion-rule.md) establishes that this combination is
neither an ingredient nor a recipe. It is a **meal**: a habitual grouping of things that are
individually already modelled. So the question is not *what* to add but *how much of the
model the addition is allowed to touch*.

### Options considered

**Allow recipes to contain recipes.** Reverses decision 4. Every derived function in
`domain/` assumes `RecipeLine → Ingredient` is a flat, one-hop relation: scaling,
requirements aggregation, availability, the cook flow's snapshot, and `expand()`. Nesting
turns each into a tree walk with cycle detection, and makes the batch snapshot's meaning
ambiguous. This is the largest change available and it buys the least, because a meal is not
a recipe in the first place — you do not cook a "chicken and hashbrowns" the way you cook a
curry, and it has no yield to divide.

**A first-class `Meal` entity referenced by a new `MealEntry` variant.** A
`{ kind: "meal", mealId, scale }` entry. Attractive on the surface: one tile, and edits to
the meal propagate to plans already made. But `MealEntry` is the shared shape at the centre of
the model — `requirements()`, `expand()`, shopping aggregation, availability, nutrition and
insights each exhaustively switch on it. A fifth variant means a new branch in every one, each
of which must recurse into the meal's components. That is recipe nesting, arriving through a
different door, with the same tree-walk consequences. Propagating edits into already-expressed
intent is also wrong on its own terms: V1 deliberately freezes what has already been recorded
(decision A, decision 15).

**Expansion.** A template is a named list of components. Applying it creates ordinary
`PlannedMeal` rows, one per component, tagged with a shared group id so the UI can present and
manipulate them as a unit. No derived path changes at all, because there is nothing new for
them to see.

## Decision

**Expansion.**

### 1. `MealTemplate` — a new stored entity

```ts
type MealTemplate = {
  id: Id;
  name: string;                      // "Wings, hashbrowns & veg"
  components: MealTemplateComponent[];
  defaultSlotId: Id | null;          // usually Dinner; null means "ask"
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  archivedAt: IsoDateTime | null;
};

type MealTemplateComponent = {
  id: Id;
  entry: RecipeServingsEntry | IngredientEntry;   // NOT batchPortions, NOT customFood
  note: string | null;
};
```

**A template may not reference a batch.** A template is timeless; a batch is a specific past
event with a finite number of portions. A template pointing at batch #4 would break the moment
that batch is eaten, and would be meaningless a month later. Eating a portion is already a
one-tap action from the Cook route and from the composer; it does not need a saved shape.

`customFood` is excluded for the same reason it is rejected on `PlannedMeal`: it is a log-only
concept.

### 2. `PlannedMeal` gains a display-only `group`

```ts
type PlannedMeal = {
  // … all V1 fields unchanged …
  group: PlanGroup | null;           // NEW
};

type PlanGroup = {
  id: Id;                            // shared by every row applied together
  name: string;                      // the template's name at the moment it was applied
  templateId: Id | null;             // provenance; may point at an archived template
};
```

`LoggedMeal` gains the same nullable field, copied when logging from a grouped plan, so the
diary reads the same way the plan did. Plan and log already share one entry shape by design;
they should share this too.

Storing `name` rather than resolving it through `templateId` follows the same reasoning as
`BatchSnapshot.recipeName`: a plan made in March should still read "Wings, hashbrowns & veg"
after the template is renamed or deleted. `templateId` is kept for navigation, and is allowed
to dangle.

**Invariants**

1. **`group` is display and bulk-action metadata only.** No derivation may read it.
   `requirements()`, `expand()`, shopping aggregation, availability, nutrition and every
   insight must produce byte-identical output whether `group` is populated or null. This is
   the invariant that makes the whole design safe, and it is a property test, not a comment.
2. Grouped rows are **ordinary planned meals**. Each is individually editable, movable and
   deletable. Deleting one leaves the others untouched and the group intact.
3. **Editing a template never rewrites plans already made from it.** Intent already expressed
   is a record. Consistent with decisions 15 and A.
4. A group may be dissolved (clear `group` on its rows), which is a pure UI affordance with no
   other effect.
5. `group.id` is not unique across the database and carries no referential integrity: it is a
   correlation tag. Rows sharing one are grouped; nothing enforces that they still exist.

### 3. Applying a template

The apply flow is where the twenty interactions become three:

- Pick the template.
- **Tick the days** — multi-select across the visible week, not one day at a time. This is the
  single highest-value interaction in V2 for the stated use case: four dinners in one action.
- Confirm the slot (defaulted from `defaultSlotId`) and any per-component quantity override.

One `PlannedMeal` per component per selected day, all rows for one day sharing a `group.id`,
positioned in component order after anything already in that slot.

### 4. The grouped tile

A group renders as one tile listing its components, with the group name as the title. It
expands to reveal the individual rows. Drag moves the whole group; the overflow menu from
[ADR-001](./001-page-geometry-and-density.md) §5 offers *Move all*, *Remove all*, *Log all*
and *Ungroup*, alongside the per-component actions inside the expanded view.

"Log all" creates one `LoggedMeal` per component, each with its own `plannedMealId`, in one
action. It is a loop over the existing single-entry log path, not a new one.

### 5. Recents and "save this as a meal"

Two derived affordances, neither of which stores anything:

**Recents rail.** The composer opens with a row of one-tap chips: the most recent distinct
entries across `plannedMeals` and `loggedMeals`, deduplicated by entry identity
(`kind` plus target id), most recent first, capped at twelve. Pure derivation over tables that
already exist and are already indexed by date. This is the other half of the user's request —
"pick recently added items in our meal plan" — and it costs one query.

**Save as a meal.** When a slot on one day contains two or more ungrouped entries, offer
*"Save these as a meal"*, pre-filling a template from them. This is how templates get created
without a separate authoring trip: you build the combination once by hand, then keep it.

## Consequences

Positive: the stated use case drops from roughly twenty interactions to three. Not one
function in `domain/` changes behaviour. Shopping aggregation, availability, nutrition and
insights are entirely unaware that templates exist, so none of them can be broken by this
feature — which is the property that made expansion worth choosing over the alternatives.

Negative: a template edit does not reach plans already made from it. This is deliberate and
consistent with the rest of the product, but it will surprise someone eventually, so the
template editor states it: *"Changes apply to meals you plan from now on."*

Negative: the plan stores four rows where a nested model would store one. At personal scale
this is irrelevant, and it is the direct cause of the benefit — those four rows are exactly
what makes every existing derivation work untouched.

Cost: one new table, one new nullable field on two entities, a template editor, an apply
flow with multi-day selection, and grouped rendering in two places. Contained, and none of it
is load-bearing for anything else.

## Verification

1. **The governing property test.** For a generated plan, compute requirements, the shopping
   list, availability, every `expand()` result and every insight. Clear `group` on every row.
   Recompute. Assert byte-identical results.
2. Applying a four-component template to four days creates sixteen `PlannedMeal` rows, in four
   groups of four, in component order.
3. Deleting one row from a group leaves the other three, still grouped.
4. Renaming a template leaves `group.name` on existing plans unchanged; deleting it leaves
   `templateId` dangling and the rows fully readable.
5. A template containing a recipe planned on three days aggregates that recipe's ingredients
   three times before pantry subtraction — the existing decision 18 test, reached through the
   template path.
6. "Log all" on a group of four produces four `LoggedMeal` rows, each with the correct
   `plannedMealId`, and the pantry and batch side effects are identical to logging each one
   individually.
7. `MealTemplateComponentSchema` rejects a `batchPortions` or `customFood` entry.
8. The recents rail returns at most twelve entries, deduplicated, most recent first, over a
   fixture containing duplicates across both plan and log.
