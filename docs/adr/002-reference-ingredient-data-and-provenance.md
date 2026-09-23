# ADR-002: Reference ingredient data and per-ingredient provenance

## Status

Accepted. Partially revisits V1 decision 24, which listed external food databases as out of
scope, and V1 decision 1, whose `Ingredient` shape this extends.

## Context

An empty ingredient library is a hard wall in front of every other feature. Recipes are built
from ingredients, the pantry stocks ingredients, availability compares against ingredients and
every insight attributes to ingredients — so until the library is populated, nothing in the
product does anything. V1 shipped with the library empty and the user supplying every figure
by hand, which means the first session is twenty minutes of typing nutrition labels before the
app can demonstrate a single benefit.

V1 anticipated this. DOMAIN_MODEL.md's Ingredient section already notes that
"external-database provenance (decision 24, but the shape is ready for it — adding a `source`
field changes no calculation)". This ADR takes that step.

Two things must be true of whatever we ship:

1. **The figures must be checkable.** Nutrition data drives every derived number in the
   product, and a wrong figure propagates silently into recipes, plans, shopping and a year of
   insights. If the user cannot see where a number came from, they cannot audit it, and the
   product's central claim — that it reports honestly — is unsupported.
2. **It must work offline with no account.** Offline-first is the stated differentiator
   (FEATURE_MATRIX.md, platform section). A library that needs a network call to be useful
   would undo that.

### Candidate sources considered

| Source | Licence | Shape | Photos |
| --- | --- | --- | --- |
| **CoFID** (McCance & Widdowson's *The Composition of Foods*, published by the UK health department) | Open Government Licence v3.0 — reuse permitted with attribution | Generic UK foods per 100 g, raw and cooked states, laboratory-analysed | None |
| **USDA FoodData Central** | US public domain | Generic + branded, largest coverage | None |
| **Open Food Facts** | ODbL for the database, CC-BY-SA for images | Branded packaged products, crowd-sourced | Yes |

CoFID wins on fit. The product's model is built on *raw ingredients you cook with* — the
pantry holds raw stock, recipes list raw quantities, the cook flow records raw quantities
used. CoFID is precisely a table of generic foods in defined states, measured in a laboratory,
for the UK. USDA is equally rigorous but uses US naming and portion conventions, which adds
friction for no benefit here. Open Food Facts is a different kind of data: specific packaged
products, accurate only as far as the last contributor made it, and its ODbL share-alike
obligations attach to any derived database we distribute — a real consideration for a product
that exports its whole database as JSON.

## Decision

### 1. `Ingredient` gains a mandatory `source`

```ts
type Ingredient = {
  // … all V1 fields unchanged …
  source: IngredientSource;      // NEW — never null
  imageId: Id | null;            // NEW — optional user photo, same mechanism as RecipeImage
};

type IngredientSource = {
  /** How much the figures can be trusted, and by what route they arrived. */
  kind: "reference" | "packaging" | "userEntered" | "estimated";

  /** Origin, set once when the ingredient arrives from a dataset. Immutable thereafter. */
  datasetId:   string | null;    // "cofid-2021"
  datasetName: string | null;    // full citation, rendered verbatim in the UI
  entryCode:   string | null;    // the source's own identifier, e.g. a CoFID food code
  entryName:   string | null;    // the name in the source, verbatim — may differ from ours
  licence:     string | null;    // SPDX-style identifier or licence name
  url:         string | null;    // where a human can go and check
  retrievedAt: IsoDate | null;

  note: string | null;           // e.g. "Adjusted to the figures on my pack"
};
```

Meanings, because the distinction is the whole point:

- **`reference`** — the figures are exactly as published by a cited dataset. Untouched.
- **`packaging`** — the user copied them from a product label. Trustworthy for that product.
- **`userEntered`** — the user typed or changed them. The default for everything created by
  hand.
- **`estimated`** — an acknowledged guess. Surfaced so it can be revisited.

**Invariants**

1. `source` is **metadata only**. No calculation, derivation, filter or sort may read it. Every
   nutrition path behaves identically for every `kind`. This is what keeps the field free of
   consequences and is the property test that guards it.
2. The origin fields (`datasetId`, `datasetName`, `entryCode`, `entryName`, `licence`, `url`,
   `retrievedAt`) are **write-once**. Once an ingredient arrives from a dataset, that fact is
   permanent history, in the same spirit as `BatchSnapshot`.
3. **Editing the nutrition of a `reference` ingredient flips `kind` to `"userEntered"`** while
   preserving the origin fields. The product then says, truthfully, "originally CoFID 17-123,
   since edited by you". Silently keeping the `reference` badge on a number the user changed
   would be the one genuinely dishonest state this field could get into.
4. Existing ingredients migrate to `{ kind: "userEntered", … all origin fields null }`. Nothing
   is lost and nothing is fabricated.

### 2. A curated CoFID-derived starter pack ships with the app

Roughly **150 generic ingredients**, hand-selected to cover ordinary UK home cooking, bundled
as a static JSON asset and seeded on first run alongside the existing categories and meal
slots.

Selection principles:

- Cover the seeded categories evenly, weighted toward things that appear in many recipes.
- **Prefer the raw state**, because that is what the pantry stocks and what recipes list. Where
  a cooked state is what you actually buy and eat (frozen chips, baked beans), include that.
- Include the specific foods in this user's stated weekly pattern — chicken thighs and wings
  (raw, skin on and off), frozen hashbrowns, frozen peas and mixed vegetables, broccoli,
  BBQ and other table sauces — so the very first session is productive.
- Every entry carries a complete `source` with `kind: "reference"` and a resolvable `url`.

Mechanics:

- The pack is a **seed, not a backup import**. Decision E's replace-only, all-or-nothing import
  is untouched and remains the only thing called "import". The pack is additive, matched by
  `source.entryCode`, and **never overwrites an ingredient the user has edited**.
- A Settings action, *"Add missing starter ingredients"*, re-runs the top-up. It reports what
  it added and what it skipped. Useful after the pack grows in a later release.
- Pack entries are ordinary ingredients: editable, archivable, usable in any recipe. There is
  no read-only tier.
- The pack is validated against `IngredientSchema` **at build time**, so a malformed entry
  fails CI rather than a user's first run.
- Attribution and licence text live in Settings → About, and the exact licence terms must be
  re-read by a human before release rather than taken from this ADR.

### 3. Ingredient visual identity is a category icon; photos are optional and user-supplied

No licence-clean photograph exists for "chicken thigh, raw" as a generic food. Sourcing them
would mean either branded product images with share-alike obligations or a stock-photo
dependency, both of which buy a decorative gain at real cost.

So:

- **Every `IngredientCategory` gains `icon` and `accent`** (a Lucide icon name and one of the
  existing category colours). That is the default visual identity, it is always present, and it
  makes a list of 150 ingredients scannable by category at a glance — which is the actual job
  the user wanted photos to do.
- **`Ingredient.imageId` allows an optional user photo**, using exactly the mechanism recipes
  already have: pick a file, resize on a canvas, store a Blob in `recipeImages` (renamed
  `images`). Upload lives in the ingredient editor only.
- DESIGN.md §11's rules apply unchanged: the icon occupies the slot when no photo exists, so
  the layout never shifts and a list never looks ragged. No grey placeholders, no "add a
  photo" prompts.

An online product-photo lookup is **not** ruled out forever, but it is not V2. If it arrives,
it slots into `source` with `kind: "packaging"` and needs no model change — which is the test
this design was built to pass.

## Consequences

Positive: the first session is productive; every figure is auditable down to a citation and a
URL; the product can honestly distinguish a laboratory measurement from a guess; the extension
path to barcode scanning and online lookup is now a data-entry route rather than a model
change.

Negative: about 150 rows are seeded that the user did not ask for individually. Mitigated by
curation, by archiving being one tap, and by the alternative being an empty app.

Cost and risk: assembling the pack is genuine work (transcription, unit normalisation to
g/ml/item, category assignment, verification) and it is the one V2 task where an error is
silent and propagates. It therefore gets its own ticket, a machine-checkable build-time
validation, and spot-check tests asserting specific known values.

## Verification

1. `IngredientSchema` rejects an ingredient with a missing `source`.
2. A build-time check parses every starter-pack entry through `IngredientSchema` and fails the
   build on any error.
3. Spot-check test: named entries match their published figures within rounding, with the
   `entryCode` asserted alongside.
4. Property test: for a corpus of ingredients, every nutrition, availability, requirements,
   shopping and insights result is identical when `source.kind` is permuted across all four
   values. Provenance has no computational effect.
5. Editing the nutrition of a `reference` ingredient leaves `datasetId` and `entryCode` intact
   and sets `kind` to `"userEntered"`.
6. Running the top-up twice adds nothing the second time, and never modifies an edited row.
7. A migrated V1 database has every ingredient at `kind: "userEntered"` with null origin
   fields, and no nutrition figure changes.
