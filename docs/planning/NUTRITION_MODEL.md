# Nutrition Model

How calories and macros are represented, calculated, and attributed. Entities and their
invariants are in [DOMAIN_MODEL.md](./DOMAIN_MODEL.md); units and conversion in
[UNIT_MODEL.md](./UNIT_MODEL.md).

The governing rule: **nutrition is stored in exactly two places — on an `Ingredient`, and
inside a `Batch.snapshot`. Everywhere else it is computed.** Every figure the UI shows is
either one of those two, or the output of a pure function over them.

## Representation

```ts
type Nutrition = {
  kcal: number;        // kilocalories
  proteinG: number;    // grams
  carbsG: number;      // grams
  fatG: number;        // grams
};
```

Decisions:

- **Four values only** in v1: energy plus the three macros the brief names. Fibre, sugar,
  saturates, salt and micronutrients are later additions — adding a key to this record and a
  term to the summing helpers, nothing more.
- **kcal is stored, not derived.** It is tempting to compute energy from macros via Atwater
  factors (4/4/9 kcal per gram), but real food labels do not reconcile with that arithmetic
  (fibre, sugar alcohols, rounding), and users copy figures from labels. Store what the
  label says. Optionally *warn* when the declared kcal deviates from the Atwater estimate by
  more than ~20%, as a data-entry sanity check — never silently correct it.
- **Grams for all macros**, always. No percentages stored; percentage-of-energy is a
  presentation concern computed at display time.
- **No negative values.** Zero is legal and common (water, most spices).
- `Nutrition` is a value object with no identity, freely summed and scaled.

### Reference basis

An `Ingredient` declares its nutrition against a fixed basis implied by its `measureKind`:

| `measureKind` | Nutrition is per | Canonical unit |
| --- | --- | --- |
| `mass` | **100 g** | g |
| `volume` | **100 ml** | ml |
| `count` | **1 item** | item |

A fixed basis rather than a per-ingredient "reference amount" field is deliberate: every
calculation becomes one multiplication, there is no per-row basis to get wrong, and food
labels are already per 100 g / 100 ml in the UK and EU.

```ts
const basis = (kind: MeasureKind) => (kind === "count" ? 1 : 100);
```

## Core scaling primitives

Three pure functions, and everything else is built from them.

```ts
/** Scale a nutrition record by a factor. */
scale(n: Nutrition, f: number): Nutrition
  => { kcal: n.kcal * f, proteinG: n.proteinG * f, carbsG: n.carbsG * f, fatG: n.fatG * f }

/** Sum any number of nutrition records. */
sum(ns: Nutrition[]): Nutrition        // identity: ZERO = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }

/** Nutrition of a canonical quantity of one ingredient. */
nutritionOf(ingredient, q: CanonicalQuantity): Nutrition {
  assert(q.kind === ingredient.measureKind);
  return scale(ingredient.nutrition, q.amount / basis(ingredient.measureKind));
}
```

Worked example — 500 g chicken breast at 165 kcal / 31 g protein / 0 g carbs / 3.6 g fat per
100 g: factor `500 / 100 = 5` → 825 kcal, 155 g protein, 0 g carbs, 18 g fat.

`(Nutrition, sum, ZERO)` forms a commutative monoid, and `scale` distributes over `sum`.
That is not pedantry: it means aggregation order never changes a total, which is what makes
the reconciliation invariant at the end of this document testable.

## Recipe nutrition

Derived on every read. A recipe never stores calories.

```ts
recipeTotal(recipe, ingredientsById): Nutrition =
  sum(recipe.lines
        .filter(l => !l.optional)                       // see note below
        .map(l => nutritionOf(ingredientsById[l.ingredientId], l.quantity)))

recipePerServing(recipe, …): Nutrition = scale(recipeTotal(recipe, …), 1 / recipe.servings)

recipeBreakdown(recipe, …): { line, nutrition, shareOfKcal }[]   // the ingredient-level view
```

Worked example — Chicken Curry, 4 servings:

| Line | Amount | Per 100 g | Contribution |
| --- | --- | --- | --- |
| Chicken breast | 500 g | 165 kcal | 825 kcal |
| Rice (dry) | 300 g | 360 kcal | 1080 kcal |
| Curry sauce | 200 g | 90 kcal | 180 kcal |
| Oil | 10 g | 884 kcal | 88 kcal |
| **Total** | | | **2173 kcal** |
| **Per serving** | | | **543 kcal** |

The breakdown answers "where do this dish's calories come from": rice 50%, chicken 38%,
sauce 8%, oil 4%. Rendering this well is the single most useful nutrition view in the
product, and it is the recipe-scoped version of the week-scoped Insights attribution.

**Optional lines** are excluded from the recipe's headline totals so the number matches the
dish as normally made. The UI must label totals as excluding optional lines, and the
breakdown should still list them with their contribution shown separately. (Availability and
shopping already ignore optional lines — DOMAIN_MODEL.md.)

### Scaling a recipe

```ts
scaledLines(recipe, servings) = recipe.lines.map(l => ({
  ...l,
  quantity: { ...l.quantity, amount: l.quantity.amount * (servings / recipe.servings) },
}))
```

Used by plan requirements, by the cook-a-batch flow, and by `recipeServings` meal entries.
Scaling is strictly linear — no yield curves, no "reduce the salt when doubling".

## Batch nutrition — the freeze

Cooking a recipe computes its nutrition once and stores it, because history must not change
when a recipe is later edited.

```ts
createBatch(recipe, ingredientsById, actualLines, portionsTotal): Batch {
  const lines = actualLines.map(l => ({
    ingredientId:   l.ingredientId,
    ingredientName: ingredientsById[l.ingredientId].name,   // denormalised, durable
    quantity:       l.quantity,                             // what was ACTUALLY used
    nutrition:      nutritionOf(ingredientsById[l.ingredientId], l.quantity),
  }));
  return { …, snapshot: { recipeName: recipe.name, lines, total: sum(lines.map(l => l.nutrition)) } };
}
```

- `actualLines` defaults to the recipe's lines scaled to the batch size, and is **editable at
  cook time** — you used 550 g of chicken, not 500 g. Deviation is captured where it happens.
- After creation the snapshot is immutable. Correcting a batch means voiding and re-creating.
- Ingredient names are denormalised into the snapshot so a batch cooked in March still reads
  correctly after the ingredient is renamed or archived.

### Portion nutrition

```ts
portionNutrition(batch)          = scale(batch.snapshot.total, 1 / batch.portionsTotal)
portionsNutrition(batch, p)      = scale(batch.snapshot.total, p / batch.portionsTotal)
```

Worked example — the curry above cooked as one batch divided into 4 portions: 543 kcal per
portion; logging 1.5 portions records 815 kcal. Because `p` is a real number, half and
one-and-a-half portions need no special handling anywhere.

Note the deliberate difference between `recipePerServing` (a property of the definition,
which moves when the recipe is edited) and `portionNutrition` (a property of a past event,
which never moves). They will often be equal. They are not the same thing.

### Cooked weight and yield loss

Cooking changes weight — 300 g of dry rice absorbs water, a sauce reduces. Nutrition,
however, is conserved (water carries no calories), so **nutrition is always computed from
the ingredients as added**, never from the cooked weight. This is correct and needs no
cooked-weight data.

`Recipe.cookedWeightG` is therefore optional and used only for *portioning by weight*:
knowing the batch weighed 1400 g lets the UI say "each portion is about 350 g", which is
genuinely useful when dividing into containers. It never enters a nutrition calculation.
Weight-based portioning as an alternative to portion counts is deferred, not v1.

## Meal entry nutrition

One function resolves any entry — planned or logged — to a nutrition figure.

```ts
entryNutrition(entry, ctx): Nutrition {
  switch (entry.kind) {
    case "recipeServings": return scale(recipeTotal(ctx.recipe(entry.recipeId), ctx.ingredients),
                                        entry.servings / ctx.recipe(entry.recipeId).servings);
    case "batchPortions":  return portionsNutrition(ctx.batch(entry.batchId), entry.portions);
    case "ingredient":     return nutritionOf(ctx.ingredient(entry.ingredientId),
                                              toCanonical(entry.quantity, ctx.ingredient(entry.ingredientId)));
    case "quickAdd":       return entry.nutrition;
  }
}
```

Because planning and logging share `MealEntry`, planned-day nutrition and logged-day
nutrition come from the same function and are directly comparable — which is what makes
"planned vs actual" a later formatting exercise rather than a new model.

## Attribution — "where did my calories come from?"

The headline insight, and the thing no reference product does across a week. It rests on one
expansion function that takes a logged meal down to ingredient-level contributions.

```ts
expand(log, ctx): Contribution[] {
  const at = { logId: log.id, date: log.date, slot: log.slot };

  switch (log.entry.kind) {
    // A recipe eaten directly: attribute each line, scaled to servings eaten.
    case "recipeServings": {
      const r = ctx.recipe(log.entry.recipeId);
      const f = log.entry.servings / r.servings;
      return r.lines.filter(l => !l.optional).map(l => {
        const ing = ctx.ingredient(l.ingredientId);
        const q   = { ...l.quantity, amount: l.quantity.amount * f };
        return { ingredientId: ing.id, ingredientName: ing.name, quantity: q,
                 nutrition: nutritionOf(ing, q),
                 source: { ...at, recipeId: r.id, batchId: null } };
      });
    }

    // A portion of a batch: attribute from the FROZEN SNAPSHOT, not the live recipe.
    case "batchPortions": {
      const b = ctx.batch(log.entry.batchId);
      const f = log.entry.portions / b.portionsTotal;
      return b.snapshot.lines.map(l => ({
        ingredientId: l.ingredientId, ingredientName: l.ingredientName,
        quantity: { ...l.quantity, amount: l.quantity.amount * f },
        nutrition: scale(l.nutrition, f),
        source: { ...at, recipeId: b.recipeId, batchId: b.id },
      }));
    }

    // A plain food: one contribution, itself.
    case "ingredient": { … }

    // Eating out: honestly unattributable.
    case "quickAdd":
      return [{ ingredientId: null, ingredientName: log.entry.label, quantity: null,
                nutrition: log.entry.nutrition,
                source: { ...at, recipeId: null, batchId: null } }];
  }
}
```

The `batchPortions` case is the reason Batch snapshots exist. Attribution for a meal eaten in
March must reflect what actually went into that pot in March, even if the recipe has since
been edited or an ingredient's nutrition corrected.

### Every insight is a fold

```ts
const cs = logs.flatMap(l => expand(l, ctx));   // Contribution[] for the period

dailyTotals     = groupSum(cs, c => c.source.date);
weeklyTotals    = groupSum(cs, c => isoWeek(c.source.date));
byMealSlot      = groupSum(cs, c => c.source.slot);
byRecipe        = groupSum(cs, c => c.source.recipeId ?? "__none__");
byIngredient    = groupSum(cs, c => c.ingredientId ?? "__unattributed__");
```

Daily average over a week is `weeklyTotal / daysWithAnyLog` — not `/ 7`. Dividing by 7 makes
a partially logged week look like undereating, which is the most common way calorie
dashboards mislead. Show the divisor.

**`quickAdd` is never hidden.** It lands in an explicit "unattributed" bucket that charts
must render (typically a neutral grey slice) so the ingredient breakdown is honest about how
much of the week it cannot explain.

## Rounding and precision

- **Compute in full precision. Round only at the moment of display.** Never round an
  intermediate, never store a rounded value and calculate from it.
- Display defaults: `kcal` → integer; macros → 1 decimal place below 10 g, otherwise
  integer. Percentages → integer.
- Rounded parts will not always sum to the rounded whole (four 543.25 kcal portions display
  as 543 each but total 2173). Display the true total; do not force parts to reconcile by
  fudging. Where a chart shows both, label the total as the authoritative figure.
- Use `toFixed`-style formatting in one shared formatter, so the rule lives in one place and
  the UI cannot invent its own rounding.
- Percent-of-energy is presentation-only:
  `pct = macroG × kcalPerGram / kcal`, with 4/4/9 kcal per gram for protein/carbs/fat, and
  guarded against `kcal === 0`. Because stored kcal comes from labels, these percentages
  will not always sum to exactly 100% — display them as approximate rather than normalising
  them to hide the discrepancy.

## Testable properties

The calculation core is pure and has no React or storage dependency, so these are cheap
Vitest properties and should exist from the first nutrition ticket
([ARCHITECTURE.md](./ARCHITECTURE.md)):

1. `sum` is commutative and associative; `ZERO` is its identity.
2. `scale(sum(xs), f) === sum(xs.map(x => scale(x, f)))` within tolerance.
3. `recipeTotal === sum(recipeBreakdown().nutrition)` — the breakdown always explains the
   total.
4. `sum(portionsNutrition(b, 1) × portionsTotal) === b.snapshot.total`.
5. `batch.snapshot.total === sum(batch.snapshot.lines.nutrition)` for every batch.
6. Editing a recipe or an ingredient's nutrition does not change any existing
   `Batch.snapshot`, nor any insight computed from `batchPortions` logs. **The history
   regression test.**
7. **Reconciliation:** over any period,
   `Σ byMealSlot = Σ byRecipe = Σ byIngredient (incl. unattributed) = Σ dailyTotals`.
8. `nutritionOf(ing, { amount: 0 }) === ZERO`; scaling by zero servings/portions yields
   `ZERO`.

## Extension points (no rework required)

| Later capability | Change needed |
| --- | --- |
| Fibre, sugar, saturates, salt | Add keys to `Nutrition`; `sum`/`scale` are generic over them. |
| Micronutrients | Same, or a `micros: Record<string, number>` companion. |
| Nutrition targets / goals | New `Goal` entity read alongside insights; no calculation change. |
| External food database | Populates `Ingredient.nutrition` plus a provenance field. Calculations untouched. |
| Per-100 g cooked-basis nutrition | Uses the existing `cookedWeightG`; still never feeds totals. |
