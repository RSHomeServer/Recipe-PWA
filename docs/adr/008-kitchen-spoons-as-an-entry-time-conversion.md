# ADR-008: Kitchen spoons are an entry-time conversion, not a unit family

## Status

Accepted. This is the decision [UNIT_MODEL.md](../planning/UNIT_MODEL.md) §Extension points
reserved: *"Cups, tbsp, tsp, slices … Treat as a **separate feature with its own decision**,
not a units addition, and mark results approximate."* V1 decision 2 is **not** reversed.

## Context

Nobody weighs paprika. The flavour layer is used in spoons — half a teaspoon of MSG, a
tablespoon of soy sauce, a teaspoon of chilli flakes — and asking "how many grams of smoked
paprika?" is asking a question the user cannot answer while standing at the counter. For a
feature whose entire premise is that seasoning a cucumber should be *easier* than opening a
packet of crisps, a gram-only entry box is a serious defect.

Decision 2 excluded spoons for a reason that has not weakened: ingredient-relative units need
per-ingredient conversion data, and a wrong density silently corrupts every downstream number —
requirements, shopping subtraction, availability, a year of insights. The exclusion was never
"spoons are unimportant". It was "spoons are not a units problem, and solving them as one puts
a guessed number underneath the whole calculation layer".

Two things changed in V2 and V3 that make this tractable now:

1. **`source` exists** ([ADR-002](./002-reference-ingredient-data-and-provenance.md)). An
   ingredient can now say where a figure came from, so a gram-per-spoon weight can be cited
   rather than assumed.
2. **The flavour pack has portion data.** USDA SR Legacy publishes `food_portion` rows — "1
   tsp, 2.3 g" — for the spice entries ADR-006 seeds. CoFID publishes none at all, verified in
   ADR-002 §2a point 2.

So the data can be sourced for exactly the ingredients that need it, and is honestly absent
for the rest.

## Decision

### 1. Two nullable, sourced fields on `Ingredient`

```ts
type Ingredient = {
  // … unchanged …
  gramsPerTsp:  number | null;   // V3 — null means "we have no cited weight"
  gramsPerTbsp: number | null;
};
```

Populated by the flavour-pack transcode from the dataset's own portion rows. **Never
estimated, never interpolated, and never derived one from the other** — a tablespoon is not
reliably three teaspoons of a flaky dried herb, and asserting it would manufacture exactly the
false precision the brief warns against. If the source publishes only one of the two, the
other stays `null`.

Only meaningful for `measureKind: "mass"`. Volume ingredients already accept ml, which is what
a spoon of liquid measures; count ingredients have no spoon.

### 2. Spoons never enter the `Unit` union

`UNITS`, `Unit`, `MeasureKind`, `CanonicalQuantity` and every conversion in
`domain/units` are **unchanged**. Every unit in the table keeps a fixed scalar
`toCanonical`, which is the invariant that makes conversion safe to do anywhere.

A spoon is not a unit here. It is an **input affordance** that produces grams:

```
user types "2 tsp" ──> × ingredient.gramsPerTsp ──> 4.6 g ──> stored as { amount: 4.6, kind: "mass" }
```

This is the same shape as `1.2 kg → 1200 g`, and it obeys UNIT_MODEL's first governing rule
verbatim: *conversion happens once, where the user types a number; nothing downstream ever
converts*. Requirements, shopping, availability, nutrition and insights never see a spoon and
need no change whatsoever.

### 3. The control only offers spoons when a weight is cited

The quantity input adds tsp/tbsp options **only** when the ingredient is `mass` and the
corresponding field is non-null. No fallback, no "approximately 5 g" default, no typing a
spoon against an ingredient that has no weight for one.

This makes the data's honesty visible in the interface rather than buried in a tooltip: spoons
appear for paprika because USDA measured one, and do not appear for the user's hand-entered
chilli oil because nobody has. The user can add the weight in the ingredient editor if they
want the affordance, and it is then their figure with their provenance.

### 4. Read-back uses a display-only entry hint

A line entered as "2 tsp" that reads back as "4.6 g" is a worse experience than not offering
spoons at all. `RecipeLine` therefore keeps what was typed:

```ts
type RecipeLine = {
  // … unchanged, quantity is still the canonical gram amount …
  entryHint: { spoons: number; spoon: "tsp" | "tbsp" } | null;   // V3 — display only
};
```

**No derivation may read `entryHint`.** This is the same contract as `PlanGroup`
([ADR-004](./004-meal-templates-by-expansion.md) §2, R4.3) and `source`/`common`
([ADR-002](./002-reference-ingredient-data-and-provenance.md), R2.2), and it is guarded the
same way: a property test asserts every derived result is byte-identical with `entryHint`
populated and with it cleared. That test is the reason this field is safe to add.

`quantity` remains the truth. The hint is a formatting preference, exactly as `displayUnit`
already is.

If the ingredient's `gramsPerTsp` is later corrected, existing lines keep their stored grams
and their hint. The hint then describes what the user did at the time, not what the current
weight would produce — which is right, and matches how `displayUnit` already behaves.

### 5. Per-spoon calories are computed, never stored

The external brief proposed storing `kcalPerTsp`, `kcalPerTbsp`, `gramsPerTsp` and
`gramsPerTbsp` alongside `kcalPerGram`. Three of those four are derivable, and storing a
derived figure is what decision 23 exists to prevent — the day someone corrects a kcal value,
four stored spoon figures go stale silently.

```
kcal per tsp = nutrition.kcal × gramsPerTsp / 100
```

One multiplication at display time, always consistent with the figure above it.

### 6. Results are labelled approximate

A cited gram-per-spoon weight is still a weight for *someone's* teaspoon, loosely packed on a
particular day. Where a quantity was entered in spoons, the UI says so and presents the derived
nutrition as approximate. UNIT_MODEL's extension note required this and it is not optional.

## Consequences

**Positive.** The flavour layer becomes usable at the counter. The calculation core is
untouched — no new unit, no density field on the general ingredient model, no cross-family
conversion, and decision 2's actual protection (fixed scalar factors everywhere downstream)
survives intact. The affordance is self-limiting: it exists precisely where cited data exists.

**Negative.** Spoons work for flavour-pack ingredients and not for CoFID ones, which will look
arbitrary to a user who does not know why. Mitigated by the ingredient editor accepting a
user-supplied weight, but the asymmetry is real and is the price of not guessing.

**Cost and risk.** The risk is scope creep: `gramsPerTsp` is one short step from
`densityGPerMl`, and from there to ml ↔ g conversion, which decision 2 excludes and this ADR
does **not** reopen. The boundary to hold: these two fields convert *at entry, for mass
ingredients, from a cited portion*. They are not a density model and must not be read by
anything but the entry control and the display formatter.

## Verification

1. `UNITS`, `Unit` and `CanonicalQuantity` are unchanged; no test in `domain/units` needs
   editing.
2. Entering 2 tsp of an ingredient at 2.3 g/tsp stores `{ amount: 4.6, kind: "mass" }`.
3. The spoon option is absent when `gramsPerTsp` is null, when `measureKind` is not `mass`,
   and for `tbsp` specifically when only `gramsPerTsp` is populated.
4. **Entry-hint invariance** — requirements, shopping, availability, nutrition, `expand()` and
   every insight are byte-identical with `entryHint` populated and with it cleared. The
   governing test of this ADR.
5. Read-back: a line entered as 2 tsp renders as "2 tsp (4.6 g)", and a line entered in grams
   renders with no spoon text.
6. Per-spoon kcal is computed from the current nutrition — editing an ingredient's kcal changes
   the displayed per-tsp figure immediately, with nothing stored.
7. The transcode never writes a `gramsPerTbsp` derived from `gramsPerTsp`; an entry whose
   source publishes only a teaspoon portion has `gramsPerTbsp: null`.

## Open gate before the ticket starts

**A human or the implementing Executor must confirm that USDA SR Legacy's `food_portion` data
actually covers the allow-listed spice entries with tsp/tbsp measures**, and in what
proportion. This ADR assumes it does, on the same evidentiary standard ADR-002 §2a applied to
CoFID: assumed properties of a dataset get checked before a ticket is built on them.

If coverage turns out to be thin, the fallback is not to guess — it is to ship the fields
populated where data exists and let the affordance appear for fewer ingredients.
