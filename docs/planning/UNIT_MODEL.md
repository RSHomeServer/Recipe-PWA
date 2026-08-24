# Unit Model

Units, quantities, conversion, and comparison. Entities are in
[DOMAIN_MODEL.md](./DOMAIN_MODEL.md); nutrition scaling in
[NUTRITION_MODEL.md](./NUTRITION_MODEL.md).

The governing rule: **every stored quantity is already normalised to its ingredient's
canonical unit.** Conversion happens once, at the boundary where the user types a number.
Nothing downstream — availability, requirements, shopping subtraction, nutrition,
attribution — ever converts or compares across units.

## Supported units

| Measure kind | Units | Canonical | Factors |
| --- | --- | --- | --- |
| `mass` | g, kg | **g** | `kg → g` × 1000 |
| `volume` | ml, L | **ml** | `L → ml` × 1000 |
| `count` | item | **item** | — |

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

Imperial units (oz, lb, cups, tbsp) are deliberately excluded from v1. Adding oz/lb later is
one row each in `UNITS`. Cups and spoons are **not** simple additions — they are volume
measures whose mass depends on the ingredient and on packing, so they belong with the
cross-kind conversion rules below, not with scalar factors.

## Quantity representation

Two shapes, with a strict rule about which is stored.

```ts
/** What the user typed. Used at input boundaries and for display. NEVER stored alone. */
type Quantity = { value: number; unit: Unit };            // { value: 1.2, unit: "kg" }

/** Normalised. This is what is persisted, compared, and summed. */
type CanonicalQuantity = { amount: number; kind: MeasureKind };   // { amount: 1200, kind: "mass" }
```

Persisted records store `CanonicalQuantity`. Where the input unit matters for display —
recipe lines especially, because "1.2 kg chicken" should not come back as "1200 g" — the
entity keeps a separate `displayUnit` field alongside the canonical amount
(`RecipeLine.displayUnit` in DOMAIN_MODEL.md). The canonical amount is the truth; the display
unit is a formatting preference.

Amounts are plain `number` (IEEE 754 double). At the magnitudes this app deals in — grams and
millilitres, rarely above 10^5 — doubles carry far more precision than food data has
accuracy, so a decimal or integer-scaled representation would be complexity without benefit.
The consequence is handled explicitly by the comparison tolerance below rather than by
pretending the arithmetic is exact.

## One canonical kind per ingredient

Each `Ingredient` declares a single `measureKind`, and it is immutable once referenced.
Everything about that ingredient — its nutrition basis, its pantry stock, its recipe lines,
its plan requirements, its shopping lines — lives in that one kind.

This is the decision that removes almost all unit complexity from the codebase:

- Pantry stock and recipe requirements for the same ingredient are always the same kind, so
  `required <= available` is a plain numeric comparison with no conversion.
- Shopping subtraction is plain arithmetic.
- Nutrition is one multiplication against a fixed basis.
- No stored quantity can be ambiguous about what it measures.

Choosing the kind: use `mass` for anything sold and cooked by weight (meat, rice, flour,
vegetables), `volume` for liquids measured by volume (milk, stock, oil if you prefer), and
`count` for discrete items (eggs, tortillas, tins). When in doubt, `mass` — it is the most
accurate basis for nutrition and the one food labels use.

## Cross-kind conversion

The user may want to *enter* a quantity in a different kind from the ingredient's canonical
one — 250 ml of milk when milk is stored by mass, or 2 eggs when eggs are stored by mass.
This requires ingredient metadata, and there is exactly one rule:

> **Never guess a cross-kind conversion.** If the required factor is absent, refuse the
> input and prompt for the factor inline.

| Conversion | Requires | Formula |
| --- | --- | --- |
| volume → mass | `densityGPerMl` | `g = ml × densityGPerMl` |
| mass → volume | `densityGPerMl` | `ml = g ÷ densityGPerMl` |
| count → mass | `gramsPerItem` | `g = items × gramsPerItem` |
| mass → count | `gramsPerItem` | `items = g ÷ gramsPerItem` |
| count ↔ volume | both | via mass; **flag as approximate** |

```ts
type ConversionResult =
  | { ok: true; canonical: CanonicalQuantity; approximate: boolean }
  | { ok: false; reason: "missingDensity" | "missingItemWeight"; needs: "densityGPerMl" | "gramsPerItem" };

toCanonical(q: Quantity, ingredient: Ingredient): ConversionResult
```

`toCanonical` returning a result type rather than throwing is deliberate: the missing-factor
case is a normal, expected user-facing state ("Tell us what one egg weighs and we'll do the
rest"), not an exception. Every call site must handle it, which is how the UI ends up
prompting instead of silently storing a wrong number.

Guards: `densityGPerMl > 0` and `gramsPerItem > 0`; a zero or negative factor is a validation
error, not a divide-by-zero at runtime.

Marking count↔volume as `approximate` matters because the error compounds through two
factors. Surface it in the UI ("≈ 240 ml") rather than hiding it.

## Display formatting

Canonical storage, human-readable output. Formatting is presentation-only and lives in one
shared formatter so no component invents its own rule.

| Canonical | Displayed as | Rule |
| --- | --- | --- |
| 1200 g | `1.2 kg` | mass ≥ 1000 g → kg, up to 2 dp |
| 850 g | `850 g` | below 1000 g → g, integer |
| 12.5 g | `12.5 g` | below 100 g → up to 1 dp |
| 1500 ml | `1.5 L` | volume ≥ 1000 ml → L, up to 2 dp |
| 250 ml | `250 ml` | below 1000 ml → ml, integer |
| 3 item | `3` / `3 eggs` | integers where possible |
| 0.5 item | `½` or `0.5` | fractions are legal for count |

Two exceptions to auto-promotion:

1. **A recipe line uses its own `displayUnit`** when one was recorded, so the recipe reads
   the way it was written.
2. **Aligned numeric columns** (nutrition tables, shopping lists, pantry lists) should use a
   consistent unit per column rather than mixing `1.2 kg` and `850 g` in one column — and
   tabular figures, per [DESIGN.md](./DESIGN.md).

Fractional counts are allowed (half an avocado). Do not silently round counts to integers;
`0.5 item` is real data.

## Comparison and tolerance

Availability and shopping both hinge on comparing floats. One tolerance rule, applied
everywhere:

```ts
const EPSILON = { mass: 1e-4, volume: 1e-4, count: 1e-6 };   // canonical units

isShort(required, available, kind)  => required - available >  EPSILON[kind];
isEnough(required, available, kind) => required - available <= EPSILON[kind];
isZero(amount, kind)                => Math.abs(amount)    <= EPSILON[kind];
```

The tolerance exists to absorb floating-point residue from scaling (0.1 g of accumulated
error must not make a recipe unmakeable), not to model real-world slack. It is deliberately
far below any amount a user would notice.

**Real-world slack is a separate, explicit concept.** "You need 500 g and have 499 g — close
enough" is a product judgement, and the model expresses it through `Ingredient.isStaple`
(which downgrades a shortfall from `missingMajor` to `missingMinor`), not through a fuzzy
epsilon. Keeping the two apart means the arithmetic stays honest and the leniency stays
visible and user-controlled.

Shopping lines apply `max(0, required − available)` and then drop lines where
`isZero(toBuy)`, so a 0.00001 g shortfall never appears on a list.

## Aggregation

Requirements, shopping totals and pantry quantities all aggregate the same way:

```ts
sumQuantities(qs: CanonicalQuantity[]): CanonicalQuantity {
  assert(allSameKind(qs));           // a genuine programming error if violated
  return { amount: qs.reduce((a, q) => a + q.amount, 0), kind: qs[0].kind };
}
```

Because a given ingredient has exactly one kind, aggregation is always grouped by
`ingredientId` first and mixed-kind sums are unreachable in correct code. The assertion
exists to fail loudly in tests if that ever stops being true.

Summation order can vary (a plan aggregates in date order, a shopping list in category
order). Float addition is not associative, so totals may differ in the last bits — the
display rounding in [NUTRITION_MODEL.md](./NUTRITION_MODEL.md) and `EPSILON` above absorb
this. Do not write tests that assert exact float equality on aggregates; assert within
tolerance.

## Validation rules

Enforced by the Zod schemas at every boundary:

1. `Quantity.value` is finite and `>= 0`. Negative user input is a validation error.
2. `StockMovement.delta.amount` **may** be negative — it is the one signed quantity in the
   model, and that is the point of the ledger.
3. `Unit` must be a known key of `UNITS`.
4. `CanonicalQuantity.kind` must equal the referenced ingredient's `measureKind` on every
   entity that carries one. This is the single most valuable schema assertion in the app.
5. `densityGPerMl` and `gramsPerItem` are `> 0` when present, `null` when unknown.
6. `Recipe.servings > 0` and `Batch.portionsTotal > 0`.
7. Quantities are not capped, but implausible values (> 100 kg in a recipe line) should warn
   rather than block — usually a mistyped unit.

## Testable properties

Pure functions, no UI, no storage — the same Vitest tier as the nutrition core:

1. `toCanonical` round-trips within tolerance for every same-kind unit pair
   (`1.2 kg → 1200 g → 1.2 kg`).
2. `toCanonical` returns `ok: false` with the right `needs` field whenever the required
   factor is absent — never a thrown error, never a fabricated number.
3. Cross-kind round-trips are within tolerance when factors are present
   (`250 ml → g → ml` with a density of 1.03).
4. `format(toCanonical(q))` is stable and never shows more precision than the rules allow.
5. `isShort`/`isEnough` are exact complements, and neither is true at the tolerance boundary
   in a way that contradicts the other.
6. `sumQuantities` is commutative within tolerance and yields `0` for an empty list.
7. Scaling a recipe by `n` then by `1/n` returns the original quantities within tolerance.
8. Fractional counts survive storage and display without being rounded to integers.

## Extension points

| Later capability | Change needed |
| --- | --- |
| oz, lb, fl oz, pt | One row each in `UNITS`; scalar factors only. |
| Cups, tbsp, tsp | Per-ingredient volume→mass data; treat as cross-kind with `approximate: true`. Do not add as scalar units. |
| Locale-aware display (metric/imperial toggle) | A display preference read by the formatter. Canonical storage is unaffected. |
| Package sizes ("buy 2 × 500 g packs") | A `packSize` on `Ingredient`, applied when rendering shopping lines. Requirements stay canonical. |
| Per-ingredient preferred display unit | A field on `Ingredient`; the formatter already takes an override. |

Note the shape of every row above: display and entry gain options, canonical storage never
changes. That is the property this model is built to preserve.
