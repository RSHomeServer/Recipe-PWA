# ADR-010: The Flavour Lab is a lens over existing entities, not a section of its own

## Status

Accepted. Settles the information architecture of V3 and adds one field to `Recipe`.

## Context

The external brief proposed a fifth top-level section with four children:

```
Flavour Lab
├── Ingredients
├── Seasoning Mixes
├── Sauces
└── Snacks
```

Set against what V2 actually shipped, three of those four already exist:

| Brief's proposal | Already in the product |
| --- | --- |
| Flavour Lab → Ingredients | `/ingredients` — 2,852 seeded rows, provenance, category identity, common-first pickers |
| Flavour Lab → Seasoning Mixes | `/recipes` — lines reference ingredients, nutrition derived, breakdown by line |
| Flavour Lab → Sauces | `/recipes`, plus `/cook` for a batch in the fridge with portions remaining |
| Flavour Lab → Snacks | `/meals` — `MealTemplate` expands base + mix onto any day, shipped in ticket 7 |

Building the proposed tree would mean a second ingredient list that is not the ingredient
list, a second recipe editor that is not the recipe editor, and a second saved-combination
entity alongside `MealTemplate`. Every one of those forks nutrition derivation, pantry
linkage, provenance display and backup — the four things V1 and V2 spent their whole budget
getting right once.

The need behind the proposal is real, though, and it is not met today. Nothing in the product
answers *"show me something sharp and spicy under 100 kcal"*, because `/ingredients` filters
by category and name, and `/recipes` filters by neither taste nor calories. That is a missing
**query**, not a missing section.

## Decision

### 1. One route, zero new entities

`/flavour` is a discovery surface over data that already exists. It stores nothing of its own.

```
Flavour Lab (/flavour)
├── filter: flavour tags, kcal ceiling, sodium, pack/common
├── browse ingredients ─────────> links to /ingredients/:id
├── "Build a mix" ──────────────> creates an ordinary Recipe
└── "Save as a snack" ──────────> creates an ordinary MealTemplate
```

It sits in the **secondary** nav beside Ingredients, Recipes and Meals — not the primary bar,
which carries the daily loop (Today, Plan, Shop, Log). Page width role `content`
([ADR-001](./001-page-geometry-and-density.md) R1.2).

Everything it creates is an ordinary entity that behaves identically whether it was made here
or in its own editor. A mix built in the Flavour Lab opens in the recipe editor; a snack saved
here appears in `/meals`; both back up, migrate and calculate through the existing paths.

### 2. The mapping, restated as a contract

| Concept | Entity | Status |
| --- | --- | --- |
| Flavouring | `Ingredient` | Shipped; gains tags (ADR-009) and spoon weights (ADR-008) |
| Seasoning mix or sauce | `Recipe` | Shipped; nutrition already derived from lines |
| Batch of sauce in the fridge | `Batch` + portions | Shipped, unchanged |
| Snack: base + mix | `MealTemplate` | Shipped in ticket 7, unchanged |
| Eating one | `PlannedMeal` / `LoggedMeal` | Shipped, unchanged |

**No recipe nesting** (decision 4). A snack is a `MealTemplate` with two components — the
cucumber as an `ingredient` entry and the chilli-garlic vinegar as a `recipeServings` entry —
which is precisely the case [ADR-004](./004-meal-templates-by-expansion.md) was designed for.
The brief's worked example needs no new code:

```
Chilli Garlic Vinegar   Recipe, 3 servings   30 ml rice vinegar · 2 g garlic powder
                                              1 g chilli flakes · 1 g MSG · 0.5 g salt
Chilli Garlic Cucumber  MealTemplate         200 g cucumber + 1 serving of the above
```

Nutrition for both falls out of `recipeTotal`, `recipePerServing` and the existing template
expansion. Nothing is duplicated, and correcting the vinegar's sodium corrects the snack.

### 3. `Recipe.kind` distinguishes a mix from a dish

```ts
type Recipe = {
  // … unchanged …
  kind: "dish" | "mix";   // V3 — display and filtering only
};
```

Defaults to `"dish"` on migration; set to `"mix"` when created from the Flavour Lab; editable
in the recipe form. **No derivation may read it**, guarded by the same invariance property test
as `source`/`common`, `PlanGroup`, `entryHint` and `flavourTags`.

A stored flag rather than a derivation, deliberately. The alternative considered was inferring
"this is a mix" from its lines — every non-optional line being a flavour-tagged ingredient —
which is derivable and needs no migration, but fails in a way the user cannot diagnose: a
yoghurt dressing drops out of their mixes list because nobody tagged yoghurt, and there is
nothing on screen explaining why. `common: boolean` set the precedent for this exact shape of
problem in ADR-002, and consistency with it is worth more than avoiding one boolean.

**Two values, not three.** Splitting `mix` from `sauce` was rejected: the distinction is
visible from the ingredients and the name, it buys one nav label, and it costs a taxonomy
argument at every save — a chilli oil, a wet rub, a dressing that thickens. Dry versus wet is
not a decision the data model needs to hold.

### 4. Sauce yield uses `servings`, and the limitation is stated

A sauce is a `Recipe`, and `Recipe` has `servings` but no yield quantity. So "I used 15 ml of
a 45 ml batch" is expressed as **servings = 3**, each serving being 15 ml by the author's
intent.

The app does not know that one serving is 15 ml. It is in the recipe name and notes, not in
the data. That is a real limitation and it is recorded here rather than worked around, because
the two available workarounds are both worse: a `yield` field on `Recipe` is a genuine model
change affecting scaling, batches and the cook flow, and inferring yield by summing line
quantities is wrong the moment anything reduces on the hob.

`Recipe.yield` is a **deferred extension**, not V3 scope. For a cold shaken dressing, which is
most of what this feature is for, servings-as-portions is accurate enough and needs no code.

### 5. What the lens does, concretely

- **Filter** ingredients by flavour tag (multi-select), kcal ceiling, sodium, and whether they
  are `common`. Results show kcal per 100 g, per tsp where
  [ADR-008](./008-kitchen-spoons-as-an-entry-time-conversion.md) gives a cited weight, sodium
  or "not known", and the derived `calorieDense` / `highSodium` markers from
  [ADR-009](./009-sensory-tags-and-derived-constraints.md).
- **Build a mix** — pick ingredients, set quantities, see running nutrition, save as a
  `Recipe` with `kind: "mix"`. The running total is `recipeTotal` on unsaved lines; no new
  calculation.
- **Save as a snack** — pair a mix with a base ingredient, save a `MealTemplate`.
- **Eat / log it** — the template applies to Today's snack slot through the flow ticket 9
  shipped, so a prepared snack can be logged when it is used.

The product framing (confirmed with the product owner for V3) is **prep and discovery**, not
an impulse race against opening a packet. The lab exists so that when a craving arrives, the
user already has low-calorie options built, can see what stock supports, and can log what they
liked. Logging from Today should stay ordinary product UX; it is not the headline success
criterion.

### 6. What it does not do

No pantry of its own — the pantry holds raw ingredients and that is unchanged (decision 13).
No favourites system — a saved mix is a recipe, and recipes are already listable. No separate
search index. No "health score" ranking of results (ADR-009 §6). No fourth stock system.

## Consequences

**Positive.** The feature costs one route, one boolean-shaped enum and a filter, because V1 and
V2 already built everything underneath it. A mix is a recipe, so it is instantly usable in
meal planning, shopping and insights without a line of integration code — which is the payoff
for decision 4's refusal to nest recipes and ADR-004's refusal to invent a `Meal` entity.

**Negative.** Users who expect a self-contained "lab" will find that saving a mix drops them
into the recipe editor. That is the correct behaviour and it needs copy that says so up front,
not a bespoke editor that hides it.

**Cost and risk.** The risk is drift: the first request after shipping will be a Flavour
Lab-specific field, then a Flavour Lab-specific list, and the tree in the brief reassembles
itself one commit at a time. The boundary to hold is this ADR's first sentence — the Flavour
Lab owns no entities. Anything that wants to be stored belongs on `Ingredient`, `Recipe` or
`MealTemplate`, or it does not belong.

## Verification

1. No new Dexie table. `/flavour` reads through existing repositories only.
2. A mix saved from the Flavour Lab opens and edits identically in `/recipes`, and carries
   `kind: "mix"`.
3. **Kind invariance** — every derived result is byte-identical with `kind` permuted across a
   corpus.
4. The brief's worked example end to end: build Chilli Garlic Vinegar at 3 servings, save
   Chilli Garlic Cucumber as a template with 200 g cucumber plus 1 serving, apply it to today's
   snack slot, and assert the logged nutrition equals cucumber + one third of the vinegar
   batch, with sodium propagated and no figure entered by hand.
5. Migration defaults every existing recipe to `kind: "dish"` and changes no other field.
6. Filtering by two tags returns the intersection, and an ingredient with unknown sodium is
   excluded from a sodium ceiling filter rather than treated as zero.
