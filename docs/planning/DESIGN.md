# DESIGN.md — Recipe PWA visual source of truth

Authoritative visual and interaction specification. Where this document and a component
disagree, this document wins; change it here first.

Reasoning behind these choices is in [DESIGN_RESEARCH.md](./DESIGN_RESEARCH.md).
Implementation wiring is in [ARCHITECTURE.md](./ARCHITECTURE.md).

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

1. **There is no food photography** and no pipeline for any. Type, colour, spacing and
   numbers carry the design. **No layout may reserve or assume image space.**
2. **This product reports; it does not judge.** No grades, scores, rings, streaks, or
   goal framing. Consequence: macro colours are **categorical, never evaluative**.

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
  --color-macro-carbs:   #D99A2B;   /* amber */
  --color-macro-fat:     #4E7C8A;   /* slate */
  --color-macro-none:    #A79C8D;   /* unattributed (quick-add) */
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
non-nutrition purposes. `--color-macro-none` is always rendered for quick-add entries; the
unattributed share is never hidden.

### Availability colours

Uses status tokens, but **never colour alone** (§9):

| State | Token | Also carries |
| --- | --- | --- |
| Can make now | `--color-success` | Text "Ready to cook" + check icon |
| Missing staples only | `--color-warning` | "Missing salt, oil" — named, not counted |
| Missing key ingredients | `--color-muted` | "Missing chicken, rice" — muted, **not error red** |

Missing ingredients is a neutral fact, not a failure. Red would scold the user for their
own fridge.

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
one shared formatter. Components must not invent their own rounding.

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

| Context | Token |
| --- | --- |
| Forms, recipe pages, prose | `--content-max` (72rem) |
| Insights, plan grid, pantry | `--workspace-max` (90rem) |
| Desktop sidebar | `--shell-sidebar-width` |

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

Per [ARCHITECTURE.md](./ARCHITECTURE.md) and [Q9](./OPEN_QUESTIONS.md): shadcn/ui owns the
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
| `MealSlotSection` | Day → slot grouping | Shared by plan and log |

`PlanSlotTile` matters most: recipe-to-cook and batch-portion are the product's core
distinction, and if the planner renders them identically the differentiator is invisible.
Use different surface treatment and an icon, not a small badge — a cook tile reads as work to
do, a portion tile as food that already exists.

### Forms

React Hook Form + Zod, reusing domain schemas. Labels always visible (never placeholder-only).
Errors below the field, in `--color-error`, referenced by `aria-describedby`, with
`aria-invalid`. Required fields marked in text, never with colour alone. Numeric inputs use
`inputMode="decimal"`. Unit selection sits adjacent to its amount field, and a
missing-conversion-factor case renders as an inline prompt, not an error toast
([UNIT_MODEL.md](./UNIT_MODEL.md)).

## 7. Responsive behaviour

Mobile-first. Tailwind default breakpoints: `sm` 40rem, `md` 48rem, `lg` 64rem, `xl` 80rem.

The high-frequency actions — **logging a meal** and **working a shopping list** — are
one-handed, on a phone, in a hurry. They get the largest targets and the least chrome.
Recipe authoring and Insights may be dense and are desktop-comfortable.

| Element | < `md` | ≥ `md` |
| --- | --- | --- |
| Navigation | Bottom tab bar: Today, Plan, Shop, Log, More | Left sidebar (`--shell-sidebar-width`) |
| Primary action | Sticky bottom button, full width | Inline, top-right of section |
| Plan grid | One day per screen, horizontal day switcher | 7-day × slot grid |
| Tables | Stacked rows, label above value | True table |
| Insights charts | Full width, one per row, ~200px tall | 2-up, ~280px tall |
| Recipe page | Single column | Ingredients and method side by side |
| Dialogs | Bottom sheet | Centred dialog |

Touch targets are **44 × 44px minimum**, 48px for shopping ticks and portion steppers
(used while holding a basket or a pan).

## 8. Charts

Recharts, because PWA-Base's chart kit is statistics-shaped (`groups` / `scatter` / gauge)
rather than nutrition-shaped ([ARCHITECTURE.md](./ARCHITECTURE.md)). PWA-Base `Sparkline` is
still the right tool for inline trends inside list rows.

Every chart answers a stated question. Insights is organised by question, not by metric tile.

| Question | Chart | Notes |
| --- | --- | --- |
| What did I eat today? | Horizontal stacked `MacroBar` + figures | Bar supports the numbers; it is not the headline |
| How did this week go? | Bar chart, kcal per day | One bar per day; no target line in v1 |
| Which meals did calories come from? | Horizontal stacked bar by slot | Slots are few and ordered — bars beat a pie |
| Which recipes? | Horizontal bar, descending, top 8 + "other" | Ranking, so bars not pie |
| **Which ingredients?** | Horizontal bar, descending, top 10 + "other" + unattributed | The headline insight; most design attention |
| Where do this dish's calories come from? | Stacked bar + table with % of kcal | Table is co-equal, not a fallback |

Rules:

1. **Categorical macro colours only** (§3), identical everywhere.
2. **No pie or donut charts.** Four macros or ten ingredients both read better as ranked or
   stacked bars, and neither invites the calorie-ring aesthetic.
3. **No progress rings, gauges or dials** in v1 — there are no targets ([Q8](./OPEN_QUESTIONS.md)).
4. **Every chart has a text or table equivalent** in the DOM, not merely an `aria-label`.
   For four macros a well-set table often beats a chart outright.
5. Axes are minimal: no gridlines beyond a single baseline, no 3D, no drop shadows, no
   animated entry beyond a fast fade.
6. Unattributed (quick-add) share always rendered in `--color-macro-none`, never omitted.
7. Chart colours come from CSS variables (`var(--color-macro-protein)`), so both themes and
   any token tuning apply automatically.

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

## 11. Empty, loading, and error states

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
| Hero calorie rings, "remaining calories" scoreboards | Absolute figures, stated plainly |
| Streaks, badges, congratulation, nudging, scolding | Report; never judge |
| Nutri-Score, traffic-light nutrients, health grades | Composition and attribution |
| Green = good / red = bad for macros | Categorical macro colours (§3) |
| Giant headings above thin content | Modest page titles; display type for real content |
| Pie and donut charts | Ranked or stacked bars |
| Placeholder-only form labels | Always-visible labels |
| Proportional (non-tabular) figures in data | `tabular-nums` everywhere |
| Grey image placeholders, reserved 16:9 slots | No layout assumes imagery |
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
