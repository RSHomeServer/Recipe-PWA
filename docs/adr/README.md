# Architecture Decision Records — Recipe PWA

Product-level decisions for **Recipe PWA**. These are distinct from the platform ADRs in
[`PWA-Base/docs/adr`](../../../PWA-Base/docs/adr/README.md), which govern the shared
foundation. Where both apply, the PWA-Base ADR constrains and this one refines.

## Why this directory exists

V1 recorded its decisions as a numbered list (decisions 1–25 and A–E) embedded in
[DOMAIN_MODEL.md](../planning/DOMAIN_MODEL.md) and
[OPEN_QUESTIONS.md](../planning/OPEN_QUESTIONS.md). That worked while every decision was
made in one planning pass and nothing had shipped.

V2 is different: it **revisits** shipped behaviour in response to use. A numbered list with no
status field and no supersession mechanism cannot express "decision 4 still holds, but here is
the boundary case it did not anticipate". So from V2 onward, any decision that changes,
constrains or reinterprets a V1 rule gets an ADR. The V1 decision list stays exactly as it is
and remains authoritative for everything an ADR does not touch.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [001](./001-page-geometry-and-density.md) | Page geometry, width roles and information density | Accepted |
| [002](./002-reference-ingredient-data-and-provenance.md) | Reference ingredient data and per-ingredient provenance | Accepted, confirmed by product owner |
| [003](./003-food-nomenclature-and-promotion-rule.md) | Food nomenclature and the ingredient→recipe promotion rule | Accepted |
| [004](./004-meal-templates-by-expansion.md) | Meal templates by expansion, not by nesting | Accepted, confirmed by product owner |
| [005](./005-choice-controls-by-cardinality.md) | Choice controls selected by option cardinality | Accepted, amended by product owner |
| [006](./006-flavour-coverage-by-curated-second-dataset.md) | Flavour coverage by curated selection from a second dataset | Accepted |
| [007](./007-sodium-as-a-nullable-nutrient.md) | Sodium joins the nutrition record, and unknown is not zero | Accepted |
| [008](./008-kitchen-spoons-as-an-entry-time-conversion.md) | Kitchen spoons are an entry-time conversion, not a unit family | Accepted |
| [009](./009-sensory-tags-and-derived-constraints.md) | Sensory tags are curated reference metadata; constraints are derived | Accepted |
| [010](./010-flavour-lab-as-a-lens.md) | The Flavour Lab is a lens over existing entities, not a section of its own | Accepted |

ADRs 001–005 are V2; 006–010 are V3 and specify the Flavour Lab. The build specifications are
[V2_SCOPE.md](../planning/V2_SCOPE.md) and [V3_SCOPE.md](../planning/V3_SCOPE.md).

### Product-owner confirmations

Four calls in ADR-002, ADR-004 and ADR-005 were drafted ahead of confirmation and have since
been settled. Recorded here because two of them changed the draft:

| Question | Outcome |
| --- | --- |
| Seed dataset | **CoFID, with USDA as a sanctioned fallback** — both were accepted, so ADR-002 no longer treats this as an escalation. Priority is "a wide base of accurate ingredients at MVP pace", which is why the pack is now script-transcoded rather than hand-curated, and why it seeds several hundred entries behind a curated `common` tier rather than 150 flat. |
| Ingredient photos | **Category icon default plus optional user photo** — as drafted. Sourced photography stays out; breadth of accurate data was explicitly preferred over pictures. |
| Saved meals | **Expansion**, as drafted. No first-class `Meal` entity, no recipe nesting. |
| Control style | **The cardinality rule, with no setting.** The draft's `Settings.controlStyle` escape hatch was removed. See ADR-005 §"No setting" for what that obliges of the segmented group. |

Brand-specific products are the user's job in V2 (`source.kind: "packaging"`). Automated
brand onboarding is a considered follow-up, not MVP scope.

## Relationship to the V1 decision list

| V1 decision | Status after V2 and V3 |
| --- | --- |
| 1 Ingredients are the unit of nutrition truth | Holds. Extended by ADR-002 (`source`, `imageId`) and by ADR-008/009 (`gramsPerTsp`, `gramsPerTbsp`, `flavourTags`) — all reference metadata, none read by a calculation. |
| 2 Three unit families, in-family conversion only | Holds. ADR-008 adds spoons as an **entry-time conversion from a cited weight**, not a fourth unit. `UNITS`, `Unit` and `CanonicalQuantity` are unchanged, and cross-family (ml ↔ g) conversion stays excluded. |
| 3 Fixed nutrition basis per 100 g / 100 ml / item | Holds. ADR-007 adds a nutrient on the same basis. |
| 4 Recipe lines reference ingredients only; **no nesting** | Holds. ADR-004 satisfies the "combined meal" need without reversing it; ADR-010 builds the Flavour Lab's snacks on the same expansion rather than nesting a sauce inside a snack. ADR-003 adds the promotion rule. |
| 7 Batch fields | Holds. ADR-003 renames it in the UI only; the entity is unchanged. |
| 14 Plan is intent; slots are data | Holds. ADR-004 adds a display-only `group` field to `PlannedMeal`. |
| 21 Four nutrition values in V1, record extensible | **Extended as anticipated.** ADR-007 adds `sodiumMg`, nullable, with `null` meaning unknown rather than zero. |
| 23 Derive, don't duplicate | Holds, and is the governing constraint on ADR-004, ADR-008 §5 (no stored per-spoon kcal) and ADR-009 §4–5 (derived mix profiles and derived constraints). |
| 24 Out of scope | Partially revisited twice: external food databases moved to in-scope as **seeded packs** (ADR-002, extended to a second dataset by ADR-006). Everything else in decision 24 is unchanged. |
| 25 shadcn/ui owns the interactive layer | Holds. ADR-005 specifies which shadcn primitives and when; ADR-010's filters follow the same cardinality rule. |
| A–E (open-question resolutions) | All hold unchanged. |

### The invariance family

Six fields are now stored for display, search or ordering, and **read by no derivation**.
Each is guarded by the same property test — permute it across a corpus and assert every
derived result is byte-identical:

`Ingredient.source` · `Ingredient.common` (R2.2) · `PlannedMeal.group` / `LoggedMeal.group`
(R4.3) · `Ingredient.flavourTags` (R4.3 of V3) · `RecipeLine.entryHint` (R3.6) ·
`Recipe.kind` (R5.6)

Anything added to this list must arrive with its test. The pattern is what keeps presentation
metadata from leaking into the calculation core.

## No PWA-Base ADR changes are required

Each V2 decision was checked against the platform ADRs:

- **ADR-001 (page geometry)** consumes `--content-max`, `--workspace-max` and
  `--page-padding-inline`, which already exist in
  `PWA-Base/packages/ui/src/tokens/tokens.css`. The bug is app-local CSS, not a missing token.
- **ADR-005 (choice controls)** needs segmented groups, comboboxes, command palettes and
  popovers. PWA-Base ADR-008 and its design-system doc deliberately defer interactive
  components to consumers, and explicitly permit Tailwind at app level. Building these from
  shadcn/Radix in `src/ui/` is the sanctioned path, not a deviation.
- **ADR-002** adds no dependency and no platform capability; the starter pack is a static JSON
  asset parsed through existing Zod schemas.
- **ADR-004** is entirely within the product's domain model.

The V3 decisions were checked the same way and need nothing from the platform either:

- **ADR-006** adds a second static JSON asset and one devDependency-only CSV reader for the
  transcode. Nothing new reaches the browser.
- **ADR-007**, **ADR-009** and **ADR-010** are entirely within the product's domain model.
- **ADR-008** reuses the existing app-level quantity input; no new primitive.

If a second Songara app later needs the segmented control or the command palette, that is the
point at which ADR-003's two-consumer rule and ADR-008's Preview channel apply. Not now.
