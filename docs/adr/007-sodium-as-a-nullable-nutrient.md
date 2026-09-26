# ADR-007: Sodium joins the nutrition record, and unknown is not zero

## Status

Accepted. Extends V1 decision 21 and
[NUTRITION_MODEL.md](../planning/NUTRITION_MODEL.md), both of which anticipated this
("the record is **extensible** to fibre, sugar, saturated fat and sodium").

## Context

Salt is 0 kcal. So is MSG, so is vinegar at 22 kcal/100 g, and so is almost everything the
Flavour Lab is built to promote. A product that measures only calories will therefore tell the
user that a teaspoon of salt, a dash of fish sauce and a spoon of soy sauce are all free, and
it will keep saying so at every quantity.

That is not a rounding error in the feature — it is the feature's central blind spot. The
brief names it directly: *"the database should not treat salt as 'unlimited' simply because it
has zero calories"*, and asks that sodium be recorded where available, with the UK adult
reference of roughly 6 g salt (2.4 g sodium) per day from all sources.

Without sodium, every constraint the Flavour Lab wants to express about its own best
ingredients is inexpressible. With it, the product's existing attribution machinery —
`recipeBreakdown`, insights by ingredient, the calorie-attribution views — all work on sodium
for free, because every one of them is generic over the `Nutrition` record.

### The question this ADR exists to answer

Not *whether* to add sodium. The question is what the field means when we do not know it.

CoFID publishes sodium for most but not all foods. USDA publishes it for the flavour pack.
Every ingredient the user typed by hand in V1 and V2 has no sodium figure and never will
unless they go back and enter one. So on the day this ships, the library will hold three
populations: figures we know, figures the dataset does not carry, and figures nobody has
entered.

**Defaulting the unknown ones to 0 would be the same mistake ADR-002 §2a caught in the CoFID
transcode** — mapping `N` ("present in significant quantities, no reliable figure") to zero
asserts the opposite of what the source says. Applied to sodium the error is worse, because
the foods most likely to lack a figure are the user's own hand-entered condiments, which are
exactly the salty ones.

## Decision

### 1. `sodiumMg` is nullable, and `null` means unknown

```ts
type Nutrition = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number | null;   // V3 — null means "not known", never "none"
};
```

Per the same basis as everything else: per 100 g, per 100 ml, or per item (decision 3).

Zero remains legal and meaningful — distilled water genuinely contains no sodium, and the
dataset says so. `null` says nobody knows.

### 2. `null` is absorbing under `sum`, and survives `scale`

```ts
ZERO = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 }

sum:   any null contributor  →  null total
scale: null × f              →  null
```

A total is known only when every contributor is known. Adding a sauce with unknown sodium to a
snack makes the snack's sodium unknown, and the UI says so rather than quietly under-reporting.

**This preserves the monoid.** `sum` stays commutative and associative with `ZERO` as
identity: an absorbing element does not disturb either law, and `ZERO.sodiumMg = 0` keeps
`sum([]) = ZERO`. `scale` still distributes over `sum`. The existing property tests
(NUTRITION_MODEL §Testable properties 1 and 2) therefore extend to the new field rather than
being weakened for it, and they must be re-run over records containing nulls.

The alternative — a separate parallel `micros` record kept outside `Nutrition` — was rejected
because it would fork every summing helper, every insight fold and every display component
into "macros" and "the other one", for a field that behaves exactly like a nutrient.

### 3. Display distinguishes the three cases, and never invents a total

| Case | Rendered as |
| --- | --- |
| Known | `480 mg sodium` |
| Known, partially | `at least 480 mg · 2 of 7 items unknown` |
| Wholly unknown | `Sodium not known` |

No asterisk-only treatment, no rendering `null` as `0 mg`, and no "estimated" figure
synthesised from similar foods. This is DESIGN.md §4's existing rule — show the true total,
never fudge the parts — applied to a new column.

### 4. The 6 g / 2.4 g reference is a comparison, not a limit

The UK adult reference of ~6 g salt (2.4 g sodium) per day is shown as context alongside a
daily sodium figure in insights, in the same spirit as the existing calorie target: a
denominator the user chose to see, not a budget the app enforces and not a warning it issues.

Salt and sodium are stored as one thing — **sodium in mg** — and salt-equivalent is computed
for display where it helps (`salt g ≈ sodium mg × 2.5 ÷ 1000`), because UK labels print both
and the user will be reading both. Storing one and deriving the other is decision 23 applied
to a unit conversion.

No health claims. No red/amber/green. No score. The product reports; the user decides.

### 5. CoFID sodium comes from the `Inorganics` worksheet, on the existing alignment guarantee

ADR-002 §2a already verified the mechanic this depends on: *"A food code occupies the same row
in every worksheet, so sheets align positionally."* The transcode reads `Inorganics` alongside
`Proximates` and takes the sodium column (`NA`, mg per 100 g).

The sentinel rules are **inherited unchanged and are not up for reinterpretation**:

- `Tr` → `0`
- `N` → `null` — *not* zero, and, unlike the macro case, **not a reason to drop the food**.
  A missing sodium figure is a missing column, not an unusable entry. This is the one place
  where V3's handling of `N` differs from R2.5d's, and it differs because `sodiumMg` is
  nullable where the macros are not.
- Blank → `null`

### 6. Existing installs are backfilled, guarded by `source.kind`

This is the part that does not fall out of the existing seed mechanism, and it would be a
silent no-op if it were left to.

Seeding is additive and **never overwrites an existing row** (R2.7). So regenerating
`pack.json` with sodium would deliver nothing to anyone who has already installed: their 2,852
rows already exist and would be skipped, leaving sodium null forever on precisely the reference
data we do have figures for.

The Dexie v3 migration therefore backfills directly:

```
for each ingredient where source.kind === "reference"
                     and source.datasetId matches a shipped pack
                     and nutrition.sodiumMg is absent:
    set sodiumMg from the pack entry with the same datasetId::entryCode
```

`kind === "reference"` is the guard that makes this safe, and it is exact rather than
approximate: R2.4 flips `kind` to `userEntered` the moment a user edits nutrition, so a row
still marked `reference` is by definition one nobody has touched. Every other row —
`userEntered`, `packaging`, `estimated`, and any reference row the user has edited — gets
`null` and is left alone.

The migration adds a nutrient that was absent. It never changes a figure that exists.

### 7. Batch snapshots keep their nulls forever

A `BatchSnapshot` is a historical record and does not move (decision A, and the
history-immutability test that guards it). Batches cooked before this ships have no sodium
figure and will never acquire one, even after their ingredients are backfilled.

This is correct, not a gap: the snapshot records what was known at cook time. Insights over
those weeks will show sodium as partially unknown, which is exactly true.

## Consequences

**Positive.** The product can finally express the real constraint on its own best ingredients.
Every existing attribution view — breakdown by recipe line, insights by ingredient, the "where
did this come from" question the product is built around — answers for sodium with no new
machinery. The nullable design means the answer is honest on day one rather than confidently
wrong.

**Negative.** Every `Nutrition` literal in the codebase and its tests gains a field, and every
display that shows a total has a third state to render. The null-propagation rule will surprise
someone the first time a single unknown ingredient makes a whole week's sodium unknown — that
is the design working, but it needs the "2 of 7 items unknown" affordance to not feel broken.

**Cost and risk.** The backfill is the sharp edge. It writes to existing user rows, which no
migration in this product has done before at this scale. Its guard is one condition, so the
test for it is one condition: assert that a reference row gains sodium, and that a row the user
edited — which is a row whose `kind` flipped — does not.

## Verification

1. `sum` and `scale` property tests pass over records containing `null` sodium: identity,
   commutativity, associativity, distribution.
2. One `null` contributor makes the total `null`; `sum([])` is `ZERO` with `sodiumMg: 0`.
3. A CoFID `Tr` sodium seeds as `0`; an `N` seeds as `null` **and the food is still seeded**.
4. Migration: a `reference` row gains its pack sodium; a `userEntered` row, a `packaging` row
   and a diverged reference row all keep `null` and are otherwise byte-identical.
5. A batch snapshot written before the migration is byte-identical after it, including its
   null sodium. The history-immutability test covers this and must be extended, not replaced.
6. Backup round-trip at schema v3 preserves `null` as `null` and never as `0`.
7. Salt-equivalent display: 1,000 mg sodium renders as 2.5 g salt, and a null renders as
   "not known" in both units.
