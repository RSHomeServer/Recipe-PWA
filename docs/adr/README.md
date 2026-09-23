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
| [002](./002-reference-ingredient-data-and-provenance.md) | Reference ingredient data and per-ingredient provenance | Accepted |
| [003](./003-food-nomenclature-and-promotion-rule.md) | Food nomenclature and the ingredient→recipe promotion rule | Accepted |
| [004](./004-meal-templates-by-expansion.md) | Meal templates by expansion, not by nesting | Accepted |
| [005](./005-choice-controls-by-cardinality.md) | Choice controls selected by option cardinality | Accepted |

## Relationship to the V1 decision list

| V1 decision | V2 status |
| --- | --- |
| 1 Ingredients are the unit of nutrition truth | Holds. Extended by ADR-002 (adds `source`, `imageId`). |
| 2 Three unit families, in-family conversion only | Holds unchanged. |
| 4 Recipe lines reference ingredients only; **no nesting** | Holds. ADR-004 satisfies the "combined meal" need without reversing it. ADR-003 adds the promotion rule that says when something should be a recipe at all. |
| 7 Batch fields | Holds. ADR-003 renames it in the UI only; the entity is unchanged. |
| 14 Plan is intent; slots are data | Holds. ADR-004 adds a display-only `group` field to `PlannedMeal`. |
| 23 Derive, don't duplicate | Holds, and is the governing constraint on ADR-004. |
| 24 Out of scope | Partially revisited: external food databases move from "No (V2-ready)" to in-scope as a **one-time seeded import**, per ADR-002. Everything else in decision 24 is unchanged. |
| 25 shadcn/ui owns the interactive layer | Holds. ADR-005 specifies which shadcn primitives and when. |
| A–E (open-question resolutions) | All hold unchanged. |

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

If a second Songara app later needs the segmented control or the command palette, that is the
point at which ADR-003's two-consumer rule and ADR-008's Preview channel apply. Not now.
