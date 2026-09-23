# DESIGN.md — Recipe PWA visual source of truth

Authoritative visual and interaction specification. Where this document and a component
disagree, this document wins; change it here first.

Reasoning behind these choices is in [DESIGN_RESEARCH.md](./DESIGN_RESEARCH.md).
Implementation wiring is in [ARCHITECTURE.md](./ARCHITECTURE.md).

> **V2 corrections.** §5 (widths), §6.2–6.3 (choice controls and explanation), §7.1–7.2 (plan
> grid and density) and §11 (ingredient identity) were revised after V1 shipped. Each is
> marked in place and traced to [ADR-001](../adr/001-page-geometry-and-density.md),
> [ADR-002](../adr/002-reference-ingredient-data-and-provenance.md),
> [ADR-003](../adr/003-food-nomenclature-and-promotion-rule.md) or
> [ADR-005](../adr/005-choice-controls-by-cardinality.md). All other sections stand as
> written; the V1 critique found the direction right and the geometry wrong.

Colour values below are **provisional pending contrast verification in both themes** during
the UI-foundation ticket. The **token names are the contract**; hex values may be tuned to
meet the contrast requirements in §9. Nothing in the product references a raw hex value.

## 1. Design intent

| Should feel | Must never feel |
| --- | --- |
| Fresh, warm, calm | Clinical, cold, corporate |
| Practical — a working tool | Like a marketing page |
| Food-focused | Like a fitness or medical app |
| Data-rich and legible | Like a spreadsheet |
| Quietly distinctive | Like a template |

Two design facts drive every decision that follows:

1. **Type, colour, spacing and numbers carry the design — never imagery.** Recipes may have a
   user-supplied image (decision 4), but images are **strictly optional and never structural**:
   no layout reserves image space, no grey placeholder appears where one is absent, and a
   recipe without an image must look deliberate rather than broken. See §11.
2. **This product reports; it does not judge.** No grades, scores, rings, streaks or
   goal framing. A user may set an optional daily calorie target (decision 20); it is presented
   as three plain figures, never as a scoreboard — see §8.4. Consequence: macro colours are
   **categorical, never evaluative**.

## 2. Token foundation

`@songara/pwa-base/ui/tokens.css` is the single source of truth and is imported **first**.
Recipe PWA overrides PWA-Base *semantic* tokens and adds new ones only where PWA-Base has no
equivalent (macro colours). Never introduce a parallel token system, and never hardcode a
value in a component.

Layering, per [ARCHITECTURE.md](./ARCHITECTURE.md):

```
@songara/pwa-base/ui/tokens.css   → PWA-Base semantic tokens (the source of truth)
  ↓ Recipe PWA overrides           → palette + display font, same token names
  ↓ new --color-macro-* tokens     → nutrition encoding (no PWA-Base equivalent)
  ↓ @theme inline                  → maps Tailwind + shadcn utilities onto the above
```

Dark mode is driven by PWA-Base `ThemeProvider` (`data-theme` + `.theme-*` on `<html>`), and
Tailwind's dark variant follows it:
`@custom-variant dark (&:is([data-theme="dark"] *))`. There is no `.dark` class in this
product.

## 3. Colour

### Palette rationale

A warm paper-and-earth palette. Every reference product in this category is either clinical
white or fitness black, so this is distinctive at near-zero cost — and warm neutrals make
dense numeric screens feel calm rather than austere.

**Herb green** is the single brand accent (it replaces PWA-Base's teal). Warm neutrals carry
surfaces. Earth tones carry data.

### Light theme (default)

```css
:root {
  /* Surfaces — warm paper, not white */
  --color-background:        #FBF8F3;
  --color-surface:           #FFFCF7;
  --color-surface-raised:    #FFFFFF;
  --color-surface-sunken:    #F4EFE6;

  /* Text */
  --color-foreground:        #23201C;   /* warm ink, not black */
  --color-muted:             #6E665C;
  --color-muted-foreground:  #6E665C;
  --color-muted-background:  #F4EFE6;

  /* Borders */
  --color-border:            #E4DCCF;
  --color-border-subtle:     #EFE8DC;
  --color-border-strong:     #CFC3B0;

  /* Accent + actions — herb green */
  --color-accent:            #2F6B4F;
  --color-accent-hover:      #275940;
  --color-accent-muted:      #E6EFE8;
  --color-accent-foreground: #FFFFFF;
  --color-primary:           #2F6B4F;
  --color-primary-hover:     #275940;
  --color-primary-foreground:#FFFFFF;
  --color-secondary:         #EFE6D8;   /* warm sand */
  --color-secondary-hover:   #E7DCC9;
  --color-secondary-foreground: #3B342B;

  /* Links + status */
  --color-link:              #2F6B4F;
  --color-link-hover:        #275940;
  --color-link-visited:      #4A7A62;
  --color-success:           #3E7A4F;
  --color-warning:           #B07A16;
  --color-error:             #A63A2B;
  --color-info:              #35657A;
  --color-focus-ring:        #2F6B4F;
}
```

### Dark theme

Warm charcoal, never blue-black. Accent lightens to hold contrast on dark surfaces.

```css
[data-theme="dark"] {
  --color-background:        #1A1815;
  --color-surface:           #221F1B;
  --color-surface-raised:    #2A2621;
  --color-surface-sunken:    #141210;

  --color-foreground:        #F2EDE4;
  --color-muted:             #A79C8D;
  --color-muted-background:  #2A2621;

  --color-border:            #35302A;
  --color-border-subtle:     #2A2621;
  --color-border-strong:     #4A4339;

  --color-accent:            #6FB08C;
  --color-accent-hover:      #85C0A0;
  --color-accent-muted:      #23342B;
  --color-accent-foreground: #10201A;
  --color-primary:           #6FB08C;
  --color-primary-foreground:#10201A;
  --color-secondary:         #302B24;
  --color-secondary-foreground: #F2EDE4;

  --color-success:           #6FB08C;
  --color-warning:           #D9A93F;
  --color-error:             #E0806E;
  --color-info:              #7FB0C4;
  --color-focus-ring:        #6FB08C;
}
```

### Macro colours — categorical, not evaluative

The most consequential colour decision in the product. These encode *which nutrient*, never
*how good it is*.

```css
:root {
  --color-macro-energy:  #3D372F;   /* graphite — calories */
  --color-macro-protein: #B5462F;   /* rust */
  --color-macro-carbs:   #8F5F07;   /* amber (darkened for AA on surface) */
  --color-macro-fat:     #3D6673;   /* slate (darkened for AA on surface) */
  --color-macro-none:    #6E665C;   /* unattributed (custom food) */
}
[data-theme="dark"] {
  --color-macro-energy:  #C9C0B2;
  --color-macro-protein: #D9705A;
  --color-macro-carbs:   #E8B85A;
  --color-macro-fat:     #7FB0C4;
  --color-macro-none:    #6E665C;
}
```

Three deliberate choices:

- **Rust / amber / slate** is a red–yellow–blue triad, which is the most reliably
  distinguishable set under deuteranopia and protanopia — the common forms of colour vision
  deficiency. An all-warm palette (rust / amber / olive) looked more cohesive and failed this
  test, so accessibility won.
- **No green in the macro set.** Green is the brand accent and the success colour. A green
  macro slice would read as "the good one", which is exactly the evaluative framing this
  product rejects.
- The slate is a muted, desaturated blue used for one chart series. This is not the
  purple/blue gradient aesthetic the brief prohibits, and the a11y benefit is decisive.

**Rules.** These five colours mean the same thing everywhere — chart series, table header
accents, badges, inline dots — so the association is learned once. They are never used for
non-nutrition purposes. `--color-macro-none` is always rendered for custom-food entries; the
unattributed share is never hidden.

### Availability colours

The three states from [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), using status tokens but **never
colour alone** (§9):

| State | Token | Also carries |
| --- | --- | --- |
| `canMake` | `--color-success` | Text "Ready to cook" + check icon |
| `almostCanMake` | `--color-warning` | The missing items **named with amounts** — "Missing: onion 50 g" |
| `missingSignificant` | `--color-muted` | Named shortfalls, muted, **not error red** |

Two rules. **Always name the shortfall with its amount**, per decision 11's example — "missing
3 ingredients" is nearly useless, "missing onion 50 g" is actionable. And **missing ingredients
is a neutral fact, not a failure**: red would scold the user for the contents of their own
fridge, and availability never gates an action.

## 4. Typography

| Role | Family | Token |
| --- | --- | --- |
| Display — recipe titles, key figures | **Fraunces** (variable serif) | `--font-family-display` (overrides PWA-Base Syne) |
| UI and body | **Source Sans 3** (PWA-Base default) | `--font-family-sans` |
| Aligned numeric columns | **IBM Plex Mono** (PWA-Base default) | `--font-family-mono` |

Fraunces is a variable serif with warmth and a slight editorial character — it reads as
cookbook rather than corporate, and does the work photography would normally do. Source Sans 3
is kept because it is already loaded by PWA-Base tokens and is an excellent, neutral UI face.

Loading: add Fraunces via `<link>` in `index.html` alongside the fonts PWA-Base `@import`s.
Restrict to the weights actually used (400, 600, 700) — this is a phone-first app and web
fonts are the largest avoidable payload.

### Scale

Use PWA-Base `--font-size-*` tokens. Role mapping:

| Use | Size token | Family | Weight |
| --- | --- | --- | --- |
| Recipe title, batch label | `--font-size-3xl` / `4xl` | display | 600 |
| Page title | `--font-size-2xl` | display | 600 |
| Section heading | `--font-size-lg` | sans | 600 |
| Body, list rows | `--font-size-base` (**never below 16px**) | sans | 400 |
| Secondary / metadata | `--font-size-sm` | sans | 400 |
| Labels, badges | `--font-size-xs` | sans | 500 |
| Hero figure (day kcal, portions left) | `--font-size-4xl` / `5xl` | display | 600, tabular |

Page titles are **modest**. Display sizes are for recipe titles and meaningful figures, never
for the word "Pantry".

### Numerals — a hard rule

**Every quantity, weight, calorie and macro figure uses tabular figures.**

```css
.num { font-variant-numeric: tabular-nums; }
```

Non-tabular digits make a column of weights jitter and are the fastest way to make a data
screen feel amateurish. Aligned numeric columns in tables use `--font-family-mono`; inline
figures use the sans with `tabular-nums`. Units are set at `--font-size-sm` in
`--color-muted` beside the figure — "**1.3** kg", not "1.3 KG".

Formatting rules for quantities and nutrition live in
[UNIT_MODEL.md](./UNIT_MODEL.md) and [NUTRITION_MODEL.md](./NUTRITION_MODEL.md), applied via
one shared formatter. Components must not invent their own rounding. The display rules, per
decision 3:

| Value | Rendered | Example |
| --- | --- | --- |
| Calories | Integer, never a decimal | `524 kcal` |
| Macros | One decimal place | `42.4 g` |
| Percentages | Integer | `45%` |
| Quantities | Promoted per [UNIT_MODEL.md](./UNIT_MODEL.md) | `1.2 kg`, `1.65 L` |

Rounded parts will not always sum to the rounded total. **Show the true total** and never fudge
the parts to reconcile — a footnote is better than a lie.

## 5. Spacing, layout, surfaces

### Spacing

PWA-Base `--space-*` scale only; no arbitrary values. Rhythm:

| Context | Space |
| --- | --- |
| Inside a control | `--space-2` / `--space-3` |
| Between related rows | `--space-2` |
| Between fields | `--space-4` |
| Between sections | `--space-8` |
| Page top/bottom | `--space-8` … `--space-12` |
| Page inline | `--page-padding-inline` |

Generous row height is what keeps tabular data from reading as a spreadsheet. List rows are
comfortable (min 44px, and 48px+ for anything tappable), not compressed.

### Widths

**Corrected in V2 — see [ADR-001](../adr/001-page-geometry-and-density.md).** V1 read this
table as advice and applied `--workspace-max` to every route, with no horizontal centring.
Both are now binding rules.

**Every page centres.** `.app-page` carries `margin-inline: auto` and `width: 100%`. A page
that sets a `max-width` without centring is pinned to the left of a column flex container,
which is what put a dead band of several centimetres down the right of every V1 route.

**Width is a role, not a constant.** Every route declares exactly one, and may not invent a
fourth. Content that wants to be wider than its role means the route is doing two jobs.

| Role | Width | Used by |
| --- | --- | --- |
| `prose` | 48rem | Single-column forms and prose: settings, ingredient editor, recipe editor |
| `content` | `--content-max` (72rem) | Lists and detail pages: recipes, ingredients, pantry, cook, log |
| `workspace` | `--workspace-max` (90rem) | Genuine two-dimensional layouts only: plan, insights, shopping |
| — | `--shell-sidebar-width` | Desktop sidebar |

A list row's content does not span more than 72rem, and a right-aligned numeric group sits in
a fixed-width column rather than being pushed to the viewport edge. Making the reader's eye
travel 1300px to associate a recipe name with its calories is not spaciousness.

### Surfaces and elevation

- Surfaces are **flat and opaque**. No shadow on a resting surface. No gradient fills
  anywhere. No blur, no translucency.
- Elevation means "genuinely floating": `--shadow-md` for popovers and dropdowns,
  `--shadow-lg` for dialogs and sheets, `--shadow-sm` for sticky bars only.
- Differentiate regions with `--color-surface` / `--color-surface-sunken` and spacing before
  reaching for a border.

### Radius

`--radius-sm` for badges, chips and inputs; `--radius-md` for buttons; `--radius-lg` for
cards and panels; `--radius-xl` for dialogs and sheets only. Nothing is a pill. A modest
radius keeps a data-dense tool feeling crisp — the "friendly pillow" treatment common in
consumer nutrition apps costs exactly the precision this product needs.

### Cards versus lists

**Default to lists.** A list is rows separated by `--color-border-subtle` dividers and
spacing — no border per row, no background per row.

A card is justified only when the thing is a **separable object with mixed content and its
own actions** — a batch (title, portions remaining, cooked date, log action) qualifies. An
ingredient row does not. Never nest a card inside a card.

## 6. Component conventions

### Ownership

Per [ARCHITECTURE.md](./ARCHITECTURE.md) and decision 25: shadcn/ui owns the
interactive layer (buttons, inputs, dialogs, sheets, popovers, command, tabs, tables, toasts,
checkboxes, switches, comboboxes, calendars, dropdowns, tooltips); PWA-Base owns tokens,
theme, app shell, site contract, and the display primitives `EmptyState`, `Skeleton`,
`Spinner`, `Stack`, `Divider`; Recharts owns charts; Lucide owns icons.

Before building a component: check `src/ui/`, then shadcn/ui, then PWA-Base primitives, then
Radix. Build new only when composing existing pieces genuinely cannot express it.

### Structure

```
src/ui/            shadcn primitives + app-local presentational components
src/features/<area>/components/   domain components (RecipeCard, MacroBar, PortionStepper)
```

Conventions: `cva` for variants, `cn()` (clsx + tailwind-merge) for class composition,
`data-slot` attributes for styling hooks, no `forwardRef` (React 19), props typed as
`React.ComponentProps<…>`.

### Domain components to standardise early

Defining these once prevents seven screens inventing seven treatments:

| Component | Purpose | Notes |
| --- | --- | --- |
| `Quantity` | Render a `CanonicalQuantity` | Owns the formatter; tabular; unit muted |
| `NutritionSummary` | kcal + P/C/F | Inline, row, and block variants |
| `MacroBar` | Proportional macro split | Horizontal stacked bar; the default macro visual |
| `AvailabilityIndicator` | Three-state availability | Colour + icon + named shortfalls |
| `PortionStepper` | Fractional portion input | 0.5 steps; large targets |
| `IngredientChip` | Pantry / picker chip | In-stock vs known-not-stocked states |
| `PlanSlotTile` | A planned meal | **Must** visually distinguish recipe-to-cook from batch-portion |
| `MealSlotSection` | Day → slot grouping | Shared by plan and log; iterates `mealSlots` data, never a hard-coded three |
| `AttributionList` | Ranked ingredient contribution + % | The headline insight (decisions 6, 22); used at recipe, day and week scope |
| `TargetReadout` | Target / consumed / remaining | §8.4; renders nothing when no target is set |
| `ShortfallNotice` | "You are missing 200g chicken" | Warn-and-proceed, with adjust-pantry and cook-anyway actions (decision 12) |
| `DateRangeControl` | The shopping window | §6.1; default today → +6 days, with nudge and preset affordances |

`PlanSlotTile` matters most: recipe-to-cook and batch-portion are the product's core
distinction, and if the planner renders them identically the differentiator is invisible.
Use different surface treatment and an icon, not a small badge — a cook tile reads as work to
do, a portion tile as food that already exists.

### 6.1 The shopping window

The shopping list is derived from a **user-chosen date range defaulting to today through the
next six days**. That range is a first-class part of the screen, because a list whose scope is
invisible is a list the user cannot trust.

The simplest UX that satisfies it, drawn from the shopping-list patterns in
[DESIGN_RESEARCH.md](./DESIGN_RESEARCH.md):

- **One line of text at the top of the shopping view**, stating the range in plain language —
  "Shopping for Tue 25 Aug – Mon 31 Aug" — acting as the control. Not a filter bar, not a pair
  of date inputs sitting permanently on screen.
- Tapping it opens a small popover with **two presets (next 7 days, next 14 days)** and a date
  pair for anything else. Presets cover the real cases; the date pair is the escape hatch.
- **Nudge affordances** beside the label for shifting a week forward or back, since "next
  week's shop" is the common variation.
- The range is **persisted per user**, so it survives navigation and reload. It is not a
  transient piece of view state.

Because ticks are scoped to the range ([DOMAIN_MODEL.md](./DOMAIN_MODEL.md)), changing it must
never look like data loss. If the outgoing range has ticked items, say so and offer to carry
them over — "8 ticked items in the previous range. Carry them over?" — rather than silently
emptying the list or silently reinterpreting the ticks.

### Forms

#### 6.2 Choice controls — the control follows the option count

**Added in V2 — see [ADR-005](../adr/005-choice-controls-by-cardinality.md).** V1 used a
native `<select>` for every single choice, from four meal slots to twenty-eight move-to
targets. This is a design-system rule, not a per-screen judgement:

| Options | Control |
| --- | --- |
| 1 | Static text, no control |
| 2–6 | **Segmented button group** — Radix `ToggleGroup type="single"`, so it is a real `radiogroup` with arrow-key navigation and one tab stop. 44px minimum, wraps rather than scrolls, selection shown by colour **and** a check. Supports per-option helper text rendered under the group. |
| 7–15 | Button grid if labels are short, otherwise combobox |
| >15 or unbounded | **Command palette** — shadcn `Command` in a `Dialog` (bottom sheet under `md`), search-first, recents pinned before any query, each row carrying the facts that make the choice |

A disabled option stays visible with its reason in its accessible name. A capability that
silently does not appear is a capability the user never learns exists.

`Settings.controlStyle: "adaptive" | "compact"` forces native selects back for the 2–6 case,
for very small screens and for preference. It defaults to `"adaptive"` and does not affect
palettes, because no native control does that job.

#### 6.3 Explanation is progressive and never depends on hover

Per [ADR-003](../adr/003-food-nomenclature-and-promotion-rule.md) §5, in order of intrusion:
persistent helper text under a field (the default, for anything that changes behaviour); a
44px info **`Popover`** for longer definitions, because it works on touch and by keyboard; a
dismissible "How this works" panel on Plan and Cook; and only then a hover `Tooltip`,
reserved for icon-only buttons on pointer devices and duplicating an existing `aria-label`.

**No information may exist only inside a hover tooltip** (§9 rule 2). Tooltips are the
tempting answer and they are invisible on the phone where this product is mostly used.

#### 6.4 Form mechanics

React Hook Form + Zod, reusing domain schemas. Labels always visible (never placeholder-only).
Errors below the field, in `--color-error`, referenced by `aria-describedby`, with
`aria-invalid`. Required fields marked in text, never with colour alone. Numeric inputs use
`inputMode="decimal"`. Unit selection sits adjacent to its amount field and offers only units
from that ingredient's family, so a cross-family entry is unreachable rather than an error to
recover from ([UNIT_MODEL.md](./UNIT_MODEL.md)).

Two forms carry more weight than the rest and deserve specific treatment:

- **The cook flow** pre-fills each ingredient quantity from the scaled recipe and lets the user
  adjust it, because the batch snapshot records what was *actually* used
  ([DOMAIN_MODEL.md](./DOMAIN_MODEL.md)). Pre-filled values must be immediately editable
  without a mode switch, and an edited row should read as deliberate rather than as an error.
  Most cooks change nothing, so the default path is one confirming tap.
- **Negative pantry stock** is a normal state, not a validation failure. Show the negative
  figure plainly with a one-tap "set to…" correction inline in the pantry row. No red, no
  warning icon, no blocking dialog — it means the records are behind reality, which the product
  explicitly tolerates (decision 12).

## 7. Responsive behaviour

Mobile-first. Tailwind default breakpoints: `sm` 40rem, `md` 48rem, `lg` 64rem, `xl` 80rem.

The high-frequency actions — **logging a meal** and **working a shopping list** — are
one-handed, on a phone, in a hurry. They get the largest targets and the least chrome.
Recipe authoring and Insights may be dense and are desktop-comfortable.

| Element | < `md` | ≥ `md` |
| --- | --- | --- |
| Navigation | Bottom tab bar: Today, Plan, Shop, Log, More | Left sidebar (`--shell-sidebar-width`) |
| Primary action | Sticky bottom button, full width | Inline, top-right of section |
| Plan grid | One day per screen, horizontal day switcher | **See below — corrected in V2** |
| Tables | Stacked rows, label above value | True table |
| Insights charts | Full width, one per row, ~200px tall | 2-up, ~280px tall |
| Recipe page | Single column | Ingredients and method side by side |
| Dialogs | Bottom sheet | Centred dialog |

Touch targets are **44 × 44px minimum**, 48px for shopping ticks and portion steppers
(used while holding a basket or a pan).

### 7.1 The plan grid — breakpoints follow content, not the default scale

**Corrected in V2 — see [ADR-001](../adr/001-page-geometry-and-density.md) §3.** V1 rendered
seven equal columns from `md` (48rem). After the sidebar and page padding that leaves roughly
55px per day, into which a tile rendered an icon, four lines of text and around 150px of
controls. The layout was below its own minimum viable width for half its breakpoint range.

**A day column is at least 11rem (176px).** The number of columns follows from that:

| Viewport | Layout |
| --- | --- |
| `< md` | One day at a time, horizontal day switcher. Unchanged. |
| `md` – `xl` | Horizontally scrollable day track: `grid-auto-flow: column`, `grid-auto-columns: minmax(11rem, 1fr)`, scroll-snap on column boundaries, today scrolled into view. A partial column at the edge signals that there is more. |
| `≥ xl` (80rem) | Full seven-column grid, `gap: var(--space-3)`. |

Between `md` and `xl` this trades seeing all seven days at once for being able to read any of
them. That is the right trade, but it must be signalled, and the day switcher must remain a
keyboard path to any day.

### 7.2 Density — explanation belongs where the choice is made

A sentence that helps once in a composer becomes noise when repeated in all 28 cells of a
week grid. `PlanSlotTile` therefore takes a `density` prop:

- **`comfortable`** (composer, mobile day view, log diary) — icon, title, subtitle.
- **`compact`** (week grid) — icon and title only, at most two lines. The cook / portion /
  item distinction is carried entirely by icon and surface treatment, which §6 already
  requires and which already works. Anything further is in the accessible name and an info
  popover.

Per-item controls follow the same principle: delete and "move to…" collapse into one 44px
overflow `DropdownMenu` rather than occupying permanent space in every tile. The drag handle
stays, because it is the direct-manipulation affordance rather than a command.

## 8. Charts

Recharts, because PWA-Base's chart kit is statistics-shaped (`groups` / `scatter` / gauge)
rather than nutrition-shaped ([ARCHITECTURE.md](./ARCHITECTURE.md)). PWA-Base `Sparkline` is
still the right tool for inline trends inside list rows.

Every chart answers a stated question. Insights is organised by question, not by metric tile.

| Question | Chart | Notes |
| --- | --- | --- |
| What did I eat today? | Horizontal stacked `MacroBar` + figures | Bar supports the numbers; it is not the headline |
| How did this week go? | Bar chart, kcal per day | One bar per day; a thin target reference line only if a target is set |
| Which meals did calories come from? | Horizontal stacked bar by slot | Slots are few and ordered — bars beat a pie |
| Which recipes? | Horizontal bar, descending, top 8 + "other" | Ranking, so bars not pie |
| **Which ingredients?** | Horizontal bar, descending, top 10 + "other" + unattributed | The headline insight; most design attention |
| Where do this dish's calories come from? | Stacked bar + table with % of kcal | Table is co-equal, not a fallback |

Rules:

1. **Categorical macro colours only** (§3), identical everywhere.
2. **No pie or donut charts.** Four macros or ten ingredients both read better as ranked or
   stacked bars, and neither invites the calorie-ring aesthetic.
3. **No progress rings, gauges or dials** — including for the calorie target. See §8.4.
4. **Every chart has a text or table equivalent** in the DOM, not merely an `aria-label`.
   For four macros a well-set table often beats a chart outright.
5. Axes are minimal: no gridlines beyond a single baseline, no 3D, no drop shadows, no
   animated entry beyond a fast fade.
6. Unattributed (custom food) share always rendered in `--color-macro-none`, never omitted —
   the ingredient breakdown must be honest about what it cannot explain.
7. Chart colours come from CSS variables (`var(--color-macro-protein)`), so both themes and
   any token tuning apply automatically.

### 8.4 The calorie target

Decision 20 adds an optional, manually entered daily calorie target, while decision 25 still
rules out fitness-bro aesthetics. Both hold, because the objection was never to targets — it
was to the *framing* that usually accompanies them. So:

**Present it as three plain figures, in one line, with tabular numerals.**

```
Target 2400   ·   Consumed 1840   ·   Remaining 560 kcal
```

Optionally accompanied by a **single slim horizontal meter** (4–6px, full width, `--radius-sm`,
`--color-accent` fill on `--color-muted-background`) — the same visual language as the
`MacroBar`, so it reads as part of the product rather than as a fitness widget.

Required:

- **Going over target is stated, not scolded.** Remaining renders as a negative number, or as
  "180 over", in `--color-foreground` — *not* red. Red means error; eating is not an error.
- **No colour-coded pass/fail, no congratulation, no streak, no emoji, no celebration.** The
  number is the feedback.
- **The meter is never the largest element on the screen.** Today's meals outrank it.
- **Absent target, absent UI.** No "set a target" nag, no empty ring, no placeholder. Every
  view is complete without one, and the majority of the screen must not change shape when a
  target is added or removed.
- Macro targets are a later addition (decision 20) and would extend the same one-line pattern
  — not add three more meters.

## 9. Accessibility

Baseline is PWA-Base's [accessibility doc](../../../PWA-Base/docs/design-system/accessibility.md);
these are the additional, binding requirements for this product.

1. **WCAG 2.1 AA contrast** for all text, in **both** themes. Every macro colour must reach
   AA against `--color-surface` when used for text or a legend label; where a fill cannot,
   pair it with an adjacent AA-compliant text label. Verify during the UI-foundation ticket —
   the hex values in §3 are provisional precisely because of this.
2. **Never colour alone.** Availability, macro series, and status all carry text, an icon, or
   both. This is the rule most at risk in a colour-coded nutrition product.
3. **Body text never below 16px.** No exceptions for "dense" tables.
4. **Focus visible** on every interactive element, using `--color-focus-ring` with
   `:focus-visible` (never `:focus`). Never removed without an equally visible replacement.
5. **Keyboard parity.** Every drag interaction in the planner has a keyboard and pointer
   equivalent ("move to…"). dnd-kit ships keyboard sensors — use them; a drag-only planner is
   not shippable.
6. **Semantics.** One `<main>` per route; real `<table>` for tabular data; real `<button>` for
   actions; headings in order.
7. **Live regions** for derived totals that change in response to input (day total while
   logging, shopping total while ticking) — `aria-live="polite"`, and only where the change is
   not otherwise announced.
8. **Reduced motion.** Honour `prefers-reduced-motion`; PWA-Base tokens already collapse
   durations, and `@songara/pwa-base/preview/motion` is reduced-motion-aware by default.
9. **Touch targets** 44px minimum (§7).
10. **Icon-only buttons always have an accessible label** (PWA-Base `IconButton` enforces it;
    shadcn buttons need it added explicitly).

## 10. Motion

Motion communicates a state change or a spatial relationship, or it does not ship. Use
`@songara/pwa-base/preview/motion` rather than the raw package, so reduced-motion handling is
the default.

Durations and easings from PWA-Base tokens: `--motion-duration-fast` (120ms) for hover and
focus, `--motion-duration-normal` (200ms) for enter/exit, `--motion-duration-slow` (320ms)
reserved for sheets. Prefer opacity and small transforms over large positional movement.

| Allowed | Purpose |
| --- | --- |
| Sheet / dialog enter and exit | Spatial origin |
| List item add, remove, reorder | Shows what changed |
| Numeric transition on a running total | Shows the total responded to your input |
| dnd-kit drag and drop feedback | Direct manipulation |
| Skeleton → content cross-fade | Softens layout shift |

| Banned | Why |
| --- | --- |
| Page-load entry animations, staggered lists | Delays the task, every single time |
| Parallax, scroll-driven effects | Decorative; hostile on a phone |
| Ambient loops, floating decoration | Noise |
| Animated chart draw-on beyond a fast fade | Delays reading the data |
| Bouncy or elastic easing | Wrong register for a working tool |
| Motion as the only feedback for a state change | Inaccessible |

## 11. Optional recipe images, empty, loading, and error states

### Optional recipe images

Decision 4 allows a recipe to carry an optional user-supplied image. This does not change §1:
the design still works entirely without imagery, and an image is an enhancement to one entity,
not a layout dependency.

Rules:

- **Absent is the default and must look finished.** No grey placeholder, no dashed drop zone in
  the reading view, no "add a photo" prompt on the recipe page. A recipe without an image shows
  its title in display type, exactly as specified in §4 — which is the design doing the job
  photography would normally do.
- **The layout must not shift shape.** An image is added *within* the existing composition (a
  bounded banner on the recipe page, a small leading thumbnail in list rows) rather than
  introducing a reserved slot that collapses when empty. A list of ten recipes where three have
  images must not look ragged: either the thumbnail column is present for all rows with a
  typographic monogram fallback, or it is absent for all rows in that view. **Do not mix.**
- **Never the largest element.** The most useful thing on a recipe card is availability and
  calories per serving, not a photo.
- Images are cropped to a fixed aspect (4:3 banner, 1:1 thumbnail) with `object-fit: cover`,
  `--radius-md`, and no border or shadow. No captions, no lightbox, no gallery — one image per
  recipe.
- Upload lives in the recipe **editor** only, as an unobtrusive control alongside the name
  field, with removal always available.
- `alt` text is the recipe name. Decorative-only usage means it must never be the sole carrier
  of information (§9).

### Ingredient identity — icon first, photo optional (V2)

Per [ADR-002](../adr/002-reference-ingredient-data-and-provenance.md) §3. No licence-clean
photograph exists for a generic food like "chicken thigh, raw", and buying one would be a
decorative gain at real cost.

- **Every `IngredientCategory` carries an `icon` and an `accent`.** That is the default
  identity, it is always present, and it makes a 150-row library scannable by category at a
  glance — which is the job photos were being asked to do.
- `Ingredient.imageId` allows an optional user photo on exactly the terms recipe images
  already have. The icon occupies the slot when no photo exists, so **the slot is never
  empty, the layout never shifts, and a list is never ragged.** The "do not mix present and
  absent thumbnails in one view" rule above is satisfied automatically rather than by
  vigilance.
- Provenance is shown as a small, plain line on the ingredient detail page — the dataset
  name, the entry code, and a link to check it. Edited reference figures say so. This is
  reporting, not a badge: no trust score, no colour coding, no verification tick.

### Empty

Every list and every chart has all three specified before it ships. A brand-new install is
**entirely empty**, so empty states are the genuine first-run experience, not an edge case.

### Empty

PWA-Base `EmptyState`. Name the next action concretely and, where useful, explain the
dependency. Never "No data".

| Screen | Copy |
| --- | --- |
| Ingredients | "Add your first ingredient — everything else builds on these." → *Add ingredient* |
| Recipes | "No recipes yet. Recipes are built from your ingredients." → *Create recipe* (or *Add ingredients first* when the library is empty) |
| Pantry | "Your pantry is empty. Add what you have to see what you can cook." → *Add stock* |
| Plan | "Nothing planned for this week." → *Plan a meal* |
| Shopping | "Nothing to buy — your plan is covered by what's in the pantry." (a *success*, not an absence) |
| Log | "Nothing logged today." → *Log a meal* (or *Log planned meal* when a plan exists) |
| Insights | "Log a few meals and this will show where your calories came from." |
| Batches | "No batches. Cook a recipe to track portions." → *Cook a recipe* |

Distinguish **empty** ("nothing exists yet" — offer the action) from **filtered-empty**
("nothing matches" — offer to clear the filter). They are different states with different
copy.

### Loading

Local IndexedDB reads are fast, so most views should never flash a loader. Rules:

- **Skeletons match the final layout** in shape and row count (PWA-Base `Skeleton`), so
  content arrival does not shift layout.
- **Delay loaders by ~150ms.** A skeleton that appears and vanishes in 40ms is worse than no
  skeleton.
- Never a full-page spinner on a route that has any cached shell to show.
- `Spinner` (PWA-Base, `role="status"`) only for genuinely indeterminate operations —
  import/export.

### Error

- **Inline and specific.** Validation belongs at the field.
- Route-level error boundary: what failed, what is unaffected, and a retry. Data is local, so
  errors are rare and almost always mean a storage problem — say so, and never imply the
  user's data is gone when it is not.
- Toast (`sonner`) for transient failures only, never for validation.
- Never a raw exception message or a stack trace in the UI.
- Storage failures (quota, blocked IndexedDB) get an honest explanation and point at
  export/import.

## 12. Anti-patterns — explicitly forbidden

Rejecting these is what makes the product look intentional rather than generated.

| Forbidden | Instead |
| --- | --- |
| Purple or blue gradients; any gradient surface fill | Flat warm surfaces |
| Glassmorphism, blur, translucent panels | Opaque surfaces |
| Everything wrapped in a bordered card | Lists with dividers; cards only for separable objects |
| A border on every row, or a full grid of cell borders | Spacing and one border per real boundary |
| Generic SaaS dashboard of KPI tiles | Insights organised by question |
| Hero calorie rings, gauges, dials, scoreboard framing | The one-line target readout in §8.4 |
| Streaks, badges, congratulation, nudging, scolding | Report; never judge |
| Red "over target" warnings | A plain negative number in normal ink |
| Nutri-Score, traffic-light nutrients, health grades | Composition and attribution |
| Green = good / red = bad for macros | Categorical macro colours (§3) |
| Giant headings above thin content | Modest page titles; display type for real content |
| Pie and donut charts | Ranked or stacked bars |
| Placeholder-only form labels | Always-visible labels |
| Proportional (non-tabular) figures in data | `tabular-nums` everywhere |
| Grey image placeholders, reserved 16:9 slots, "add a photo" nags | Optional images that collapse cleanly when absent (§11) |
| Decorative animation, page-load staggers, parallax | Motion only for state and space |
| Drag-only interactions | Always a keyboard and pointer alternative |
| Colour as the only carrier of meaning | Colour plus text or icon |
| Body text below 16px | 16px floor |
| Hardcoded hex, px, or ad-hoc CSS variables in components | Tokens only |
| A second UI framework (MUI, Mantine, Chakra, Ant) | shadcn/ui + Radix + PWA-Base |

## 13. Definition of done for the UI-foundation ticket

This document is usable as the specification for step 1 of the
[implementation sequence](./ARCHITECTURE.md). That ticket is complete when:

1. `@songara/pwa-base/ui/tokens.css` is imported first; §3 overrides and `--color-macro-*`
   tokens are applied; Tailwind v4 `@theme inline` maps shadcn's variables onto them; no
   component contains a raw colour value.
2. `@custom-variant dark (&:is([data-theme="dark"] *))` is set and PWA-Base `ThemeProvider`
   demonstrably drives both PWA-Base primitives and shadcn components in both themes.
3. Fraunces is loaded (400/600/700) and bound to `--font-family-display`; Source Sans 3 and
   IBM Plex Mono are unchanged; the `.num` tabular utility exists.
4. **All colour pairings in §3 are contrast-verified in both themes**, and any hex adjusted
   here in DESIGN.md — not patched in a component.
5. `SoloSiteApp` + `defineSite` shell renders with the responsive navigation from §7 (bottom
   tabs under `md`, sidebar at and above), all routes stubbed.
6. The domain components in §6 exist as token-driven stubs with their states, so feature
   tickets compose rather than invent.
7. Empty, loading and error patterns from §11 exist as reusable pieces, with one route
   demonstrating all three.
8. The Vite starter's `App.css`, template assets and counter are deleted.
9. A keyboard-only pass over the shell and one form: focus visible throughout, order matches
   reading order, no trap.
10. `vite-plugin-pwa` manifest uses `--color-background` and `--color-accent` for
    `background_color` and `theme_color`, so the install and splash match the product.
