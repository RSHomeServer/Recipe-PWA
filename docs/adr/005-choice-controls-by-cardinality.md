# ADR-005: Choice controls selected by option cardinality

## Status

Accepted. Refines V1 decision 25 and [DESIGN.md](../planning/DESIGN.md) §6 "Forms".

## Context

V1 renders every single-choice input as a native `<select>`, from "Slot" (four options) to
"Recipe" (unbounded) to "Move to…" (seven days × four slots = twenty-eight options). One
control for every job, and it is the wrong one at both ends of the range.

At the small end, a dropdown hides four options behind two interactions and a system popup,
when the four options would fit on one line and be readable at a glance. At the large end, a
native select is worse still: twenty-eight "Thu · Dinner" entries in a scrolling system list,
with no search, is the least usable way to pick a day and a slot.

The user's proposal — a toggle that switches dropdowns to buttons — is right about the small
end. The reason to go further is the large end: forty recipes as forty buttons is not an
improvement, and neither is forty recipes in a dropdown. That case needs search, which is a
third control, not a toggle between two.

## Decision

**The control follows from how many options there are.** This is a rule in the design system,
not a per-screen judgement and not primarily a user setting.

| Options | Control | Where it applies |
| --- | --- | --- |
| **1** | Static text, no control | A unit family with one member; a slot list of one |
| **2–6** | **Segmented button group** | Slot, "where's this coming from?", unit, measure kind, shopping-window preset, day-of-week switcher, group-by choice |
| **7–15** | Button grid if labels are short, otherwise combobox | Ingredient category; meal slots once custom slots exist |
| **> 15 or unbounded** | **Command palette** — search-first, with recents pinned | Recipe, ingredient, batch, meal template, "move to…" target |

### Segmented button group

A single-select group of buttons, always visible, laid out inline and wrapping.

- Built on Radix `ToggleGroup` (`type="single"`), giving `role="radiogroup"` with roving
  tabindex and arrow-key navigation for free. It is **not** a row of `<button>`s, which would
  be a keyboard regression against the select it replaces.
- 44px minimum height per DESIGN.md §7; wraps rather than scrolls; the selected item carries
  `--color-accent-muted` with an `--color-accent` label **and** a check affordance, never
  colour alone (§9 rule 2).
- Icons are permitted alongside labels and never instead of them, except where the label is
  also given as an accessible name and a tooltip (§9 rule 10).
- Options carry optional helper text, rendered under the group for the selected option. This
  is how the [ADR-003](./003-food-nomenclature-and-promotion-rule.md) §3 explanations reach
  the user without repeating three sentences on screen at once.
- A disabled option **stays visible with its reason given** rather than being removed. "No
  batches yet" teaches the model; a missing option teaches nothing.

### Command palette

shadcn `Command` inside a `Dialog` — a bottom sheet under `md`, a centred dialog at and above.

- Opens focused on a search field; typing filters; arrow keys and Enter select.
- **Recents pinned at the top** before any query is typed, from the same derivation as
  [ADR-004](./004-meal-templates-by-expansion.md) §5.
- Each row carries the secondary facts that make the choice: a recipe shows per-serving kcal
  and its availability state; an ingredient shows its category and pantry quantity; a batch
  shows portions remaining and when it was cooked. A row in a palette can say what an
  `<option>` never could, which is most of the reason to use one.
- The trigger is a button showing the current selection, not an empty search box, so the
  field's value is legible without opening anything.
- Never used for fewer than seven options. A search box in front of four choices is worse
  than the four choices.

### The escape hatch

`Settings` gains:

```ts
controlStyle: "adaptive" | "compact";   // default "adaptive"
```

`"compact"` forces native `<select>` everywhere the table above would use a segmented group,
for very small screens and for preference. It does **not** affect the command palette, because
no native control does that job.

The rule is the default rather than the setting because a preference that most users never
open is not a design; it is a way of avoiding one. The setting exists so that the choice is
recoverable, not so that it is load-bearing.

### What does not change

Multi-select stays as checkboxes. Free text stays as text. Numeric entry keeps
`inputMode="decimal"` and its steppers. Dates keep the native date input. This ADR is about
single-choice-from-a-known-set and nothing else.

## Consequences

Positive: the highest-frequency small choices lose an interaction each; the large choices gain
search and context they could never have had in a `<select>`; the decision is made once in the
design system rather than argued per screen.

Negative: two new components to build and maintain in `src/ui/`, plus a migration of roughly a
dozen call sites. Both are mechanical.

Negative: segmented groups consume more vertical space than a collapsed select. On a phone,
"where's this coming from?" becomes three stacked buttons where it was one row. This is
accepted — it is the composer's central question, and seeing all three options is how the
user learns the model ([ADR-003](./003-food-nomenclature-and-promotion-rule.md) §3).

Risk: the command palette is the one component here that can regress accessibility if built
carelessly. It must have an accessible name, a full keyboard path, and focus returned to the
trigger on close. This is covered by an explicit test rather than review.

## Verification

1. No `<select>` remains in `src/features/` for a choice of six or fewer options while
   `controlStyle` is `"adaptive"`.
2. The segmented group exposes `role="radiogroup"`, moves selection with arrow keys, and
   places exactly one tab stop in the tab order.
3. Every segmented option meets 44 × 44px at 320px viewport width and wraps rather than
   overflowing.
4. The command palette is fully operable by keyboard: open, type, arrow, select, escape, with
   focus returned to the trigger.
5. Recipe, ingredient and batch pickers show recents before any query, and each row renders
   its documented secondary facts.
6. Setting `controlStyle` to `"compact"` restores native selects for the 2–6 case and leaves
   palettes unchanged.
7. Disabled options remain in the accessibility tree with their reason as part of the
   accessible name.
