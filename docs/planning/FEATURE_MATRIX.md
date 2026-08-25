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
| Nutrition per ingredient (kcal + P/C/F) | Y | Y | — | Y | **V1** | Per 100 g / 100 ml / 1 item. |
| Unit metadata (mass / volume / count) | Y | Y | — | Y | **V1** | One canonical measure kind per ingredient. |
| Density and per-item weight for cross-kind conversion | P | P | — | P | **No** (V2-ready) | Decision 2 excludes ingredient-specific conversion tables. Conversion is in-family only (g↔kg, ml↔L). |
| Arbitrary units (tbsp, cup, pinch, slice) | Y | Y | — | Y | **No** | Decision 2. Needs per-ingredient conversion data; a feature of its own, not a units addition. |
| Staple flag (salt, oil, spice) for availability rules | — | — | P | — | **V2** | Availability now classifies by *how many* ingredients are short (decision 11). A staple flag refines that later. |
| Category / aisle grouping | Y | Y | Y | Y | **V1** | Reused by pantry and shopping list. |
| External food database lookup | Y | Y | Y | Y | **No** (V2-ready) | Model leaves room; not a prerequisite. |
| Barcode scanning | Y | Y | — | Y | **No** | |
| Photo / AI ingredient recognition | Y | P | Y | — | **No** | |
| Micronutrients beyond the four macros | Y | Y | — | Y | **No** (V2-ready) | Nutrition record is extensible. |

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
| Save / reload a favourite week | — | P | — | P | **V2** | |
| Automatic plan generation from macro targets | — | P | — | Y | **No** | Authorship over generation (decision 24). |
| Household / per-meal head count | — | P | — | Y | **No** (V2-ready) | Servings scaling covers most of it. |

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
