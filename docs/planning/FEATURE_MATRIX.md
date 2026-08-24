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
| Density and per-item weight for cross-kind conversion | P | P | — | P | **V1** | Required for ml↔g and item↔g; no guessing. |
| Staple flag (salt, oil, spice) for availability rules | — | — | P | — | **V1** | Drives "missing minor vs major". |
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
| Scale a recipe to other servings | P | P | — | Y | **V1** | Pure function; used by plan and batch. |
| Recipe import from URL | Y | Y | — | — | **No** | Scraping is a project of its own. |
| Public / community recipe catalogue | Y | Y | Y | Y | **No** | |
| Guided step-by-step cook mode | — | P | — | — | **V2** | Valuable; not planning-critical. |

## Pantry

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Pantry inventory exists | — | P | Y | P | **V1** | |
| **Quantitative** stock (1.2 kg, not "have chicken") | — | P | — | P | **V1** | Prerequisite for shopping subtraction. |
| Add / remove / adjust stock | — | P | Y | P | **V1** | Recorded as stock movements. |
| Fast chip-based add from ingredient library | — | — | Y | — | **V1** | SuperCook's best interaction. |
| "What can I make?" three-state availability | — | P | Y | P | **V1** | Now / missing minor / missing major. |
| Stock auto-deducted when a batch is cooked | — | — | — | — | **V1** | See [OPEN_QUESTIONS](./OPEN_QUESTIONS.md) Q3. |
| Stock auto-added when shopping items are ticked | — | — | — | — | **V1** | Keeps the pantry true for free. |
| Stock movement history / audit | — | — | — | — | **V1** | The ledger *is* the pantry. |
| Expiry / best-before tracking and alerts | — | P | — | P | **V2** | Optional field in v1, no alerting. |
| Storage locations (fridge / freezer / cupboard) | — | — | — | — | **V2** | |
| Receipt scanning, barcode restock | — | P | — | — | **No** | |

## Batches and portions (the differentiator)

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Record that a recipe was actually cooked (a Batch) | — | P | — | — | **V1** | Distinct from the Recipe. |
| Batch yields a countable number of portions | — | — | — | P | **V1** | |
| Batch nutrition frozen at cook time | — | — | — | — | **V1** | Later recipe edits never rewrite history. |
| Portions remaining, depleted as they are eaten | — | — | — | — | **V1** | |
| Fractional portions (0.5, 1.5) | P | — | — | P | **V1** | |
| Plan a future meal as "a portion of Batch #4" | — | — | — | P | **V1** | Requires no shopping. |
| Discard / waste a portion without logging it as eaten | — | — | — | — | **V1** | Cheap, and keeps insights honest. |
| Physical container tracking and labels | — | — | — | — | **No** | Portion count is sufficient; see Q2. |

None of the four references does this properly: leftovers are a planner side effect (ETM,
SF) or absent (MFP, SC).

## Meal planning

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Calendar of days × meal slots | P | Y | — | Y | **V1** | Breakfast / lunch / dinner / snack. |
| Drag and drop recipes into slots | — | Y | — | P | **V1** | dnd-kit; keyboard-accessible alternative required. |
| Plan a recipe at chosen servings | — | Y | — | Y | **V1** | |
| Plan an existing batch portion | — | — | — | P | **V1** | |
| Plan a bare ingredient (yoghurt, fruit) | Y | P | — | Y | **V1** | |
| Plan aggregates ingredient requirements | — | Y | — | Y | **V1** | Derived, never stored. |
| Separate cook day from eat day (batch cooking) | — | — | — | P | **V1** | See Q4 — shapes the whole planner. |
| Save / reload a favourite week | — | P | — | P | **V2** | |
| Automatic plan generation from macro targets | — | P | — | Y | **No** | Authorship over generation. |
| Household / per-meal head count | — | P | — | Y | **No** (V2-ready) | Servings scaling covers most of it. |

## Shopping

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Shopping list generated from the plan | — | Y | P | Y | **V1** | |
| List = plan requirements **minus** pantry stock | — | P | — | P | **V1** | Core arithmetic. |
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
| Quick-add bare calories/macros (ate out) | P | — | — | P | **V1** | Explicitly unattributable. |
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
| Planned vs actual comparison | — | — | — | P | **V2** | Natural once both exist. |
| Nutrition targets / goal tracking | Y | P | — | Y | **V2** | See Q8 — affects chart framing. |
| Composite health score or diet grade | Y | Y | — | — | **No** | We report; we do not judge. |
| Weight, exercise, fasting tracking | Y | P | — | — | **No** | |
| CSV / data export | P | — | — | P | **V1** | JSON backup + restore, since data is local-only. |

## Platform and product shape

| Capability | MFP | SF | SC | ETM | Recipe PWA | Note |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Works offline, no account required | — | — | — | — | **V1** | Local IndexedDB; a genuine differentiator. |
| Installable PWA | P | Y | P | P | **V1** | Manifest + service worker. |
| Mobile-first, desktop-capable | Y | Y | Y | Y | **V1** | Log on phone, author and analyse on desktop. |
| Multi-device sync | Y | Y | Y | Y | **No** | See Q7 — must be settled before persistence lands. |
| Accounts, subscriptions, ads | Y | Y | Y | Y | **No** | |

## V1 scope summary

Build: ingredient library with units and nutrition · recipes with derived nutrition ·
quantitative pantry with a movement ledger and three-state availability · batches with
frozen nutrition and depleting portions · day × slot meal plan accepting recipes, portions
and ingredients · derived shopping list (`requirements − pantry`) with aisle and recipe
grouping and pantry write-back on tick · meal log with one-tap plan logging, fractional
portions and quick-add · insights covering daily/weekly totals and attribution by slot,
recipe and ingredient · JSON export/import · offline installable PWA.

Everything marked **V2** is model-compatible and should not require rework. Everything
marked **No** is recorded in [PRODUCT_RESEARCH.md](./PRODUCT_RESEARCH.md) so later tickets
do not reopen it.
