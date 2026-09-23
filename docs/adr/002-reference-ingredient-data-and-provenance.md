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
  common: boolean;               // NEW — surfaced by default in pickers; see §2
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

### 2. The starter pack is script-transcoded, wide, and tiered for discovery

The brief is a **wide base of accurate ingredients, at MVP pace**, with photographs explicitly
traded away to get it.

**The pack is generated by a build-time script from the published dataset. Nothing is
transcribed by hand.** This is the single most important mechanic here. Hand-curating 150
nutrition records is slow, and its errors are silent — a mistyped figure propagates into
recipes, plans, shopping and a year of insights with nothing to catch it. A transcode script
is faster to write than 150 rows are to type, it is reviewable once instead of 150 times, and
it is re-runnable when the dataset is updated. The work moves from typing to mapping: which
source columns become our four macros, and how each entry lands in a category and a
`measureKind`.

**Seed every generic entry with complete macro data.** Filter out entries missing any of
kcal, protein, carbohydrate or fat rather than guessing at them, and filter out states the
product cannot represent. This yields a library in the high hundreds rather than 150, which
is what "wide base" asks for and costs nothing extra once the script exists.

**Curation survives as a list of codes, not a list of figures.** A hand-maintained list of
roughly 150 source entry codes marks the everyday foods, which is cheap to write, cheap to
review, and the only hand-authored part of the pack.

```ts
type Ingredient = {
  // …
  common: boolean;   // surfaced by default in pickers; the long tail is behind "show all"
};
```

Without this tier the wide base actively hurts: searching "chicken" in a raw dataset returns
dozens of states — raw, roasted, casseroled, dark meat, light meat, skin on, skin off — and
the user has to adjudicate a food-composition table to plan dinner. With it, common entries
answer the ordinary case and the full set stays one tap away for anyone who wants
"chicken thigh, casseroled, meat only".

`common` is metadata on the same terms as `source`: **no calculation may read it**. It
defaults to `true` for anything the user creates, so their own ingredients always surface.

The common list must include this user's stated weekly pattern — chicken thigh and wing (raw,
skin on and off), frozen hashbrowns, frozen peas, mixed vegetables, broccoli, and common table
sauces including BBQ — so the very first session is productive.

**Brand-specific items are the user's job in V2.** Automated brand onboarding is a considered
follow-up, not MVP scope: the user adds their specific hashbrowns from the packet, which is
exactly `source.kind: "packaging"`. The model is already shaped for the automated version to
arrive later as a data-entry route rather than a change.

Mechanics:

- The pack is a **seed, not a backup import**. Decision E's replace-only, all-or-nothing import
  is untouched and remains the only thing called "import". The pack is additive, matched by
  `source.entryCode`, and **never overwrites an ingredient the user has edited**.
- A Settings action, *"Add missing starter ingredients"*, re-runs the top-up. It reports what
  it added and what it skipped. Useful after the pack grows in a later release.
- Pack entries are ordinary ingredients: editable, archivable, usable in any recipe. There is
  no read-only tier.
- Every entry is validated against `IngredientSchema` **at build time**, so a malformed entry
  fails CI rather than a user's first run.
- Attribution and licence text live in Settings → About, and the exact licence terms must be
  re-read by a human before release rather than taken from this ADR.

**Dataset: UK CoFID, with USDA FoodData Central as a sanctioned fallback.** Both were
accepted. CoFID is preferred because the product is UK-facing and CoFID is a UK table, but the
two are interchangeable as far as this design is concerned — the transcode script changes, and
nothing else does. If CoFID's published format makes the script materially slower to write,
**take USDA and do not escalate**; pace matters more than the choice between two rigorous
public datasets, and `source` records which one was used either way.

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

Negative: several hundred rows are seeded that the user did not ask for individually. This is
the deliberate trade for a wide base. Mitigated by the `common` tier, by search-first pickers
([ADR-005](./005-choice-controls-by-cardinality.md)), and by archiving being one tap.

Cost and risk: the remaining risk is concentrated in one place — the **mapping** the script
performs, not the figures it copies. A column mapped to the wrong macro, or a `measureKind`
assigned wrongly, is silent and affects hundreds of rows at once rather than one. That is a
better failure mode than hand transcription (it is systematic, so a handful of spot checks
catches it) but it is a sharper one, so the spot-check tests are not optional.

Note the risk profile improved by choosing a script. The earlier hand-curation plan made this
the most dangerous ticket in V2; scripted, its errors are uniform and therefore detectable.

## Verification

1. `IngredientSchema` rejects an ingredient with a missing `source`.
2. A build-time check parses every starter-pack entry through `IngredientSchema` and fails the
   build on any error.
3. Spot-check test: named entries match their published figures within rounding, with the
   `entryCode` asserted alongside. **Cover at least one entry per `measureKind` and one per
   category**, because the failure this guards against is a systematic mapping error, and a
   spot check that samples only one shape cannot see it.
4. Every entry in the hand-maintained common list resolves to a seeded ingredient. A code that
   matches nothing fails the build rather than silently producing a smaller default set.
5. Property test: for a corpus of ingredients, every nutrition, availability, requirements,
   shopping and insights result is identical when `source.kind` and `common` are permuted.
   Neither has any computational effect.
6. Editing the nutrition of a `reference` ingredient leaves `datasetId` and `entryCode` intact
   and sets `kind` to `"userEntered"`.
7. Running the top-up twice adds nothing the second time, and never modifies an edited row.
8. A migrated V1 database has every ingredient at `kind: "userEntered"` with null origin
   fields, `common: true`, and no nutrition figure changed.
