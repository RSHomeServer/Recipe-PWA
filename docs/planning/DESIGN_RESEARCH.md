# Design Research

Visual and interaction references for a food, recipe and nutrition product, and what Recipe
PWA should take from them. Feeds [DESIGN.md](./DESIGN.md), which is the authoritative visual
specification. This document is the reasoning; DESIGN.md is the decision.

No branding, logo, typeface pairing or colour palette is copied from any product below. What
is adopted are structural and interaction patterns.

## The constraint that shapes everything

**There is no image library, and most recipes will never have a picture.**

Every polished recipe product leans on photography: Samsung Food, NYT Cooking, and the whole
cookbook-publishing aesthetic are built on full-bleed imagery. A personal app with
user-authored recipes has, realistically, almost no images — and the honest failure mode of
"design for photos, ship without them" is grey placeholder rectangles everywhere, which looks
broken rather than minimal.

So the design must be **typographically and chromatically led**: type, colour, spacing and
numeric data do the work that photography usually does. This turns out to be a good fit for
what the product actually is — a working tool used mid-task, in a kitchen or on a phone —
rather than a browsing experience.

Decision 4 allows an **optional** user-supplied recipe image, which does not change this
conclusion: it is an enhancement to one entity, never a structural dependency. The design must
be complete without any image, and a library where three recipes in ten have pictures must not
look ragged.

Consequence for DESIGN.md: no layout may assume or reserve image space, no grey placeholder
ever appears where an image is absent, recipe identity comes from type and colour treatment,
and a thumbnail column is either present for every row in a view (with a typographic fallback)
or absent for all of them.

## Reference patterns worth adopting

### Contemporary cookbook publishing — warmth without decoration

The recognisable language of current food publishing: cream and paper-toned surfaces, warm
earth accents (paprika, olive, clay), an editorial serif for titles against a plain sans for
functional text, and generous vertical rhythm in ingredient lists.

**Adopt:** the warm-neutral base instead of white or grey, earth-tone accents, and an
editorial display face for recipe and section titles. The ingredient-list rhythm — quantity
and ingredient in a stable two-column relationship, comfortably spaced, scannable while
cooking — is directly applicable.

**Do not adopt:** the photography-first hero pattern (see constraint above), decorative
flourishes, or long-form editorial measure. Our recipe pages are working documents.

### Dual reading mode — browse versus cook

Well-made recipe products serve two postures with the same content: leisurely browsing, and
hands-busy execution with the phone propped against a backsplash. The second demands larger
type, single-focus steps, and generous touch targets.

**Adopt:** the principle, applied to *our* two postures. This product's high-frequency
moments are **logging a meal** and **checking a shopping list**, both one-handed, on a phone,
in a hurry. Those flows deserve the "cook mode" treatment: large numerals, big targets,
minimal chrome. Recipe authoring and Insights are desktop-comfortable and can be dense.

**Do not adopt:** a full guided cook mode with step timers in v1 ([FEATURE_MATRIX](./FEATURE_MATRIX.md)
marks it V2). But do not design a recipe page that would have to be rebuilt to add it.

### SuperCook — the pantry as chips

Pantry contents as compact, category-grouped, tappable chips rather than a form or a table
row per item. Adding and removing stock is a tap, and results re-derive instantly.

**Adopt:** chip-density for pantry browsing and for quick "I have this" entry, with a clear
visual distinction between "in stock" and "known but not stocked". Also adopt the immediate,
visible re-derivation — changing the pantry should visibly change recipe availability badges
in the same screen, because that feedback loop is what makes the pantry worth maintaining.

**Adapt, don't copy:** our pantry is quantitative. A chip must carry a quantity ("Rice
800 g") without becoming a cramped mini-form. That is a real design problem for DESIGN.md to
solve: chip for browsing, popover stepper for adjusting.

**Do not adopt:** the ad-dense, utilitarian visual treatment.

### MyFitnessPal — diary density done properly

Its diary is genuinely good at one thing: a day of eating, grouped by meal slot, with running
totals, readable at a glance and fast to add to. Per-slot subtotals with a day total are the
right information hierarchy.

**Adopt:** day → slot → entries with subtotals, a persistent day total, and an always-reachable
add action per slot. Right-aligned tabular numerals so figures compare vertically.

**Do not adopt:** the calorie-ring-first framing, the "remaining calories" scoreboard, the
green/red judgement, streaks, or nudges. That framing turns a food record into a compliance
report and is the aesthetic [DESIGN.md](./DESIGN.md) explicitly rejects.

### Eat This Much and Samsung Food — the week grid

A week as a grid of days × meal slots, with recipes dropped into slots, is the established
and correct planning interaction. Samsung Food's drag-and-drop is the fluent version.

**Adopt:** the day × slot grid; drag to move a planned meal; a clear empty-slot affordance
that invites rather than nags. Crucially, **also** a non-drag path ("move to…"), because
drag-only is inaccessible and awkward on a phone — noted in
[ARCHITECTURE.md](./ARCHITECTURE.md) as a hard requirement on dnd-kit usage.

**Adapt:** our grid must legibly distinguish a **recipe to cook** from a **portion of an
existing batch**. That distinction is the product's differentiator, and if the planner renders
both as identical tiles the differentiator is invisible. This needs a real visual treatment,
not a small badge.

### Shopping list grouping — aisle and provenance

Both Samsung Food and Eat This Much group lists by aisle and allow grouping by recipe.

**Adopt:** both groupings, toggleable. Aisle order is what makes a list usable while walking
around a shop; grouping by recipe answers "why is 1.3 kg of chicken on my list?". Adopt
large, forgiving tick targets — this is used one-handed, holding a basket.

**Adapt:** our lines show `required − in pantry = to buy`. Showing all three without turning
the row into a spreadsheet is a specific design problem: lead with the amount to buy, and
make the arithmetic available on expand.

### Nutrition data visualisation — Open Food Facts' discipline

The Open Food Facts design guidance is the most rigorous public example of nutrition data
presentation. Its rules are worth taking wholesale: never rely on colour alone, always
provide accessible text alternatives to charts, keep colour coding consistent across the
product, and never drop body text below 16px.

**Adopt:** all four, as a11y requirements in DESIGN.md rather than aspirations. Adopt also
the plain nutrient table as a first-class presentation — for four macros, a well-set table
often beats a chart, and it is accessible by default.

**Do not adopt:** Nutri-Score A–E grades, traffic-light nutrient colouring, or NOVA
processing groups. These grade food as good or bad. This product reports and attributes; it
does not judge — a product position from
[PRODUCT_RESEARCH.md](./PRODUCT_RESEARCH.md) with a direct design consequence: **macro
colours must be categorical, never evaluative.** No green-is-good, red-is-bad palette for
protein/carbs/fat.

### Nutrition-tracker visual language — one to learn from carefully

Products in this space (Foodnoms is a well-executed example) use colour to encode nutrients,
flat shadowless surfaces, and a friendly large corner radius to make dense health data feel
approachable rather than clinical.

**Adopt:** colour as a consistent nutrient encoding, applied identically in charts, badges
and table headers so the association is learned once. Adopt flat, shadowless surfaces —
elevation should mean "floating above" (dialog, popover), not "is a card".

**Do not adopt:** the very large uniform radius on everything. At ~26px, buttons, cards and
tags all become pill-like, which reads as consumer-app-friendly but costs the crispness a
data-dense working tool needs. Our radius scale stays modest.

## Patterns to avoid, and why

Each of these is a specific failure this product is at risk of, not a generic warning.

| Anti-pattern | Why it is a real risk here | Rule |
| --- | --- | --- |
| **Generic SaaS dashboard** — KPI tiles in a 4-up grid above a chart | Insights is genuinely a dashboard, so the pull is strong | Insights is organised by *question* ("where did this week's calories come from?"), not by metric tile. Prose-led section headings, charts answering a stated question. |
| **Purple/blue AI gradients** | The 2020s default for anything data-shaped | Warm earth palette. No gradient as a surface fill anywhere. Nothing in the product implies AI. |
| **Everything in cards** | Seven list-heavy screens make card-wrapping each row tempting | Lists are lists: dividers and spacing, not a border per row. A card must earn itself by being a genuinely separable object. |
| **Excessive borders** | Data-dense tables invite boxing every cell | One border per boundary. Prefer spacing and background shifts over rules. Never a full grid of cell borders. |
| **Fitness-bro aesthetic** — hero calorie rings, "remaining" scoreboards, streaks, black-and-neon | This is a nutrition app; the pull is enormous | No rings, gauges or dials at all. Decision 20 adds an optional calorie target, so the discipline moves to *framing*: three plain figures and at most one slim meter (DESIGN.md §8.4). Report; never congratulate or scold. |
| **Giant headings, little content** | Marketing-page habit leaking into an app | Page titles are modest. Display sizes are for recipe titles and key figures, not for the word "Pantry". |
| **Glassmorphism / blur** | Cheap way to look modern | Not used. Surfaces are opaque. |
| **Decorative animation** | Motion library is available and tempting | Motion communicates state change or spatial relationship, or it does not ship. No page-load staggers, no parallax, no ambient loops. |
| **Spreadsheet feel** | The brief warns of it, and the data really is tabular | Tabular where tabular is right, but with generous row height, no vertical rules, right-aligned tabular figures, and one emphasised column per table rather than uniform grey text. |
| **Grey image placeholders** | Direct consequence of most recipes having no image | No layout reserves image space and no placeholder is ever drawn. Recipe identity comes from type and colour; an optional image sits inside the existing composition. |
| **Colour-only meaning** | Availability states and macro charts both invite it | Every state carries text or an icon as well as colour ([Open Food Facts](https://github.com/openfoodfacts/openfoodfacts-design) rule, and PWA-Base's own a11y baseline). |

## Distinctive opportunities

Where the design can be genuinely characterful rather than merely inoffensive:

1. **The attribution view.** "Where did my calories come from?" broken down to ingredient
   level across a week is a view no competitor has. It deserves to be the most visually
   considered screen in the product — a composition, not a pie chart.
2. **Availability as a quiet, legible state.** Three states across a recipe library, readable
   at a glance without shouting. A restrained treatment (a small state marker plus the
   shortfall named in text) will feel more trustworthy than badges.
3. **Portions remaining as a physical-feeling quantity.** "2.5 portions of Sunday's curry
   left" is the product's most distinctive fact. Rendering it as something closer to a
   tangible count than a progress bar is an opportunity for real character.
4. **Shopping arithmetic shown honestly.** `2.5 kg needed − 1.2 kg in pantry = 1.3 kg to buy`
   is reassuring rather than complicated, if typeset well. Most products hide the working;
   showing it builds trust in the number.
5. **A warm, calm, opinionated palette.** Every reference product is either clinical white
   or fitness black. A cream-and-earth product in this category is immediately distinctive at
   almost no cost.

## Inputs to DESIGN.md

Carried forward as decisions:

- Warm neutral (cream/paper) base rather than white or grey; earth-tone accents.
- Editorial serif display face for titles; plain sans for UI and data; mono/tabular figures
  for all quantities and nutrition.
- Categorical, non-evaluative macro colours, applied consistently across charts, badges and
  tables.
- Flat opaque surfaces; elevation reserved for genuinely floating layers; modest radius.
- Lists as lists; cards only for separable objects; minimal borders.
- Phone-first treatment for logging and shopping; density permitted for authoring and
  insights.
- No layout depends on imagery; an optional recipe image is an enhancement, never a slot.
- Colour never carries meaning alone; charts always have a text or table equivalent.
- Motion only for state change and spatial continuity.
- No grades, scores, rings, streaks or gamified goal framing. The optional calorie target
  (decision 20) is three plain figures and at most one slim meter — DESIGN.md §8.4.

## Remaining research focus

Decision 26 settles the domain concepts and redirects research at the UX around them. The
open areas, in rough order of how much they will shape the product:

| Area | The question worth researching |
| --- | --- |
| Pantry matching | How to present three availability states across a library without noise, and how much shortfall tolerance feels helpful rather than pedantic |
| Fast meal logging | How few taps can log yesterday's dinner again; where the log entry point lives on a phone |
| Recipe creation | Ingredient-row entry that stays quick at twenty lines, with unit entry that never fights the user |
| Nutrition breakdown | Making ingredient attribution legible at recipe, day and week scope with one visual language |
| Weekly planning | A 7 × slot grid on a phone; drag with a genuinely equal keyboard and menu path |
| Shopping interaction | Grouping, ticking one-handed, and showing an adjustment beside the derived figure without clutter |
| Batch and portion management | Making "2.5 portions of Sunday's curry left" feel physical, and where closing a batch belongs |
| Insight visualisation | Which of the five insight views earn a chart and which read better as a table |
| Mobile navigation | Route grouping across ten routes without a crowded tab bar |
| Modern food-app visual patterns | Continued reference gathering for warmth and character within the constraints above |
