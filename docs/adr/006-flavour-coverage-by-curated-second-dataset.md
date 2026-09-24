# ADR-006: Flavour coverage by curated selection from a second dataset

## Status

Accepted. Extends [ADR-002](./002-reference-ingredient-data-and-provenance.md) without
reversing any part of it. First decision of V3.

## Context

The product owner's goal for V3 is an arsenal of **flavour per calorie**: seasonings, sauces
and toppings that make a cucumber, a rice cake or a bowl of plain yoghurt worth eating instead
of a packet of crisps. The whole idea rests on the flavour layer being *present* in the
ingredient library. If the user searches "smoked paprika" and finds nothing, the feature has
failed before any UI is written.

V2 seeded 2,852 CoFID entries with 150 marked `common` (R2.5–R2.9b). The obvious assumption
was that a UK composition table of that size already covers seasonings, and that V3 is
therefore a UI-and-metadata job. **That assumption is wrong, and it was checked rather than
believed.**

### What the shipped pack actually contains

Audited directly against `public/starter-pack/pack.json` at commit `9f401a2`.

Present, and better than expected — CoFID has a genuine herb and spice section:

| Group | Entries found |
| --- | --- |
| Herbs, fresh and dried | basil, bay, coriander leaf, dill, marjoram, mint, mixed herbs, parsley, rosemary, sage, tarragon, thyme |
| Spices and dry seasoning | cayenne (ground), curry powder (two), curry paste, garlic powder, ginger (ground), mustard powder, saffron |
| Wet condiments | soy sauce, Worcestershire sauce, chilli sauce, tomato ketchup, brown sauce (reduced salt/sugar), horseradish sauce, mint sauce, tomato purée, pesto (three), piccalilli, fat-free French dressing |
| Acids and umami | vinegar, lemon juice, lime juice, yeast extract, nori and kombu, gherkins, tamarind |
| Calorie anchors | salt (0 kcal), sesame oil, tahini, mayonnaise (three grades), the full oils range |

Absent entirely — every one of these returns **zero** matches:

| Missing | Why it matters here |
| --- | --- |
| paprika, smoked paprika | The single most useful low-calorie seasoning in the brief |
| cumin, coriander seed, turmeric, cinnamon, cardamom, cloves, nutmeg, allspice, star anise, fenugreek, sumac | The entire warm-spice shelf |
| black pepper, white pepper | Table seasoning; CoFID has capsicum peppers, not peppercorns |
| oregano | Common dried herb, present in every supermarket |
| chilli flakes, chilli powder, gochugaru | Only "chilli sauce" exists as a prepared product |
| onion powder | Garlic powder is present; its pair is not |
| MSG | Named explicitly in the brief |
| miso, fish sauce, oyster sauce, hoisin | The savoury-depth shelf |
| hot sauce, Tabasco-style, sriracha, gochujang, harissa | The heat shelf |
| stock cubes and bouillon powder | Only "stock, chicken, ready made" (12 kcal/100 g, a liquid) |
| nutritional yeast | Distinct from the yeast extract that is present |
| non-sugar sweeteners | No stevia, sucralose, aspartame, erythritol or xylitol |
| capers, balsamic / cider / rice / wine vinegars | CoFID carries exactly **one** generic "Vinegar" |

The shape of the gap is the problem, not its size. The missing entries are concentrated in
exactly the high-flavour, near-zero-calorie band the feature exists to exploit, while the
entries CoFID does carry skew towards prepared retail products — 44 of the 198 entries in
*Oils & condiments* under 60 kcal/100 g are **soups**.

### The three ways to close it

| Option | Cost | Why it was or was not taken |
| --- | --- | --- |
| Hand-enter ~40 ingredients with `source.kind: "estimated"` | Half a day | **Rejected.** ADR-002 R2.5 says nothing is transcribed by hand, and the brief itself says "do not fabricate precision". Forty hand-typed figures in the flavour layer would be the least trustworthy data in the product sitting in its most-used screen. |
| Wait for a UK dataset that covers spices | Unbounded | **Rejected.** CoFID 2021 is the current edition; this is not a release-timing gap. |
| A second transcode pass over a second cited dataset | One script, one allow-list | **Taken.** |

## Decision

### 1. A second starter pack, transcoded from USDA FoodData Central SR Legacy

ADR-002 already sanctioned USDA as an acceptable source — "the two are interchangeable as far
as this design is concerned … and `source` records which one was used either way". That
settles whether we may use it. This ADR settles that we use it **in addition to** CoFID rather
than instead of it.

SR Legacy is the right slice of FDC: it is the descendant of the old SR28 reference table,
its *Spices and Herbs* group covers the entire missing warm-spice shelf, it is **CC0 public
domain** so there is no licence ambiguity of the kind R2.12 is still resolving for CoFID, and
its figures are per 100 g exactly as CoFID's are.

The known costs, recorded so nobody rediscovers them mid-ticket:

- **US naming.** "Spices, paprika" and "Peppers, hot chili, red". The transcode maps to a
  readable UK name; `source.entryName` keeps the original verbatim, as ADR-002 requires.
- **Frozen at April 2018.** Acceptable: the composition of ground cumin is not a moving
  target.
- **A three-way join** across `food.csv`, `nutrient.csv` and `food_nutrient.csv` rather than
  one row per food.

### 2. Curate the **selection**, never the numbers

This is the load-bearing distinction of this ADR.

```
Hand-authored:   which FDC entries to include        (a list of ids)
Script-derived:  every nutrition figure, every name, every provenance field
```

The second pack is driven by a hand-maintained allow-list of FDC ids, mirroring the
`common-codes.json` pattern that ticket 5 already established and proved. Expect **60–120
entries**, not thousands: this pack exists to fill named holes, not to seed a second
composition table on top of the first.

A listed id matching nothing in the downloaded dataset **must fail the build**, exactly as
R2.5b requires of the common-code list. Otherwise the pack silently shrinks when USDA
renumbers something.

Hand-picking ids is not hand transcription and does not weaken ADR-002. The rule ADR-002
protects is that *no human types a nutrition figure*; choosing which published rows are
relevant to a UK kitchen is editorial work that a script cannot do and that carries no risk of
a wrong number.

### 3. CoFID wins every collision

Both datasets contain garlic powder, mustard powder and soy sauce. The rule is mechanical and
needs no judgement at seed time:

- The flavour pack's allow-list **must not** contain an id whose food is already covered by a
  seeded CoFID entry. A build-time check asserts this against a small hand-maintained
  equivalence map and fails on overlap.
- Seeding remains additive and keyed on `datasetId::entryCode` (R2.7), so even if an overlap
  slipped through, the user would get two rows rather than a corrupted one — a visible,
  recoverable failure rather than a silent one.

CoFID wins because the product is UK-facing and a UK table's "soy sauce" is the bottle in a UK
cupboard.

### 4. The pack is a second file, not an edit to the first

```
public/starter-pack/pack.json          cofid-2021      2,852 entries   (unchanged)
public/starter-pack/flavour-pack.json  usda-sr-legacy  60–120 entries  (new)
```

Two files rather than one merged artefact, because:

- The CoFID pack is regenerated by `npm run starter-pack:generate` from a workbook that a
  developer must download. Merging would mean both source datasets present to rebuild either.
- `Settings.starterPackVersion` already gates the top-up. A second `flavourPackVersion`
  lets the flavour pack ship, grow and re-seed on its own cadence.
- Provenance stays legible: one file, one dataset, one licence, one citation.

Both packs seed through the **same** `seedStarterPack` path and the same additive rules. This
is a second input to an existing mechanism, not a second mechanism.

### 5. Every flavour entry is `common: true`

The 150-entry common tier exists because a 2,852-row composition table is unusable as a picker
(R2.9a). The flavour pack has the opposite property: every entry in it was hand-selected
*because* the user is expected to reach for it. Marking the whole pack `common` costs nothing
and is what makes "smoked paprika" appear as the first result rather than behind "show all".

### 6. What is still missing afterwards, and why that is correct

USDA does not carry gochujang, gochugaru or harissa as generic foods, and its sweetener
coverage is uneven. Those remain user-entered, and V3 does nothing special for them beyond
what ADR-002 already provides: the user adds them from the pack label as
`source.kind: "packaging"`. That is the honest answer for a branded product with no generic
composition, and it is unchanged from V2.

## Consequences

**Positive.** The flavour layer becomes real without a single hand-typed calorie. Every entry
carries a citation and a URL exactly as the CoFID entries do, so the provenance display built
in ticket 6 works on them with no change. The licence position improves rather than
degrades — CC0 needs no attribution gate of the kind R2.12 is still waiting on.

**Negative.** Two datasets in one ingredient list means two naming conventions, visible to the
user if they look. Mitigated by mapping to readable UK names at transcode time and keeping the
original in `source.entryName`, but a determined reader will find "Spices, paprika" behind
"Paprika". Accepted: a slightly uneven name is a far smaller defect than an absent spice or an
invented figure.

**Cost and risk.** The risk profile is the same one ADR-002 identified and is mitigated the
same way: the danger is in the *mapping*, not the copying, so the spot-check tests are not
optional. One addition specific to this pack — because it is small and hand-selected, a
**full-pack** spot check is affordable where CoFID's could only ever be a sample. Assert every
entry's kcal against its published figure rather than a handful.

## Verification

1. Build fails if any allow-listed FDC id resolves to nothing in the source dataset.
2. Build fails if an allow-listed id overlaps a seeded CoFID food per the equivalence map.
3. Every flavour-pack entry validates against `IngredientSchema` at build time (R2.9, reused).
4. Spot check **every** entry's kcal and `entryCode` against the published figures.
5. Seeding both packs into a fresh database produces no duplicate `datasetId::entryCode`, and
   re-running the top-up adds nothing the second time (R2.7 idempotence, reused).
6. The named gaps from the audit table above resolve to exactly one ingredient each after
   seeding: paprika, smoked paprika, cumin, turmeric, cinnamon, oregano, black pepper, onion
   powder, MSG, miso, fish sauce, nutritional yeast, capers, balsamic vinegar, cider vinegar.
   This is the test that says the feature's premise holds.
