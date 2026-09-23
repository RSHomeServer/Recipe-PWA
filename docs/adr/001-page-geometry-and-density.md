# ADR-001: Page geometry, width roles and information density

## Status

Accepted. Supersedes nothing; makes explicit what [DESIGN.md](../planning/DESIGN.md) §5 left
implicit and what the V1 implementation therefore got wrong.

## Context

V1 shipped with correct tokens and a correct visual language, but with three geometry defects
that make every screen feel unfinished. All three are traceable to specific code.

### Defect 1 — every page is pinned to the left edge

```css
.app-main { display: flex; flex-direction: column; }
.app-page { flex: 1; padding: var(--space-8) var(--page-padding-inline);
            max-width: var(--workspace-max); }
```

`.app-page` sets a `max-width` but no `margin-inline`. In a column flex container the cross
axis is horizontal, so a child capped by `max-width` is placed at the cross-axis start — the
left. On a 2560px display the sidebar takes 248px, the page caps at 90rem (1440px), and the
remaining ~870px becomes dead space on the right of *every route*. This is the "substantial
margin of several cm for no reason".

### Defect 2 — one width for all content

Every route uses `.app-page`, so a two-field settings form, a prose-heavy recipe method and a
seven-column planner all get the same 90rem. DESIGN.md §5 already distinguishes
`--content-max` (72rem) for forms and prose from `--workspace-max` (90rem) for grids, but
nothing in the code expresses that distinction, so the wide value won everywhere. A form field
stretched to 1400px is unreadable, and a recipe list row with the name at the far left and the
macros at the far right forces a 1300px eye movement to associate two facts.

### Defect 3 — the plan grid is below its own minimum viable width

```tsx
<div className="grid grid-cols-7 gap-2">
```

Seven equal columns activate at the `md` breakpoint (48rem / 768px). Subtract the 248px
sidebar and 2×48px page padding and each day column is roughly 55px wide with an 8px gutter.
Into that column, `PlanSlotTile` renders a 32px icon, a title, a subtitle, an uppercase
category label *and* a wrapped hint sentence, and `SortableMealCard` adds a 44px drag handle,
a 44px delete button and a full-width "Move to…." select. That is around 150px of controls and
four lines of repeated explanatory text per tile, in a 55px column, 28 times over. The result
is unreadable regardless of how good the tokens are.

The hint text is the subtler half of the problem: text that is genuinely useful once, in a
composer, becomes visual noise when repeated in all 28 cells of a grid.

## Decision

### 1. Pages centre, always

`.app-page` gains `margin-inline: auto` and `width: 100%`. This is a two-line fix and it
resolves the complaint about every route at once.

### 2. Width is a role, not a constant

Three page widths, chosen by what the route contains, expressed as modifier classes rather
than ad-hoc values:

| Role | Token | Used by |
| --- | --- | --- |
| `--page-width-prose` | `--content-max` narrowed to **48rem** | Single-column forms, settings, ingredient and recipe editors, any route whose primary content is a form or prose |
| `--page-width-content` | `--content-max` (**72rem**) | Lists and detail pages: recipes, ingredients, pantry, cook, log |
| `--page-width-workspace` | `--workspace-max` (**90rem**) | Genuine two-dimensional layouts only: plan grid, insights, shopping |

A route may not invent a fourth width. Content that wants to be wider than its role is a sign
the route is doing two jobs and should be split.

### 3. The plan grid has a minimum column width, and the breakpoint follows from it

A day column must be at least **11rem (176px)** to hold a tile legibly. The grid therefore does
not render seven columns until the available width supports seven of them:

| Viewport | Layout |
| --- | --- |
| `< md` | One day at a time, with the existing horizontal day switcher. Unchanged. |
| `md` – `xl` | Horizontally scrollable day track: `grid-auto-flow: column; grid-auto-columns: minmax(11rem, 1fr)`, with the current day scrolled into view and scroll-snap on column boundaries. |
| `≥ xl` (80rem) | The full seven-column grid, `gap: var(--space-3)`. |

Choosing seven columns at 48rem was the error. The breakpoint is derived from the content's
minimum width, not picked from the default scale.

### 4. Explanatory text belongs where the choice is made, not where the result is displayed

`PlanSlotTile` drops the `hint` line and the uppercase category label from its default
rendering. The cook/portion/item distinction is carried by its icon and surface treatment,
which DESIGN.md §6 already requires and which already works. The full explanation moves to the
composer, where the user is actually choosing (see [ADR-003](./003-food-nomenclature-and-promotion-rule.md)
for the wording and [ADR-005](./005-choice-controls-by-cardinality.md) for the control).

`PlanSlotTile` keeps a `density` prop: `"comfortable"` (composer, mobile day view, log) renders
the subtitle; `"compact"` (week grid) renders title and icon only, with the rest in an
accessible name and an info popover on tap.

### 5. Per-tile controls collapse into one overflow menu

The drag handle stays — it is the direct-manipulation affordance. Delete and "Move to…" move
into a single 44px icon button opening a `DropdownMenu`. This removes roughly 100px of
permanent chrome per tile and satisfies DESIGN.md §9 rule 5 (keyboard parity) better than the
current bare select, because the menu is keyboard-navigable by construction.

### 6. List rows cap their measure

A list row's content does not span more than **72rem**, and the right-aligned numeric column
is separated from the label by no more than `--space-8`. Where a row would be wider, the
numeric group sits in a fixed-width column rather than being pushed to the far edge.

## Consequences

Positive: the right-hand gap disappears everywhere from one CSS fix; forms become readable;
the plan grid becomes usable at every viewport rather than only above 80rem; the 28-cell grid
loses roughly 112 lines of repeated hint text.

Negative: between `md` and `xl` the planner requires horizontal scrolling to see all seven
days. This is the correct trade — a scrollable track of legible days beats seven illegible
ones — but it must be signalled (scroll-snap plus a visible partial column at the edge), and
the day switcher must remain a keyboard path to any day.

Cost: `PlanSlotTile`'s API changes, so `PlanPage` and `LogPage` both need updating. The
`density` prop is additive with a `"comfortable"` default, so the change is mechanical.

## Verification

1. At viewport widths of 1280, 1920 and 2560px, every route's content is horizontally centred
   and the left and right gutters differ by no more than 1px.
2. No route renders a form control wider than 48rem.
3. At 768px, 1024px and 1440px, every plan day column measures at least 176px.
4. `PlanSlotTile` in `compact` density renders at most two lines of text.
5. The existing keyboard-parity test for the planner still passes with the overflow menu in
   place of the bare select.
