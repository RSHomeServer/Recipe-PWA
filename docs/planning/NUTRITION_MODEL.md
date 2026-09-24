# Nutrition Model

How calories and macros are represented, calculated and attributed, per V1 decisions 3, 6,
20, 21, 22 and 23. Entities are in [DOMAIN_MODEL.md](./DOMAIN_MODEL.md); units in
[UNIT_MODEL.md](./UNIT_MODEL.md).

The governing rule: **nutrition is stored in exactly three places — on an `Ingredient`, in a
`Batch.snapshot`, and on a `customFood` log entry. Everywhere else it is computed**
(decisions 3, 6, 23). The first is reference data; the other two are historical provenance.
Recipe totals are never manually entered and never stored.

## Representation

```ts
type Nutrition = {
  kcal: number;            // kilocalories
  proteinG: number;        // grams
  carbsG: number;          // grams
  fatG: number;            // grams
  sodiumMg: number | null; // V3 — milligrams; null means unknown (ADR-007)
};
```

Decisions:

- **Four values in V1** (decision 21), with the record **extensible** to fibre, sugar,
  saturated fat and sodium (decision 1). Adding a nutrient is one key here plus one term in
  the summing helpers — no reshaping, because every function below is generic over the record.
  **V3 took that step for sodium** and proved the claim: `sum` and `scale` each gained one
  term, and nothing else in this document changed.
- **kcal is stored, not derived from macros.** Computing energy via Atwater factors (4/4/9
  kcal per gram) does not reconcile with real food labels once fibre, sugar alcohols and
  label rounding are involved, and users copy figures from labels. Store what the label says.
  Optionally *warn* when declared kcal deviates from the Atwater estimate by more than ~20%,
  as a data-entry sanity check — never silently correct it.
- **Grams for all macros.** No percentages stored; percentage-of-energy is computed at display
  time.
- No negative values. Zero is legal and common.
- `Nutrition` is a value object with no identity, freely summed and scaled.

### V3 — sodium, and why `null` is not zero

Salt is 0 kcal, and so is almost everything the Flavour Lab promotes. A calorie-only record
therefore reports a teaspoon of salt, a dash of fish sauce and a spoon of soy sauce as free, at
every quantity. [ADR-007](../adr/007-sodium-as-a-nullable-nutrient.md) closes that blind spot.

`sodiumMg` is nullable because three populations coexist in a real library: figures the dataset
publishes, figures it marks as unreliable, and figures nobody has entered. **`null` means
unknown; `0` means measured as none.** Conflating them repeats the mistake ADR-002 §2a caught
in the CoFID macro transcode, where mapping `N` to zero would have asserted the opposite of
what the source says.

The propagation rule:

```ts
sum:   any null contributor  →  null total     // absorbing
scale: null × f              →  null
ZERO = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 }
```

**The monoid survives.** An absorbing element breaks neither commutativity nor associativity,
and `ZERO.sodiumMg = 0` keeps `sum([]) = ZERO`, so `scale` still distributes over `sum`. The
property tests below extend over records containing nulls rather than being relaxed for them.

Display carries three states — known, partially known ("at least 480 mg · 2 of 7 items
unknown"), and unknown — and never renders `null` as `0 mg`. Salt-equivalent is derived where
it helps (`salt g ≈ sodium mg × 2.5 ÷ 1000`), never stored.

The ~2.4 g sodium (≈6 g salt) UK adult daily reference is shown as **context**, in the same
spirit as the calorie target: a denominator the user asked to see, not a budget the app
enforces.

### Reference basis

An `Ingredient` declares its nutrition against a fixed, intuitive basis implied by its
canonical unit (decision 3):

| Family | Nutrition is per | Canonical unit |
| --- | --- | --- |
| Weight | **100 g** | g |
| Volume | **100 ml** | ml |
| Count | **1 item** | item |

```ts
const basis = (kind: MeasureKind) => (kind === "count" ? 1 : 100);
```

A fixed basis rather than a per-ingredient reference amount is deliberate: every calculation
becomes one multiplication, there is no per-row basis to get wrong, and UK/EU labels are
already printed per 100 g / 100 ml. Internally everything normalises to the base unit
(decision 3); the 100-unit basis is the *entry and display* convention.

## Core scaling primitives

Three pure functions; everything else is built from them.

```ts
scale(n: Nutrition, f: number): Nutrition
  => { kcal: n.kcal * f, proteinG: n.proteinG * f, carbsG: n.carbsG * f, fatG: n.fatG * f,
       sodiumMg: n.sodiumMg === null ? null : n.sodiumMg * f }          // V3

sum(ns: Nutrition[]): Nutrition        // identity ZERO; sodiumMg is absorbing on null (V3)

nutritionOf(ingredient, q: CanonicalQuantity): Nutrition {
  assert(q.kind === ingredient.measureKind);
  return scale(ingredient.nutrition, q.amount / basis(ingredient.measureKind));
}
```

Worked example, using decision 3's figures — chicken at 120 kcal / 23 g protein / 0 g carbs /
2.6 g fat per 100 g. For 500 g the factor is `500 / 100 = 5`: 600 kcal, 115 g protein, 0 g
carbs, 13 g fat.

`(Nutrition, sum, ZERO)` is a commutative monoid and `scale` distributes over `sum`. That is
not pedantry: it means aggregation order never changes a total, which is what makes the
reconciliation invariant at the end of this document hold.

## Recipe nutrition

Derived on every read (decisions 6, 23). A recipe never stores calories.

```ts
recipeTotal(recipe, ingredientsById): Nutrition =
  sum(recipe.lines
        .filter(l => !l.optional)
        .map(l => nutritionOf(ingredientsById[l.ingredientId], l.quantity)))

recipePerServing(recipe, …): Nutrition = scale(recipeTotal(recipe, …), 1 / recipe.servings)

recipeBreakdown(recipe, …): { line, nutrition, shareOfKcal }[]
```

Worked example — decision 6's recipe at 4 servings:

| Line | Contribution | Share of kcal |
| --- | --- | --- |
| Chicken | 600 kcal | 45% |
| Rice | 450 kcal | 34% |
| Sauce | 200 kcal | 15% |
| Oil | 90 kcal | 7% |
| **Total** | **1340 kcal** | |
| **Per serving** | **335 kcal** | |

`recipeBreakdown` answers "where do this dish's calories come from". Rendering it well is the
most useful nutrition view in the product and **a core feature, not a detail** (decision 6).
It is the recipe-scoped version of the week-scoped attribution below.

**Optional lines** are excluded from headline totals so the figure matches the dish as
normally made. The UI labels totals as excluding optional lines, and the breakdown still lists
them with their contribution shown separately. Availability and shopping also ignore optional
lines ([DOMAIN_MODEL.md](./DOMAIN_MODEL.md)).

### Scaling

```ts
scaledLines(recipe, servings) = lines with quantity × (servings / recipe.servings)
```

Linear and dynamic (decision 5): 4 servings with 500 g chicken scaled to 8 servings is 1000 g.
Used by plan requirements, batch creation, and `recipeServings` entries. No yield curves, no
"reduce the salt when doubling".

## Batch and portion nutrition

**A Batch carries a frozen snapshot captured at cook time, and that snapshot is the only
source of its nutrition.** Nothing recomputes a batch from the live recipe.

```ts
batchNutrition(batch)          = batch.snapshot.total
portionNutrition(batch)        = batch.snapshot.total / batch.portionsNominal
portionsNutrition(batch, p)    = batch.snapshot.total × (p / batch.portionsNominal)
```

Note what these signatures do **not** take: no recipe, no ingredient map, no scale factor. A
batch is nutritionally self-contained, which is both the correctness guarantee and a
convenience — insights over a year of logs need no recipe lookups.

At creation, the snapshot is built once from the quantities actually used:

```ts
createSnapshot(recipe, ingredients, actualLines): BatchSnapshot {
  const lines = actualLines.map(l => {
    const ing = ingredients[l.ingredientId];
    return { ingredientId: ing.id, ingredientName: ing.name,
             quantity: l.quantity, nutrition: nutritionOf(ing, l.quantity) };
  });
  return { recipeName: recipe.name, lines, total: sum(lines.map(l => l.nutrition)) };
}
```

`actualLines` is seeded from `scaledLines(recipe, recipe.servings × scale)` and is editable in
the cook flow, so 500 g of recipe chicken cooked as 550 g stores 550 g and the nutrition to
match.

Worked example — the 1340 kcal recipe cooked at 2× into 8 portions: snapshot total 2680 kcal,
portion 335 kcal; logging 1.5 portions records 502.5 kcal. Because `p` is a real number,
fractional portions need no special handling (decision 8).

Note the deliberate distinction between `recipePerServing` (a property of the definition,
always current) and `portionNutrition` (a property of a batch's division into helpings, frozen
at cook time). They are often equal. They are not the same thing, and after a recipe edit they
will differ — correctly.

**History is immutable.** Editing a recipe or correcting an ingredient's nutrition changes
future recipe totals and future batches, and changes **nothing** about batches already cooked
or logs already recorded. A week you reviewed in March still reads the same in April. This is
the guarantee that makes historical attribution (decisions 21, 22) worth trusting, and it is
why `snapshot` is written once and never updated.

**Cooked weight is not modelled** (decisions 7, 24). This is nutritionally sound regardless:
cooking changes weight (rice absorbs water, sauces reduce) but not nutrition, because water
carries no calories. Nutrition always comes from the ingredients as added — which is exactly
what the snapshot records — so no cooked-weight data is needed for correctness.

## Meal entry nutrition

One function resolves any entry — planned or logged.

```ts
entryNutrition(entry, ctx): Nutrition {
  switch (entry.kind) {
    case "recipeServings":
      return scale(recipeTotal(ctx.recipe(entry.recipeId), ctx.ingredients),
                   entry.servings / ctx.recipe(entry.recipeId).servings);
    case "batchPortions":
      return portionsNutrition(ctx.batch(entry.batchId), entry.portions);   // from the snapshot
    case "ingredient":
      return nutritionOf(ctx.ingredient(entry.ingredientId),
                         toCanonical(entry.quantity, ctx.ingredient(entry.ingredientId)));
    case "customFood":
      return scale(entry.food.nutrition, entry.food.quantity);
  }
}
```

Because planning and logging share `MealEntry` (decisions 14–15), planned-day and logged-day
nutrition come from the same function and are directly comparable — so planned-versus-actual
is later a formatting exercise, not a new model.

`customFood` nutrition is the figures the user entered multiplied by `quantity`
(decision 17) — so "one 250 kcal wrap × 2" records 500 kcal.

## Attribution — "where did my calories come from?"

The headline capability (decisions 21, 22), and the thing no reference product does across a
week. It rests on one expansion function taking a logged meal down to ingredient-level
contributions.

```ts
expand(log, ctx): Contribution[] {
  const at = { logId: log.id, date: log.date, slotId: log.slotId };

  switch (log.entry.kind) {
    // A recipe eaten directly: attribute the CURRENT recipe lines, scaled to servings eaten.
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

    // A portion of a batch: the FROZEN snapshot lines, scaled to the portion share.
    // No recipe lookup, no ingredient lookup — the snapshot already holds both.
    case "batchPortions": {
      const b = ctx.batch(log.entry.batchId);
      const f = log.entry.portions / b.portionsNominal;
      return b.snapshot.lines.map(l => ({
        ingredientId: l.ingredientId,
        ingredientName: l.ingredientName,
        quantity: { ...l.quantity, amount: l.quantity.amount * f },
        nutrition: scale(l.nutrition, f),
        source: { ...at, recipeId: b.recipeId, batchId: b.id },
      }));
    }

    // A plain food: one contribution, itself.
    case "ingredient": { … }

    // Eating out: honestly unattributable.
    case "customFood":
      return [{ ingredientId: null, ingredientName: log.entry.food.name, quantity: null,
                nutrition: scale(log.entry.food.nutrition, log.entry.food.quantity),
                source: { ...at, recipeId: null, batchId: null } }];
  }
}
```

The two recipe-derived cases are deliberately asymmetric, and the asymmetry is the model
working as intended:

- `recipeServings` reads the **live recipe**, because it records "I ate this dish" without a
  tracked cooking event. There is no frozen record to read, so it reflects the recipe's current
  definition. Users choosing this path are accepting an approximation.
- `batchPortions` reads the **snapshot**, because a batch *is* the record of what happened. It
  needs no recipe and no ingredient lookup, and no later edit can move it.

`snapshot.lines` retain `ingredientId`, so a batch's calories still group under the same
ingredient as everything else in the attribution folds, while `ingredientName` keeps the
snapshot readable if that ingredient is later renamed or archived. Optional lines were already
resolved when the snapshot was written, so there is no filtering to repeat here.

### Every insight is a fold

```ts
const cs = logs.flatMap(l => expand(l, ctx));   // Contribution[] for the period

byDay        = groupSum(cs, c => c.source.date);          // calories by day (decision 22)
byMeal       = groupSum(cs, c => c.source.slotId);        // calories by meal
byRecipe     = groupSum(cs, c => c.source.recipeId ?? "__none__");
byIngredient = groupSum(cs, c => c.ingredientId ?? "__unattributed__");
weekTotals   = groupSum(cs, c => isoWeek(c.source.date));
```

Daily and weekly totals plus macro totals and averages (decision 21) all come from these
folds. **Weekly average is `weeklyTotal / daysWithAnyLog`, not `/ 7`** — dividing by seven
makes a partially logged week look like undereating, the most common way calorie dashboards
mislead. Show the divisor.

Weekly ingredient contribution produces exactly decision 22's example shape: chicken 2700
kcal, rice 2200 kcal, and so on, descending.

**`customFood` is never hidden.** It lands in an explicit unattributed bucket that charts must
render, so the ingredient breakdown is honest about how much of the week it cannot explain.

## Calorie target

Optional and manually entered (decision 20), read from `Settings`. Purely presentational — no
calculation depends on it, and every view must work without one.

```ts
remaining(target, consumedKcal) = target - consumedKcal;   // may be negative
```

Reported as three plain figures — target, consumed, remaining — per decision 20's example
(2400 / 1840 / 560). Explicitly **not** implemented: BMR, TDEE, activity multipliers,
automatic weight-loss targets, weight projections (decisions 20, 24). Macro targets are a
later addition: nullable fields on `Settings`, no calculation change.

Going over target is a neutral fact. It is displayed without colour-coded pass/fail,
congratulation or warning — see [DESIGN.md](./DESIGN.md) for the restrained presentation this
requires.

## Rounding and precision

**Compute in full precision. Round only at display.** Never round an intermediate, never
store a rounded value and calculate from it (decision 3).

Display rules, matching decision 3's examples:

| Value | Rule | Example |
| --- | --- | --- |
| Calories | Integer | `523.7 → 524 kcal` |
| Macros (g) | 1 decimal place | `42.37 → 42.4 g` |
| Percentages | Integer | `45%` |
| Quantities | Per [UNIT_MODEL.md](./UNIT_MODEL.md) | `1200 g → 1.2 kg` |

Consequences to accept rather than hide:

- Rounded parts will not always sum to the rounded whole. Four 335.25 kcal portions display
  as 335 each but total 1341. **Display the true total**; never fudge parts to reconcile. Where
  a view shows both, the total is authoritative.
- Formatting lives in **one shared formatter**, so the rule exists in one place and no
  component invents its own rounding.
- Percent-of-energy is presentation-only:
  `pct = macroG × kcalPerGram / kcal`, using 4/4/9 for protein/carbs/fat, guarded against
  `kcal === 0`. Because stored kcal comes from labels, these will not always total exactly
  100% — display them as approximate rather than normalising to hide the discrepancy.

## Testable properties

The calculation core is pure, with no React or storage dependency, so these are cheap Vitest
properties and belong with the first nutrition ticket (decision 23,
[ARCHITECTURE.md](./ARCHITECTURE.md)):

1. `sum` is commutative and associative; `ZERO` is its identity.
2. `scale(sum(xs), f) === sum(xs.map(x => scale(x, f)))` within tolerance.
3. `recipeTotal === sum(recipeBreakdown().nutrition)` — the breakdown always explains the
   total, and `shareOfKcal` sums to 100% within rounding.
4. `portionsNutrition(b, b.portionsNominal) === b.snapshot.total`.
5. `snapshot.total === sum(snapshot.lines.map(l => l.nutrition))` for every batch ever written.
6. **History immutability — the highest-value test in the repo.** Create a batch, log portions,
   then edit the source recipe's quantities and an ingredient's nutrition. Assert the batch's
   snapshot, every `expand()` result for those logs, and every insight over that period are
   **byte-identical** to before the edit.
7. A snapshot built from edited quantities reports those quantities, not the recipe's — cook a
   500 g recipe with 550 g and assert the snapshot and its nutrition reflect 550 g.
8. **Reconciliation:** over any period,
   `Σ byMeal = Σ byRecipe = Σ byIngredient (incl. unattributed) = Σ byDay`.
9. `expand()` on a `batchPortions` log and on the equivalent `recipeServings` log produce the
   same per-ingredient contributions **when the snapshot matches the recipe** — that is, before
   any edit and with scale and servings aligned. After an edit they must legitimately differ.
10. `nutritionOf(ing, { amount: 0 }) === ZERO`; scaling by zero servings or portions yields
    `ZERO`.
11. Display rounding is stable: formatting the same value twice gives the same string, and no
    formatter emits more precision than the table above allows.
12. Weekly average divides by days with logs, not by 7.

## Extension points

| Later capability | Change needed |
| --- | --- |
| ~~Sodium~~ | **Done in V3** ([ADR-007](../adr/007-sodium-as-a-nullable-nutrient.md)) — one key, one term in each helper, nullable for "unknown" |
| Fibre, sugar, saturated fat | Add keys to `Nutrition`; `sum`/`scale` are already generic (decision 1). Follow sodium's precedent and make any figure the datasets report unreliably nullable rather than zero |
| Micronutrients | Same, or a `micros: Record<string, number>` companion |
| Macro targets | Nullable fields on `Settings`; no calculation change (decision 20) |
| External food database | Populates `Ingredient.nutrition` plus a provenance field; calculations untouched (decision 1) |
| Reusable custom foods / barcode | `CustomFood` becomes a stored `Food` entity; `expand()` gains one case (decision 17) |
