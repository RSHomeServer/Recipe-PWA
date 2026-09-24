# Feature Matrix

Reference-product comparison and the Recipe PWA decision for each capability. Companion to
[PRODUCT_RESEARCH.md](./PRODUCT_RESEARCH.md).

**Legend** — reference columns: `Y` present · `P` partial / premium-gated · `—` absent.
Recipe PWA column: **V1** build now · **V2** deliberate follow-up · **No** out of scope.

MFP = MyFitnessPal · SF = Samsung Food · SC = SuperCook · ETM = Eat This Much.

## Ingredients

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Personal ingredient library (user-authored) | Y | Y | — | Y | **V1** | The only source of ingredients in v1. |
| Seeded reference ingredient library with citations | P | P | — | P | **V2** | Several hundred CoFID generics, script-transcoded, each with a `source` carrying dataset, entry code and URL ([ADR-002](../adr/002-reference-ingredient-data-and-provenance.md)). No reference product cites its figures per item. |
| Curated "common" tier over a wide reference base | — | — | — | — | **V2** | ~150 flagged entries answer the ordinary case; the long tail stays searchable behind "show all". Keeps a composition table usable as a picker. |
| Per-ingredient provenance visible to the user | — | — | — | — | **V2** | `reference` / `packaging` / `userEntered` / `estimated`, and editing a reference figure says so. |
| Ingredient photo | P | Y | Y | — | **V2** | Optional and user-supplied; a category icon is the always-present default ([ADR-002](../adr/002-reference-ingredient-data-and-provenance.md) §3). |
| Nutrition per ingredient (kcal + P/C/F) | Y | Y | — | Y | **V1** | Per 100 g / 100 ml / 1 item. |
| Unit metadata (mass / volume / count) | Y | Y | — | Y | **V1** | One canonical measure kind per ingredient. |
| Density and per-item weight for cross-kind conversion | P | P | — | P | **No** | Decision 2 excludes ingredient-specific conversion tables. Conversion is in-family only (g↔kg, ml↔L). Unchanged by V3 — ADR-008's spoon weights are mass-only and entry-only, not a density model. |
| Teaspoon / tablespoon entry | Y | Y | — | Y | **V3** | [ADR-008](../adr/008-kitchen-spoons-as-an-entry-time-conversion.md). A **cited** gram weight per spoon, converted once at entry; spoons never become a unit and nothing downstream sees one. Offered only where a source publishes the weight, which is the honest version of a feature every reference product fakes. |
| Cups, pinches, handfuls, slices | Y | Y | — | Y | **No** | Same reasoning, no source data. Would be a guess. |
| Staple flag (salt, oil, spice) for availability rules | — | — | P | — | **V2** | Availability now classifies by *how many* ingredients are short (decision 11). A staple flag refines that later. |
| Category / aisle grouping | Y | Y | Y | Y | **V1** | Reused by pantry and shopping list. |
| External food database lookup (live, on demand) | Y | Y | Y | Y | **No** | V2 seeds from a dataset once, offline; live lookup stays out. The `source` field makes it a later data-entry route, not a model change. |
| Barcode scanning | Y | Y | — | Y | **No** | |
| Photo / AI ingredient recognition | Y | P | Y | — | **No** | |
| Sodium tracking | Y | Y | — | Y | **V3** | [ADR-007](../adr/007-sodium-as-a-nullable-nutrient.md). The flavour layer is zero-calorie, so sodium is the only constraint that can describe it. **Nullable** — unknown is distinguished from none, which no reference product does; they all render a missing figure as 0. |
| Other micronutrients | Y | Y | — | Y | **No** (ready) | Nutrition record is extensible; sodium proved the path. |

## Recipes

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Author a recipe from library ingredients + quantities | Y | Y | — | Y | **V1** | |
| Nutrition **derived** from ingredient lines (never typed) | Y | Y | — | Y | **V1** | Core invariant. |
| Servings / yield, with per-serving nutrition | Y | Y | — | Y | **V1** | |
| Ingredient-level nutrition breakdown within a recipe | Y | P | — | P | **V1** | Feeds attribution. |
| Preparation steps | Y | Y | Y | Y | **V1** | Plain ordered text. |
| Scale a recipe to other servings | P | P | — | Y | **V1** | Linear, dynamic, never a duplicated recipe (decision 5). |
| Optional recipe image | Y | Y | Y | Y | **V1** | Decision 4. User-supplied Blob; **no layout depends on one**. |
| Recipe containing another recipe (nesting) | — | P | — | — | **No** | Decision 4. A sauce lists its ingredients directly. |
| Recipe import from URL | Y | Y | — | — | **No** | Scraping is a project of its own. |
| Public / community recipe catalogue | Y | Y | Y | Y | **No** | |
| Guided step-by-step cook mode | — | P | — | — | **V2** | Valuable; not planning-critical. |

## Pantry

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Pantry inventory exists | — | P | Y | P | **V1** | |
| **Quantitative** stock (1.2 kg, not "have chicken") | — | P | — | P | **V1** | Prerequisite for shopping subtraction. |
| Add / remove / adjust stock | — | P | Y | P | **V1** | One stored quantity per ingredient; adding 1 kg to 500 g gives 1.5 kg (decision 10). |
| Fast chip-based add from ingredient library | — | — | Y | — | **V1** | SuperCook's best interaction. |
| "What can I make?" three-state availability | — | P | Y | P | **V1** | `canMake` / `almostCanMake` / `missingSignificant`, always with named shortfalls (decision 11). |
| Stock auto-deducted when a batch is cooked | — | — | — | — | **V1** | Decision 12. Warns on shortfall; **never blocks**. |
| Stock auto-added when shopping items are ticked | — | — | — | — | **V1** | Keeps the pantry true for free. |
| Stock deducted when a bare ingredient is logged | Y | — | — | P | **V1** | Decision B. 1000 ml milk, log 200 ml → 800 ml. Never blocked, never clamped. |
| Stock movement history / audit trail | — | — | — | — | **No** | Decision 10: a planning aid, not an accounting system. Reverses the earlier ledger proposal. |
| Expiry / best-before tracking and alerts | — | P | — | P | **No** | Decision 10 and 24 — not even an optional field in V1. |
| Stock lots, FIFO, batch numbers, packaging identity | — | — | — | — | **No** | Decision 10. |
| Food-waste tracking as a quantity | — | — | — | — | **No** | Decision 24. Batch closure writes off a remainder without measuring it. |
| Storage locations (fridge / freezer / cupboard) | — | — | — | — | **V2** | |
| Receipt scanning, barcode restock | — | P | — | — | **No** | |

## Batches and portions (the differentiator)

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Record that a recipe was actually cooked (a Batch) | — | P | — | — | **V1** | Distinct from the Recipe. |
| Batch records a scale factor ("2× recipe") | — | — | — | — | **V1** | Decision 7. |
| Batch yields a countable number of portions | — | — | — | P | **V1** | Nominal portions, decision 7. |
| Portions remaining, depleted as they are eaten | — | — | — | — | **V1** | Derived from logs, not a stored counter (decision 23). |
| Fractional portions (0.5, 1.5) | P | — | — | P | **V1** | Decision 8. |
| Plan a future meal as "a portion of Batch #4" | — | — | — | P | **V1** | Requires no shopping. |
| **Batch nutrition frozen at cook time** | — | — | — | — | **V1** | Decision A. Immutable snapshot; recipe edits never rewrite history. No reference product does this. |
| Actual cooked quantities differing from the recipe | — | — | — | — | **V1** | Decision A. 500 g recipe, 550 g actually used — the snapshot records 550 g. |
| Close a batch, writing off the remainder | — | — | — | — | **V1** | Decision C. Not waste tracking; historical nutrition untouched. |
| Cooked-weight tracking | — | — | — | — | **No** | Decisions 7, 24. Nutrition never needs it — water has no calories. |
| Physical container tracking, locations, freezing state | — | — | — | — | **No** | Decision 7. Portion count is sufficient. |

None of the four references does this properly: leftovers are a planner side effect (ETM,
SF) or absent (MFP, SC).

## Meal planning

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Calendar of days × meal slots | P | Y | — | Y | **V1** | Breakfast / lunch / dinner / snack, seeded as **data** so nothing hard-codes three meals (decision 14). |
| Custom meal slots | — | P | — | P | **V2** | Model already supports it; V1 exposes the four defaults. |
| Same recipe planned on several days | Y | Y | — | Y | **V1** | Requirements aggregate across all occurrences (decision 14). |
| Drag and drop recipes into slots | — | Y | — | P | **V1** | dnd-kit; keyboard-accessible alternative required. |
| Plan a recipe at chosen servings | — | Y | — | Y | **V1** | |
| Plan an existing batch portion | — | — | — | P | **V1** | |
| Plan a bare ingredient (yoghurt, fruit) | Y | P | — | Y | **V1** | |
| Plan aggregates ingredient requirements | — | Y | — | Y | **V1** | Derived, never stored. |
| Planning consumes pantry stock | — | — | — | P | **No** | Decision 12 — planning changes nothing physical. |
| Separate cook-day field on a planned meal | — | — | — | P | **No** | Decisions 12, 14: plan meals, and create a Batch when you actually cook. No cook-session entity. |
| Save / reload a favourite week | — | P | — | P | **Later** | Deferred behind meal templates, which cover most of the need. Not in V3, which is the Flavour Lab. |
| **Saved meals: a named combination of recipes and items** | — | P | — | P | **V2** | "Chicken thighs + hashbrowns + peas + sauce". Expands into ordinary planned meals sharing a group id, so no derivation changes and recipe nesting stays banned ([ADR-004](../adr/004-meal-templates-by-expansion.md)). |
| Apply a saved meal to several days at once | — | — | — | P | **V2** | The highest-value interaction in V2 — four dinners in one action. |
| Recently planned or logged items, one tap | P | — | — | P | **V2** | Derived from `plannedMeals` + `loggedMeals`, deduplicated, capped at twelve. Nothing stored. |
| Automatic plan generation from macro targets | — | P | — | Y | **No** | Authorship over generation (decision 24). |
| Household / per-meal head count | — | P | — | Y | **No** (V2-ready) | Servings scaling covers most of it. |

## Flavour and seasoning (V3)

The column is empty for a reason: **no reference product treats flavour as data.** MyFitnessPal
and Samsung Food will tell you a teaspoon of paprika is 6 kcal if you search for it; none of
them will answer "what is sour, spicy and under 10 kcal per teaspoon, and what should I put it
on?".

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Seasoning and condiment coverage in the reference library | P | P | — | P | **V3** | A second curated pack from USDA SR Legacy fills fifteen named gaps CoFID leaves — paprika, cumin, turmeric, oregano, black pepper, MSG, miso, fish sauce and more ([ADR-006](../adr/006-flavour-coverage-by-curated-second-dataset.md)). |
| Sensory tags on ingredients (sour, umami, smoky…) | — | — | — | — | **V3** | Closed sixteen-value vocabulary, curated per ingredient, read by no calculation ([ADR-009](../adr/009-sensory-tags-and-derived-constraints.md)). |
| Query by taste **and** calorie ceiling | — | — | — | — | **V3** | The question the feature exists to answer. |
| Reusable seasoning mixes and sauces with derived nutrition | — | P | — | — | **V3** | A mix **is** a `Recipe` — no new entity, so it works in planning, shopping and insights on day one ([ADR-010](../adr/010-flavour-lab-as-a-lens.md)). |
| Snack = base + mix, saved and repeatable | — | P | — | P | **V3** | A snack **is** a `MealTemplate`. Shipped machinery from V2; V3 adds the way in. |
| Calorie-density and high-sodium markers | P | — | — | — | **V3** | Derived predicates over the figures already held — never stored, so they cannot contradict the nutrition ([ADR-009](../adr/009-sensory-tags-and-derived-constraints.md) §5). |
| A "health score" or reward-per-calorie ranking | Y | Y | — | P | **No** | Every reference product does this and it is the part users trust least ([PRODUCT_RESEARCH.md](./PRODUCT_RESEARCH.md)). Preserve the attributes; let the user trade them off. |
| Allergen flags | Y | Y | — | P | **No** | A partial allergen list is more dangerous than none, and neither dataset annotates for the 14 UK regulated allergens. Needs its own ADR and a complete source ([ADR-009](../adr/009-sensory-tags-and-derived-constraints.md) §6). |
| Heat / Scoville ratings | — | — | — | — | **No** | No dataset carries it, so it would be invented. `spicy` as a tag is honest; "7/10 heat" is not. |
| Shelf life and food-safety warnings as structured data | — | P | — | — | **No** | Expiry tracking stays out (decision 24). Real cautions — homemade garlic in oil, for instance — belong in the recipe's own notes, in the user's words. |

## Shopping

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Shopping list generated from the plan | — | Y | P | Y | **V1** | |
| List = plan requirements **minus** pantry stock | — | P | — | P | **V1** | Aggregate the whole selected range *before* subtracting (decision 18). |
| User-chosen shopping date range | — | P | — | P | **V1** | Decision D. Default today → next 7 days; ticks scoped by window key. |
| Adjust a quantity while keeping the derived figure visible | — | P | — | — | **V1** | Decision 19 — "we calculated 1.3 kg, you're buying 1.5 kg". |
| Supermarket packaging / pack-size rounding | — | P | — | P | **No** | Decision 19 — the manual adjustment covers the practical need. |
| Recomputes live when plan or pantry changes | — | Y | — | Y | **V1** | Derived view + small user overlay. |
| Group by aisle / category | — | Y | — | Y | **V1** | |
| Group by recipe (why is this on my list?) | — | Y | — | P | **V1** | Provenance per line. |
| Tick off items; ticking adds to pantry | — | P | — | P | **V1** | |
| Manually add or suppress a line | — | Y | Y | Y | **V1** | Overlay, not a stored list. |
| Retailer / delivery integration | — | Y | — | Y | **No** | |
| Shared household lists | — | Y | — | — | **No** | |
| Cost / budget estimation | — | P | — | Y | **No** | |

## Meal logging

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Log what was actually eaten, by day and slot | Y | P | — | Y | **V1** | Separate from the plan. |
| One-tap "log the planned meal" | P | — | — | Y | **V1** | Highest-value shortcut. |
| Log a batch portion, including fractions | — | — | — | P | **V1** | |
| Log an ad-hoc recipe or ingredient not planned | Y | — | — | Y | **V1** | |
| Custom food: name + kcal/P/C/F + quantity (ate out) | P | — | — | P | **V1** | Decision 17. Inline on the log; explicitly unattributable and never hidden from charts. |
| Reusable saved custom foods | Y | Y | — | Y | **V2** | The path toward barcode and external databases (decision 17). |
| Log deviating from the plan without editing the plan | Y | — | — | Y | **V1** | Plan is intent; log is fact. |
| Copy a previous day / log ahead | P | — | — | P | **V2** | |
| Timestamps per entry | P | — | — | — | **V2** | Slot is enough for v1. |

## Insights

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Daily calories and macros | Y | P | — | Y | **V1** | |
| Weekly totals and averages | P | — | — | P | **V1** | |
| Calories by meal slot | P | — | — | P | **V1** | |
| Calories by recipe | — | — | — | — | **V1** | |
| **Calories by ingredient, across logged meals** | — | — | — | — | **V1** | The headline insight. |
| Per-recipe ingredient calorie attribution | P | — | — | — | **V1** | |
| Planned vs actual comparison | — | — | — | P | **V2** | Natural once both exist; plan and log share one entry shape. |
| Optional daily **calorie** target, manually entered | Y | P | — | Y | **V1** | Decision 20. Target / consumed / remaining, presented plainly (DESIGN.md §8.4). |
| Macro targets | Y | P | — | Y | **V2** | Nullable fields on `Settings`; no calculation change. |
| BMR / TDEE / activity multipliers / weight projection | Y | — | — | Y | **No** | Decision 20 — the user enters their own number. |
| Composite health score or diet grade | Y | Y | — | — | **No** | We report; we do not judge. |
| Weight, exercise, fasting tracking | Y | P | — | — | **No** | |
| JSON export / import (whole database, images inline) | P | — | — | P | **V1** | Decision E. Replace-only import, all-or-nothing, Zod-validated. |
| Merge import | — | — | — | — | **No** | Decision E — unnecessary without sync. |

## Platform and product shape

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Works offline, no account required | — | — | — | — | **V1** | Local IndexedDB; a genuine differentiator. |
| Installable PWA | P | Y | P | P | **V1** | Manifest + service worker. |
| Mobile-first, desktop-capable | Y | Y | Y | Y | **V1** | Log on phone, author and analyse on desktop. |
| Multi-device sync / cloud | Y | Y | Y | Y | **No** | Decision 24. Local-only; JSON export is the backup route. |
| Accounts, subscriptions, ads, social features | Y | Y | Y | Y | **No** | Decision 24. |

## V1 scope summary

Build: ingredient library with canonical units and per-100g/ml/item nutrition · recipes with
derived nutrition, dynamic linear scaling, ingredient calorie attribution and an optional image
· quantitative pantry with one stored quantity per ingredient and three-state availability ·
batches carrying an immutable snapshot of the quantities actually cooked, with fractional
portions remaining, pantry deduction on cook, warn-rather-than-block on shortfall, and manual
closure · day × slot meal plan over data-driven slots, accepting recipes, batch portions and
ingredients · derived shopping list (`aggregate requirements − pantry`) over a user-chosen date
range, with category and recipe grouping, distinguishable manual adjustments, and pantry
write-back on tick · meal log with one-tap plan logging, fractional portions, bare-ingredient
entries that deduct stock, and custom foods · insights covering daily and weekly totals plus
attribution by meal, recipe and ingredient · optional daily calorie target · JSON
export/import · offline installable PWA.

Everything marked **V2** is model-compatible and should not require rework. Everything marked
**No** is out of scope per decision 24 and recorded here so later tickets do not reopen it.
**Nothing is undecided** — see [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md).

## V2 scope summary

V1 is built and shipped. V2 responds to use rather than adding a new product area, and is
specified in [V2_SCOPE.md](./V2_SCOPE.md) against five ADRs in [`docs/adr`](../adr/README.md):

Centre every page and give width a role, so the dead band down the right of every route
disappears and forms stop stretching to 1400px ([ADR-001](../adr/001-page-geometry-and-density.md))
· script-transcode several hundred cited reference ingredients so the first session is
productive, with per-ingredient provenance, a curated common tier, and category icons
([ADR-002](../adr/002-reference-ingredient-data-and-provenance.md))
· replace tense-based labels with source-based ones, write down when something should be a
recipe rather than an ingredient, and explain the loop where the choice is made
([ADR-003](../adr/003-food-nomenclature-and-promotion-rule.md)) · add saved meals that expand
into ordinary planned rows, applicable to several days at once, with a recents rail
([ADR-004](../adr/004-meal-templates-by-expansion.md)) · choose the control from the option
count rather than using a dropdown for everything
([ADR-005](../adr/005-choice-controls-by-cardinality.md)).

## V3 scope summary

V2 is built and shipped (PRs #16–#25). V3 adds one product area — the **Flavour Lab** — and is
specified in [V3_SCOPE.md](./V3_SCOPE.md) against ADRs 006–010.

It is deliberately small, because V1 and V2 already built the machinery: a seasoning mix is a
`Recipe` with derived nutrition, a snack is a `MealTemplate` that expands onto a day, and
logging one from Today shipped in V2 ticket 9. **No new entity, no new table.**

What V3 actually adds: the missing spices, from a second curated pack rather than by hand
([ADR-006](../adr/006-flavour-coverage-by-curated-second-dataset.md)) · sodium, nullable, so
that a zero-calorie flavour layer stops looking free
([ADR-007](../adr/007-sodium-as-a-nullable-nutrient.md)) · teaspoons and tablespoons at the
entry box, from cited weights, without becoming units
([ADR-008](../adr/008-kitchen-spoons-as-an-entry-time-conversion.md)) · a closed sensory
vocabulary with constraints derived rather than asserted
([ADR-009](../adr/009-sensory-tags-and-derived-constraints.md)) · and one route that lets the
user ask for something sour and spicy under a calorie ceiling, build it, and eat it
([ADR-010](../adr/010-flavour-lab-as-a-lens.md)).

The measure of success is one scenario: four dinners of chicken, hashbrowns, veg and sauce
planned from a fresh install in under a minute, without typing a nutrition figure.
