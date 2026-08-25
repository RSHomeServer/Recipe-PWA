# Unit Model

Units, quantities, comparison and formatting, per V1 decision 2. Entities are in
[DOMAIN_MODEL.md](./DOMAIN_MODEL.md); nutrition scaling in
[NUTRITION_MODEL.md](./NUTRITION_MODEL.md).

Two governing rules:

1. **Every stored quantity is normalised to its ingredient's canonical unit.** Conversion
   happens once, where the user types a number. Nothing downstream — availability,
   requirements, shopping subtraction, nutrition, attribution — ever converts.
2. **V1 converts only within a unit family.** There are no ingredient-specific conversion
   tables, so no density and no per-item weights (decision 2). Every conversion in the app is
   a fixed scalar factor.

## Supported units

| Family | Units | Canonical | Factor |
| --- | --- | --- | --- |
| Weight (`mass`) | g, kg | **g** | `kg → g` × 1000 |
| Volume (`volume`) | ml, L | **ml** | `L → ml` × 1000 |
| Count (`count`) | item | **item** | — |

```ts
type MeasureKind = "mass" | "volume" | "count";
type Unit = "g" | "kg" | "ml" | "L" | "item";

const UNITS = {
  g:    { kind: "mass",   toCanonical: 1,    label: "g"  },
  kg:   { kind: "mass",   toCanonical: 1000, label: "kg" },
  ml:   { kind: "volume", toCanonical: 1,    label: "ml" },
  L:    { kind: "volume", toCanonical: 1000, label: "L"  },
  item: { kind: "count",  toCanonical: 1,    label: "×"  },
} as const;
```

**Explicitly excluded from V1** (decision 2): tablespoon, teaspoon, cup, handful, pinch,
slice, and every other ingredient-relative measure. Also excluded: imperial units (oz, lb,
fl oz). These are all additive later — see [Extension points](#extension-points) — but the
spoon-and-cup family is deliberately harder than it looks and is not a units problem.

## Quantity representation

```ts
/** What the user typed. Input boundaries and display only. Never stored alone. */
type Quantity = { value: number; unit: Unit };            // { value: 1.2, unit: "kg" }

/** Normalised. Persisted, compared and summed. */
type CanonicalQuantity = { amount: number; kind: MeasureKind };   // { amount: 1200, kind: "mass" }
```

Persisted records store `CanonicalQuantity`. Where the entry unit matters for display —
recipe lines especially, because "1.2 kg chicken" should not read back as "1200 g" — the
entity keeps a separate `displayUnit` alongside the canonical amount
(`RecipeLine.displayUnit`). The canonical amount is the truth; the display unit is a
formatting preference.

Amounts are plain `number` (IEEE 754 double). At the magnitudes here — grams and millilitres,
rarely above 10⁵ — doubles carry far more precision than food data has accuracy, so a decimal
or integer-scaled representation would add complexity for no benefit. The consequence is
handled explicitly by the [tolerance rule](#comparison-and-tolerance) rather than by
pretending the arithmetic is exact.

## One canonical unit per ingredient

Each `Ingredient` declares a single `measureKind`, immutable once referenced. Everything about
that ingredient — nutrition basis, pantry stock, recipe lines, plan requirements, shopping
lines — lives in that one family.

Worked examples from decision 2:

| Ingredient | Canonical | Input / display units |
| --- | --- | --- |
| Chicken | g | g, kg |
| Milk | ml | ml, L |
| Egg | item | item |

This is the decision that removes almost all unit complexity:

- Pantry stock and recipe requirements for an ingredient are always the same family, so
  `required <= available` is a plain numeric comparison.
- Shopping subtraction is plain arithmetic.
- Nutrition is one multiplication against a fixed basis.
- No stored quantity can be ambiguous about what it measures.

Choosing the family: `mass` for anything bought and cooked by weight (meat, rice, flour,
vegetables), `volume` for liquids measured by volume (milk, stock), `count` for discrete items
(eggs, tortillas, tins). When in doubt, `mass` — it is the most accurate nutrition basis and
the one food labels use.

## No cross-family conversion in V1

A quantity may only be entered in a unit belonging to the ingredient's own family. Entering
250 ml against an ingredient stored in grams is a **validation error**, not a conversion:

```ts
type Validated =
  | { ok: true;  canonical: CanonicalQuantity }
  | { ok: false; reason: "wrongFamily"; expected: MeasureKind; allowed: Unit[] };

toCanonical(q: Quantity, ingredient: Ingredient): Validated
```

Returning a result rather than throwing is deliberate: the wrong-family case is a normal
user-facing state, so the unit picker should only ever offer units from the ingredient's own
family and this becomes unreachable in the UI. The check exists to keep imported or migrated
data honest.

**What this costs, and the workaround.** If you want to record milk both by volume (1 L in the
pantry) and by weight (500 g in a recipe), V1 cannot convert between them. Pick the family
that matches how you actually buy and cook the ingredient, and use it consistently. In the rare
case where both are genuinely needed, create two ingredients. This is a real limitation and it
is the right V1 trade-off: per-ingredient density and item-weight data is exactly the
"arbitrary ingredient-specific conversion table" decision 2 excludes, and getting it wrong
silently corrupts every downstream number.

## Display formatting

Canonical storage, human-readable output, in one shared formatter so no component invents its
own rule.

| Canonical | Displayed | Rule |
| --- | --- | --- |
| 1200 g | `1.2 kg` | mass ≥ 1000 g → kg, up to 2 dp |
| 850 g | `850 g` | below 1000 g → g, integer |
| 12.5 g | `12.5 g` | below 100 g → up to 1 dp |
| 1650 ml | `1.65 L` | volume ≥ 1000 ml → L, up to 2 dp |
| 250 ml | `250 ml` | below 1000 ml → ml, integer |
| 3 item | `3` / `3 eggs` | integer where possible |
| 0.5 item | `½` or `0.5` | fractions are legal for count |

Two exceptions to automatic promotion:

1. **A recipe line uses its recorded `displayUnit`**, so the recipe reads as written.
2. **Aligned numeric columns** (pantry, shopping, nutrition tables) use one consistent unit
   per column rather than mixing `1.2 kg` and `850 g` in the same column — with tabular
   figures, per [DESIGN.md](./DESIGN.md).

Fractional counts are allowed (half an avocado) and must not be silently rounded to integers.

## Comparison and tolerance

Availability and shopping both compare floats. One rule, applied everywhere:

```ts
const EPSILON = { mass: 1e-4, volume: 1e-4, count: 1e-6 };   // canonical units

isShort(required, available, kind)  => required - available >  EPSILON[kind];
isEnough(required, available, kind) => required - available <= EPSILON[kind];
isZero(amount, kind)                => Math.abs(amount)    <= EPSILON[kind];
```

The tolerance absorbs floating-point residue from scaling — 0.1 g of accumulated error must
not make a recipe unmakeable. It is deliberately far below any amount a user would notice, and
it is **not** a model of real-world slack.

Real-world leniency is a separate, presentational concern. Decision 11 asks for useful
availability *states*, and decision 10 warns against rigid inventory behaviour — so leniency
lives in the [availability classification](./DOMAIN_MODEL.md) (how many ingredients are short),
which is visible and tunable, not in a fuzzy epsilon that would quietly distort the
arithmetic.

Shopping lines apply `max(0, required − available)` then drop lines where `isZero(toBuy)`, so
a 0.00001 g shortfall never appears on a list.

## Aggregation

```ts
sumQuantities(qs: CanonicalQuantity[]): CanonicalQuantity {
  assert(allSameKind(qs));           // a genuine programming error if violated
  return { amount: qs.reduce((a, q) => a + q.amount, 0), kind: qs[0].kind };
}
```

Because each ingredient has exactly one family, aggregation is always grouped by
`ingredientId` first and mixed-family sums are unreachable in correct code. The assertion
exists to fail loudly in tests if that stops being true.

Summation order varies (a plan aggregates by date, a shopping list by category). Float
addition is not associative, so totals may differ in the last bits — display rounding and
`EPSILON` absorb it. **Do not assert exact float equality on aggregates in tests**; assert
within tolerance.

## Validation rules

Enforced by Zod schemas at every boundary:

1. `Quantity.value` is finite and `>= 0`. Negative user input is a validation error.
2. `Unit` is a known key of `UNITS`.
3. `CanonicalQuantity.kind` equals the referenced ingredient's `measureKind` on every entity
   carrying one — the single most valuable schema assertion in the app.
4. A `Quantity`'s unit family must match the ingredient's family (no cross-family entry).
5. `Recipe.servings > 0`, `Batch.portionsNominal > 0`, `Batch.scale > 0`.
6. `PantryStock.quantity.amount` **may** be negative — records and reality are allowed to
   disagree (decision 12); it is surfaced, not blocked.
7. Quantities are not capped, but implausible values (> 100 kg in a recipe line) should warn
   rather than block — almost always a mistyped unit.

## Testable properties

Pure functions, no UI, no storage — the first tier in
[ARCHITECTURE.md](./ARCHITECTURE.md)'s testing table:

1. `toCanonical` round-trips within tolerance for every in-family unit pair
   (`1.2 kg → 1200 g → 1.2 kg`).
2. `toCanonical` returns `ok: false` with `reason: "wrongFamily"` for any cross-family entry —
   never a thrown error, never a fabricated number.
3. `format(toCanonical(q))` is stable and never shows more precision than the rules allow.
4. `isShort` and `isEnough` are exact complements at and around the tolerance boundary.
5. `sumQuantities` is commutative within tolerance and returns zero for an empty list.
6. Scaling a recipe by `n` then by `1/n` returns the original quantities within tolerance.
7. Fractional counts survive storage and display without being rounded to integers.
8. Negative pantry quantities format correctly and are never clamped in the data layer.

## Extension points

| Later capability | Change needed |
| --- | --- |
| oz, lb, fl oz, pt | One row each in `UNITS`; scalar factors only. No model change. |
| Metric/imperial display toggle | A display preference read by the formatter. Canonical storage unaffected. |
| Per-ingredient preferred display unit | A field on `Ingredient`; the formatter already accepts an override. |
| Cups, tbsp, tsp, slices | Needs per-ingredient volume→mass or item→mass data — the conversion table decision 2 excludes. Treat as a **separate feature with its own decision**, not a units addition, and mark results approximate. |
| Cross-family conversion (ml ↔ g) | Same as above: reintroduces `densityGPerMl` / `gramsPerItem` on `Ingredient`. Additive, but requires the decision to be revisited. |
| Package sizes ("2 × 500 g packs") | A `packSize` on `Ingredient`, applied when rendering shopping lines. Requirements stay canonical. Explicitly out of scope for V1 (decision 19). |

Every row has the same shape: entry and display gain options, canonical storage never changes.
That is the property this model exists to preserve.
