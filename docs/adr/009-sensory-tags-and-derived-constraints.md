# ADR-009: Sensory tags are curated reference metadata; constraints are derived

## Status

Accepted. Adds one field to `Ingredient` and removes an entire proposed schema branch.

## Context

The Flavour Lab's purpose is to answer a question the product currently cannot parse:

> "Find me something crunchy, spicy and sharp for under 100 kcal."

Calories, macros and now sodium are all figures. *Spicy* and *sharp* are not, and no
composition dataset carries them. This metadata has to come from somewhere, and the external
brief proposed two new structures to hold it: a sixteen-value `flavourTags` list, and a
free-form `constraints` object covering sodium, sweeteners, calorie density, caffeine,
allergens, spice tolerance, gastrointestinal tolerance, iodine and tooth enamel.

The first of those is necessary. The second is mostly a trap, and this ADR says which parts
and why.

## Decision

### 1. `flavourTags` on `Ingredient`, from a closed vocabulary

```ts
type FlavourTag =
  | "sweet" | "sour" | "salty" | "umami" | "spicy" | "bitter"
  | "smoky" | "aromatic" | "earthy" | "fresh" | "creamy"
  | "rich" | "nutty" | "fruity" | "floral" | "fermented";

type Ingredient = {
  // … unchanged …
  flavourTags: FlavourTag[];   // V3 — may be empty; never null
};
```

The sixteen values are the brief's, unchanged. They describe **sensory contribution**, not
merit: `rich` and `creamy` are not warnings, and `fresh` is not praise.

A closed enum rather than free text, and a separate field from `Recipe.tags`, because the two
do different jobs. `Recipe.tags` is the user's own free-text shelf labelling ("weeknight",
"mum's"), and it should stay that. A filter that has to return *every* sour ingredient cannot
work against free text — "sour", "acidic", "sharp" and "tangy" would be four different
buckets, and the one the user typed last week would be the one they forget this week. Mixing a
controlled vocabulary into a free-text field degrades both.

### 2. Tags are hand-curated **selection metadata**, and this does not breach ADR-002

Tags for pack ingredients come from a hand-maintained map keyed by `datasetId::entryCode`,
mirroring `common-codes.json`:

```json
{ "usda-sr-legacy::2028": ["smoky", "earthy", "aromatic"] }
```

ADR-002 R2.5's rule is that **no human types a nutrition figure**. That rule protects
calculation inputs, and it is untouched here: a tag is not a measurement, cannot be wrong by a
factor of ten, and feeds nothing that adds up. Deciding that smoked paprika tastes smoky is
editorial work no dataset can do and no script can infer.

User-created ingredients start with an empty array and are tagged in the ingredient editor.
Empty is a normal state, not a gap to nag about.

### 3. No derivation may read `flavourTags`

The third member of a family this codebase already has: `source` and `common` (R2.2),
`PlanGroup` (R4.3), `entryHint` ([ADR-008](./008-kitchen-spoons-as-an-entry-time-conversion.md)
§4). Tags govern search, filtering and display, and nothing else.

Guarded the same way — a property test permutes tags across a corpus and asserts every derived
result is byte-identical. The pattern is proven and cheap; use it.

### 4. A mix's flavour profile is derived, never stored

A seasoning mix is a `Recipe` ([ADR-010](./010-flavour-lab-as-a-lens.md)). Its profile is the
union of its non-optional lines' tags, computed on read:

```
flavourProfile(recipe) = union of flavourTags over non-optional lines
```

No stored field, so it can never go stale when an ingredient is retagged or a line is removed.
This is decision 23 applied to metadata rather than to numbers.

A union is deliberately crude — it says a mix containing lime and chilli is sour and spicy,
without claiming to know the balance. Weighting tags by each line's mass was considered and
rejected: mass is a poor proxy for perceived intensity (a gram of chilli flakes outweighs
thirty grams of cucumber sensorially), so weighting would dress a guess as a computation. If
the balance matters, the user writes it in the recipe notes, which is where a human judgement
belongs.

### 5. Constraints are **derived from the figures we hold**, not stored as opinions

The proposed `constraints` field is replaced by computed predicates over data that already
exists:

| Predicate | Rule | Source of the figure |
| --- | --- | --- |
| `calorieDense` | `kcal per 100 g ≥ 400` | Existing nutrition |
| `highSodium` | `sodiumMg per 100 g ≥ 600` | [ADR-007](./007-sodium-as-a-nullable-nutrient.md) |
| `sodiumUnknown` | `sodiumMg is null` | ADR-007 |

Three thresholds, defined once in `domain/`, applied everywhere, and changeable in one place.
They exist to make an ingredient's own numbers legible at a glance — the brief's real ask was
*"make it easy to see when a flavour combination is being made calorie-dense by one
ingredient"*, and that is an arithmetic question about tahini's 607 kcal, not a property
someone needs to assert about tahini.

Stored constraints would duplicate figures the row already carries, and would go stale the
moment a user corrects the nutrition behind them.

### 6. What is deliberately **not** modelled

Recorded so no later ticket quietly adds it.

| Proposed | Why not |
| --- | --- |
| **Allergens** | A partial allergen list is more dangerous than none. It invites reliance the data cannot support, across 2,900+ rows neither dataset annotates for the 14 UK regulated allergens. If it is ever built it needs its own ADR, a complete source, and explicit UI framing — not a nullable field added in passing. |
| Sweetener exposure, ADI figures | Unverifiable per-user, and squarely a health claim. The brief asks us to "avoid making unsupported health claims" and this is the clearest case of one. |
| Caffeine, iodine, tooth-enamel acidity, GI tolerance | Each is a nutrient or a clinical judgement. Caffeine and iodine are nutrients, and if they are ever wanted the answer is a nullable field in `Nutrition` with a cited source, exactly as ADR-007 did for sodium — not a free-text caution. |
| Spice/heat intensity (Scoville or similar) | Neither dataset carries it, so it would be invented. `spicy` as a tag is an honest statement; "7/10 heat" is not. |
| A single health score or "reward per calorie" ranking | The brief rules it out and so does the product's existing stance. Preserve the attributes; let the user trade them off. |

Anything genuinely important that this excludes has a home already: the ingredient's `notes`
field, in the user's own words, where nothing pretends it is structured data. That is the right
place for "garlic in oil — keep refrigerated, use within a week", which is a real food-safety
caution and not something the app should be computing.

## Consequences

**Positive.** One new field and three pure predicates buy the entire query surface the feature
needs. Nothing stored can contradict the nutrition figures, because nothing about the
constraints is stored. The excluded branch — allergens, ADIs, tolerances — was the part of the
external brief with the worst ratio of liability to usefulness, and dropping it removes a
permanent maintenance burden.

**Negative.** Someone has to tag 200-odd ingredients by hand, and taste is subjective, so the
tagging will be argued with. It is editable, which is the answer. Coverage will also be uneven:
pack flavour ingredients tagged, the CoFID long tail mostly not — acceptable, since the long
tail is chicken breast and boiled potatoes, which nobody filters by flavour.

**Cost and risk.** The risk is vocabulary drift: a seventeenth tag, then a twentieth, until the
filter is unusable. Sixteen is enough, it is the brief's own list, and adding to it should take
an ADR amendment rather than a commit.

## Verification

1. `IngredientSchema` rejects a tag outside the sixteen; an empty array is valid.
2. **Tag invariance** — requirements, shopping, availability, nutrition, `expand()` and every
   insight are byte-identical with tags permuted across a corpus. The governing test.
3. `flavourProfile` of a mix equals the union of its non-optional lines' tags, and changes
   immediately when an ingredient is retagged. Optional lines are excluded, as they are from
   headline nutrition.
4. `calorieDense` is true for tahini (607 kcal) and false for vinegar (22 kcal) using the
   seeded figures.
5. `highSodium` is false when `sodiumMg` is null — unknown is not high, and `sodiumUnknown`
   reports it separately.
6. The tag map resolves: every key matches a seeded ingredient, and a key matching nothing
   fails the build (the R2.5b rule, reused).
